-- ==========================================================
-- File: 37_email_ingest.sql
-- Description: Email-to-ticket queue, ingest and monitoring functions
-- Canonical copy; the change ships in migration 20261127120000_email_to_ticket.sql.
-- ==========================================================

-- A browser cannot claim a message or ticket came in by email: the columns
-- are the ingest pipeline's. Anything written with a user's own token is
-- reset to 'app' with no email headers; the service role is left alone.
CREATE OR REPLACE FUNCTION public.email_guard_client_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF current_user IN ('authenticated', 'anon') THEN
        IF TG_OP = 'UPDATE' THEN
            NEW.source := OLD.source;

            IF TG_TABLE_NAME = 'ticket_messages' THEN
                NEW.email_message_id := OLD.email_message_id;
                NEW.email_in_reply_to := OLD.email_in_reply_to;
                NEW.email_references := OLD.email_references;
            END IF;
        ELSE
            NEW.source := 'app';

            IF TG_TABLE_NAME = 'ticket_messages' THEN
                NEW.email_message_id := NULL;
                NEW.email_in_reply_to := NULL;
                NEW.email_references := NULL;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.email_guard_client_source() FROM public, anon, authenticated;

-- Gmail history ids are decimal strings; compared as numbers.
CREATE OR REPLACE FUNCTION public.email_history_greatest(p_a text, p_b text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_a IS NULL OR p_a !~ '^[0-9]+$' THEN
            CASE WHEN p_b ~ '^[0-9]+$' THEN p_b ELSE p_a END
        WHEN p_b IS NULL OR p_b !~ '^[0-9]+$' THEN p_a
        WHEN p_b::numeric > p_a::numeric THEN p_b
        ELSE p_a
    END;
$$;

-- Queue one job, or fold into the mailbox's pending one. A pending job in a
-- retry backoff keeps its run_after: a new notification must not hammer a
-- provider that just rate-limited us.
CREATE OR REPLACE FUNCTION public.email_enqueue_sync(
    p_integration_id uuid,
    p_history_id text DEFAULT NULL,
    p_reason text DEFAULT 'push',
    p_kind text DEFAULT 'sync'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_integration public.tenant_email_integrations%rowtype;
    v_id uuid;
BEGIN
    SELECT * INTO v_integration
    FROM public.tenant_email_integrations
    WHERE id = p_integration_id;

    IF NOT FOUND OR v_integration.status = 'disconnected' THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.email_sync_jobs (tenant_id, integration_id, kind, reason, history_id)
    VALUES (v_integration.tenant_id, p_integration_id, p_kind, p_reason, p_history_id)
    ON CONFLICT (integration_id, kind) WHERE status = 'pending'
    DO UPDATE SET
        history_id = public.email_history_greatest(email_sync_jobs.history_id, EXCLUDED.history_id),
        run_after = CASE
            WHEN email_sync_jobs.attempts = 0 THEN least(email_sync_jobs.run_after, now())
            ELSE email_sync_jobs.run_after
        END,
        updated_at = now()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- Hand out due jobs, marking them processing. SKIP LOCKED lets the cron and
-- the webhook's kick run together without taking the same job twice.
CREATE OR REPLACE FUNCTION public.claim_email_sync_jobs(
    p_limit integer DEFAULT 10,
    p_lease interval DEFAULT interval '5 minutes'
)
RETURNS SETOF public.email_sync_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.email_sync_jobs j
    SET status = 'processing',
        attempts = j.attempts + 1,
        locked_at = now(),
        updated_at = now()
    WHERE j.id IN (
        SELECT id
        FROM public.email_sync_jobs
        WHERE (
                (status = 'pending' AND run_after <= now())
             OR (status = 'processing' AND locked_at < now() - p_lease)
              )
          AND attempts < max_attempts
        ORDER BY run_after
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    RETURNING j.*;
$$;

-- Settle a job: done, or back to pending after p_retry_in, or failed for good.
CREATE OR REPLACE FUNCTION public.email_finish_sync_job(
    p_job_id uuid,
    p_ok boolean,
    p_error text DEFAULT NULL,
    p_retry_in interval DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
BEGIN
    UPDATE public.email_sync_jobs j
    SET status = CASE
            WHEN p_ok THEN 'completed'
            WHEN p_retry_in IS NULL OR j.attempts >= j.max_attempts THEN 'failed'
            ELSE 'pending'
        END,
        run_after = CASE WHEN p_ok OR p_retry_in IS NULL THEN j.run_after ELSE now() + p_retry_in END,
        completed_at = CASE WHEN p_ok OR p_retry_in IS NULL OR j.attempts >= j.max_attempts THEN now() END,
        locked_at = NULL,
        last_error = CASE WHEN p_ok THEN NULL ELSE left(p_error, 2000) END,
        updated_at = now()
    WHERE j.id = p_job_id
    RETURNING j.status INTO v_status;

    RETURN v_status;
EXCEPTION WHEN unique_violation THEN
    -- A newer pending job for the mailbox already exists; it carries the work.
    UPDATE public.email_sync_jobs
    SET status = 'completed',
        completed_at = now(),
        locked_at = NULL,
        last_error = left(p_error, 2000),
        updated_at = now()
    WHERE id = p_job_id;

    RETURN 'completed';
END;
$$;

-- One sync at a time per mailbox, across every worker invocation. A lease,
-- not a session lock: PostgREST calls are separate transactions.
CREATE OR REPLACE FUNCTION public.email_acquire_integration_lease(
    p_integration_id uuid,
    p_owner uuid,
    p_lease interval DEFAULT interval '5 minutes'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.tenant_email_integrations
    SET sync_lease_owner = p_owner,
        sync_lease_until = now() + p_lease
    WHERE id = p_integration_id
      AND (
            sync_lease_owner IS NULL
         OR sync_lease_owner = p_owner
         OR sync_lease_until < now()
          );

    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.email_release_integration_lease(
    p_integration_id uuid,
    p_owner uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.tenant_email_integrations
    SET sync_lease_owner = NULL,
        sync_lease_until = NULL
    WHERE id = p_integration_id
      AND sync_lease_owner = p_owner;
$$;

-- Move the history cursor forward only (a late, older job never rewinds it).
CREATE OR REPLACE FUNCTION public.email_advance_history(
    p_integration_id uuid,
    p_history_id text
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.tenant_email_integrations
    SET provider_history_id = public.email_history_greatest(provider_history_id, p_history_id),
        last_sync_at = now()
    WHERE id = p_integration_id
    RETURNING provider_history_id;
$$;

-- Due events of one mailbox, marked processing. Called under the mailbox's
-- lease, so the events of one mailbox are processed one worker at a time and
-- two replies in one thread can't race each other into two tickets.
CREATE OR REPLACE FUNCTION public.claim_email_inbound_events(
    p_integration_id uuid,
    p_limit integer DEFAULT 25,
    p_lease interval DEFAULT interval '5 minutes'
)
RETURNS SETOF public.email_inbound_events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.email_inbound_events e
    SET status = 'processing',
        locked_at = now(),
        updated_at = now()
    WHERE e.id IN (
        SELECT id
        FROM public.email_inbound_events
        WHERE integration_id = p_integration_id
          AND (
                (status = 'pending' AND next_attempt_at <= now())
             OR (status = 'processing' AND locked_at < now() - p_lease)
              )
        ORDER BY received_at NULLS LAST, created_at
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    RETURNING e.*;
$$;

-- The one write that turns an email into a ticket or a reply.
--
-- p_input (all text unless noted):
--   sender_email, sender_name, recipient_email, subject, body,
--   message_id, in_reply_to, references, received_at (timestamptz),
--   match_ticket_id (uuid, from the thread matcher), match_source
--   ('in_reply_to' | 'references' | 'subject' | null)
--
-- Returns {status, outcome, ticket_id, ticket_message_id, customer_id,
-- ignore_reason, replayed}. Status is 'committed' (attachments next) or
-- 'ignored'. Running it again for a committed event changes nothing and
-- returns the same ids with replayed = true.
CREATE OR REPLACE FUNCTION public.email_ingest_commit(
    p_event_id uuid,
    p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event       public.email_inbound_events%rowtype;
    v_integration public.tenant_email_integrations%rowtype;
    v_customer    public.customers%rowtype;
    v_ticket      public.tickets%rowtype;
    v_email       citext;
    v_name        text;
    v_subject     text;
    v_body        text;
    v_message_id  text := nullif(trim(p_input ->> 'message_id'), '');
    v_match_id    uuid;
    v_match_src   text := p_input ->> 'match_source';
    v_message     uuid;
    v_outcome     text;
    v_reason      text;
BEGIN
    SELECT * INTO v_event
    FROM public.email_inbound_events
    WHERE id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'email_ingest_commit: event % not found', p_event_id
            USING errcode = 'P0002';
    END IF;

    -- Already done (a retry after a crash, a duplicate claim): report it.
    IF v_event.ticket_id IS NOT NULL OR v_event.status IN ('processed', 'ignored') THEN
        RETURN jsonb_build_object(
            'status', CASE WHEN v_event.status = 'ignored' THEN 'ignored' ELSE 'committed' END,
            'outcome', v_event.outcome,
            'ticket_id', v_event.ticket_id,
            'ticket_message_id', v_event.ticket_message_id,
            'customer_id', v_event.customer_id,
            'ignore_reason', v_event.ignore_reason,
            'replayed', true
        );
    END IF;

    v_email := lower(trim(p_input ->> 'sender_email'));

    SELECT * INTO v_integration
    FROM public.tenant_email_integrations
    WHERE id = v_event.integration_id
      AND tenant_id = v_event.tenant_id;

    --------------------------------------------------------
    -- Reasons to file nothing
    --------------------------------------------------------
    IF NOT FOUND OR v_integration.status = 'disconnected' OR NOT v_integration.enabled THEN
        v_reason := 'integration_inactive';
    ELSIF NOT EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = v_event.tenant_id AND t.status = 'active'
    ) THEN
        v_reason := 'tenant_inactive';
    ELSIF v_email IS NULL
       OR v_email::text !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
        v_reason := 'invalid_sender';
    ELSIF v_email = v_integration.connected_email
       OR v_email = v_integration.receiving_email THEN
        -- The mailbox writing to itself: a loop, never a customer.
        v_reason := 'sender_is_mailbox';
    ELSIF v_message_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.email_inbound_events e
        WHERE e.tenant_id = v_event.tenant_id
          AND e.message_id = v_message_id
          AND e.id <> v_event.id
          AND (e.ticket_id IS NOT NULL OR e.status IN ('processing', 'processed'))
    ) THEN
        v_reason := 'duplicate_message';
    ELSIF EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.memberships m ON m.user_id = u.id
        WHERE lower(u.email) = v_email::text
          AND m.tenant_id = v_event.tenant_id
          AND m.status = 'active'
          AND m.role IN ('tenant_admin', 'manager', 'agent', 'billing_admin')
    ) THEN
        -- Staff mail (a forward, a reply sent from Gmail) is not a customer
        -- request, and filing it would turn the team into requesters.
        v_reason := 'sender_is_team';
    END IF;

    IF v_reason IS NULL THEN
        SELECT * INTO v_customer
        FROM public.customers
        WHERE tenant_id = v_event.tenant_id
          AND email = v_email;

        IF NOT FOUND THEN
            IF NOT v_integration.auto_create_customer THEN
                v_reason := 'unknown_sender';
            ELSE
                v_name := coalesce(
                    nullif(left(trim(p_input ->> 'sender_name'), 200), ''),
                    initcap(replace(split_part(v_email::text, '@', 1), '.', ' '))
                );

                -- Not linked to any sign-in: an address in a From header is
                -- not proof of identity. Claiming the record still takes the
                -- portal's emailed link (portal_link_user).
                INSERT INTO public.customers (tenant_id, email, full_name)
                VALUES (v_event.tenant_id, v_email, v_name)
                ON CONFLICT (tenant_id, email) DO NOTHING;

                SELECT * INTO v_customer
                FROM public.customers
                WHERE tenant_id = v_event.tenant_id
                  AND email = v_email;
            END IF;
        ELSIF EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = v_event.tenant_id
              AND m.user_id = v_customer.portal_user_id
              AND m.status = 'disabled'
        ) THEN
            -- Same rule as the portal: a customer the team turned off.
            v_reason := 'customer_disabled';
        END IF;
    END IF;

    IF v_reason IS NOT NULL THEN
        UPDATE public.email_inbound_events
        SET status = 'ignored',
            ignore_reason = v_reason,
            sender_email = coalesce(v_email, sender_email),
            processed_at = now(),
            locked_at = NULL,
            error_message = NULL,
            error_category = NULL
        WHERE id = v_event.id;

        RETURN jsonb_build_object(
            'status', 'ignored',
            'ignore_reason', v_reason,
            'replayed', false
        );
    END IF;

    v_body := nullif(trim(p_input ->> 'body'), '');
    v_subject := coalesce(nullif(left(trim(p_input ->> 'subject'), 300), ''), '(no subject)');

    --------------------------------------------------------
    -- Thread: the matcher's candidate, re-checked here
    --------------------------------------------------------
    BEGIN
        v_match_id := nullif(p_input ->> 'match_ticket_id', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        v_match_id := NULL;
    END;

    IF v_match_id IS NOT NULL THEN
        SELECT * INTO v_ticket
        FROM public.tickets
        WHERE id = v_match_id
          AND tenant_id = v_event.tenant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            v_match_id := NULL;
        ELSIF coalesce(v_match_src, 'subject') NOT IN ('in_reply_to', 'references')
              AND v_ticket.requester_customer_id <> v_customer.id THEN
            -- A ticket number in a subject is guessable; only the requester
            -- may add to a ticket that way. Header matches carry an id
            -- nobody outside the thread has seen, so a CC'd colleague's reply
            -- threads too.
            v_match_id := NULL;
        END IF;
    END IF;

    IF v_match_id IS NOT NULL THEN
        INSERT INTO public.ticket_messages (
            tenant_id, ticket_id, author_type, author_id, body, visibility,
            source, email_message_id, email_in_reply_to, email_references,
            created_at
        )
        VALUES (
            v_event.tenant_id,
            v_ticket.id,
            'customer',
            v_customer.id,
            coalesce(v_body, '(This email had no text.)'),
            'public',
            'email',
            v_message_id,
            nullif(left(p_input ->> 'in_reply_to', 2000), ''),
            nullif(left(p_input ->> 'references', 8000), ''),
            now()
        )
        RETURNING id INTO v_message;

        -- The portal's reply rule (portal_reply_bumps_status): a reply puts a
        -- ticket that was waiting on the customer back in the queue. A
        -- resolved or closed ticket stays as it is -- reopening is an
        -- explicit action -- and the assignee hears about the reply through
        -- notify_ticket_message either way.
        UPDATE public.tickets
        SET status = 'open'
        WHERE id = v_ticket.id
          AND status IN ('pending', 'on_hold');

        v_outcome := 'reply_appended';
    ELSE
        -- Same defaults as a portal request (PORTAL_REQUEST_PRIORITY = low,
        -- status new); number, SLA policy, notifications and audit come from
        -- the tickets triggers.
        INSERT INTO public.tickets (
            tenant_id, subject, description, status, priority,
            requester_customer_id, source
        )
        VALUES (
            v_event.tenant_id,
            v_subject,
            coalesce(v_body, '(This email had no text.)'),
            'new',
            'low',
            v_customer.id,
            'email'
        )
        RETURNING * INTO v_ticket;

        v_outcome := 'ticket_created';
    END IF;

    UPDATE public.email_inbound_events
    SET ticket_id = v_ticket.id,
        ticket_message_id = v_message,
        customer_id = v_customer.id,
        outcome = v_outcome,
        sender_email = v_email,
        sender_name = nullif(left(trim(p_input ->> 'sender_name'), 200), ''),
        recipient_email = nullif(lower(trim(p_input ->> 'recipient_email')), ''),
        subject = left(p_input ->> 'subject', 500),
        message_id = v_message_id,
        in_reply_to = nullif(left(p_input ->> 'in_reply_to', 2000), ''),
        references_header = nullif(left(p_input ->> 'references', 8000), ''),
        error_message = NULL,
        error_category = NULL
    WHERE id = v_event.id;

    RETURN jsonb_build_object(
        'status', 'committed',
        'outcome', v_outcome,
        'ticket_id', v_ticket.id,
        'ticket_number', v_ticket.number,
        'ticket_message_id', v_message,
        'customer_id', v_customer.id,
        'replayed', false
    );
END;
$$;

-- The ticket an email with one of these Message-IDs was filed on, in this
-- tenant only: a ticket created from an email (its event), or a reply
-- appended from one (its message). Newest first. An RPC rather than a
-- PostgREST filter because Message-IDs may contain characters that filter
-- syntax would read as operators.
CREATE OR REPLACE FUNCTION public.email_find_thread_ticket(
    p_tenant_id uuid,
    p_message_ids text[]
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ticket_id
    FROM (
        SELECT e.ticket_id, e.created_at
        FROM public.email_inbound_events e
        WHERE e.tenant_id = p_tenant_id
          AND e.message_id = ANY (p_message_ids[1:50])
          AND e.ticket_id IS NOT NULL

        UNION ALL

        SELECT m.ticket_id, m.created_at
        FROM public.ticket_messages m
        WHERE m.tenant_id = p_tenant_id
          AND m.email_message_id = ANY (p_message_ids[1:50])
    ) found
    ORDER BY created_at DESC
    LIMIT 1;
$$;

-- Mark an event ignored before commit (filtering happens in the worker).
CREATE OR REPLACE FUNCTION public.email_ingest_ignore(
    p_event_id uuid,
    p_reason text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.email_inbound_events
    SET status = 'ignored',
        ignore_reason = left(p_reason, 100),
        processed_at = now(),
        locked_at = NULL,
        error_message = NULL,
        error_category = NULL
    WHERE id = p_event_id
      AND ticket_id IS NULL
      AND status <> 'processed';
$$;

-- After the attachments: the event is done.
CREATE OR REPLACE FUNCTION public.email_ingest_complete(p_event_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.email_inbound_events
    SET status = 'processed',
        processed_at = now(),
        locked_at = NULL,
        error_message = NULL,
        error_category = NULL
    WHERE id = p_event_id
      AND ticket_id IS NOT NULL;
$$;

-- A failed attempt: back to pending after p_retry_in, or failed for good when
-- the error is permanent or the retries are spent. Returns the new status.
CREATE OR REPLACE FUNCTION public.email_ingest_fail(
    p_event_id uuid,
    p_error text,
    p_category text,
    p_retry_in interval DEFAULT NULL
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.email_inbound_events e
    SET retry_count = e.retry_count + 1,
        status = CASE
            WHEN p_category = 'permanent'
              OR p_retry_in IS NULL
              OR e.retry_count + 1 > e.max_retries THEN 'failed'
            ELSE 'pending'
        END,
        next_attempt_at = CASE
            WHEN p_retry_in IS NULL THEN e.next_attempt_at
            ELSE now() + p_retry_in
        END,
        error_message = left(p_error, 2000),
        error_category = CASE WHEN p_category IN ('temporary', 'permanent') THEN p_category ELSE 'temporary' END,
        locked_at = NULL
    WHERE e.id = p_event_id
      AND e.status NOT IN ('processed', 'ignored')
    RETURNING e.status;
$$;

-- An admin's "Retry" on a failed email. The app checks the caller is the
-- workspace's Tenant Admin first; p_tenant_id scopes the write regardless.
CREATE OR REPLACE FUNCTION public.email_retry_inbound_event(
    p_tenant_id uuid,
    p_event_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_integration uuid;
BEGIN
    UPDATE public.email_inbound_events
    SET status = 'pending',
        retry_count = 0,
        next_attempt_at = now(),
        locked_at = NULL,
        error_message = NULL,
        error_category = NULL
    WHERE id = p_event_id
      AND tenant_id = p_tenant_id
      AND status = 'failed'
    RETURNING integration_id INTO v_integration;

    IF v_integration IS NULL THEN
        RETURN false;
    END IF;

    PERFORM public.email_enqueue_sync(v_integration, NULL, 'manual', 'sync');

    RETURN true;
END;
$$;

-- What the cron asks for every minute. Cheap when there is nothing to do.
--   * events due for a retry -> a sync job for their mailbox (the job
--     processes due events after reading history)
--   * reconciliation: a live mailbox not synced for 10 minutes gets a sync,
--     which recovers notifications Pub/Sub never delivered
--   * a watch that expires within a day (or was never set) gets renewed
-- Returns how many jobs it queued.
CREATE OR REPLACE FUNCTION public.email_ingest_schedule()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer := 0;
    v_rows integer;
BEGIN
    INSERT INTO public.email_sync_jobs (tenant_id, integration_id, kind, reason)
    SELECT DISTINCT e.tenant_id, e.integration_id, 'sync', 'retry'
    FROM public.email_inbound_events e
    JOIN public.tenant_email_integrations i ON i.id = e.integration_id
    WHERE i.status IN ('connected', 'error')
      AND (
            (e.status = 'pending' AND e.next_attempt_at <= now())
         OR (e.status = 'processing' AND e.locked_at < now() - interval '5 minutes')
          )
    ON CONFLICT (integration_id, kind) WHERE status = 'pending' DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_count := v_count + v_rows;

    INSERT INTO public.email_sync_jobs (tenant_id, integration_id, kind, reason)
    SELECT i.tenant_id, i.id, 'sync', 'reconcile'
    FROM public.tenant_email_integrations i
    WHERE i.status IN ('connected', 'error')
      AND i.enabled
      AND i.refresh_token_encrypted IS NOT NULL
      AND (i.last_sync_at IS NULL OR i.last_sync_at < now() - interval '10 minutes')
      AND NOT EXISTS (
          SELECT 1 FROM public.email_sync_jobs j
          WHERE j.integration_id = i.id
            AND j.kind = 'sync'
            AND j.status = 'processing'
      )
    ON CONFLICT (integration_id, kind) WHERE status = 'pending' DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_count := v_count + v_rows;

    INSERT INTO public.email_sync_jobs (tenant_id, integration_id, kind, reason)
    SELECT i.tenant_id, i.id, 'watch', 'renewal'
    FROM public.tenant_email_integrations i
    WHERE i.status IN ('connected', 'error')
      AND i.refresh_token_encrypted IS NOT NULL
      AND (i.watch_expiration IS NULL OR i.watch_expiration < now() + interval '1 day')
      AND NOT EXISTS (
          SELECT 1 FROM public.email_sync_jobs j
          WHERE j.integration_id = i.id
            AND j.kind = 'watch'
            AND (
                  j.status = 'processing'
                  -- A renewal that failed for good waits an hour before the
                  -- next try instead of being queued every minute.
               OR (j.status = 'failed' AND j.completed_at > now() - interval '1 hour')
                )
      )
    ON CONFLICT (integration_id, kind) WHERE status = 'pending' DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_count := v_count + v_rows;

    -- Finished jobs are diagnostics, not history: keep a week.
    DELETE FROM public.email_sync_jobs
    WHERE status IN ('completed', 'failed')
      AND completed_at < now() - interval '7 days';

    -- A connected inbox may be a person's own: mail that was not for the
    -- support address is kept only as long as dedupe needs it (Gmail history
    -- is not replayed past a week), and never with its headers.
    DELETE FROM public.email_inbound_events
    WHERE status = 'ignored'
      AND ignore_reason = 'not_support_address'
      AND created_at < now() - interval '30 days';

    RETURN v_count;
END;
$$;

-- The Email channel page's numbers. Callable by the signed-in Tenant Admin
-- for their own workspace only (checked here, against the membership row).
CREATE OR REPLACE FUNCTION public.email_channel_stats(
    p_since timestamptz DEFAULT now() - interval '7 days'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant uuid := public.current_tenant_id();
    v_result jsonb;
BEGIN
    IF v_tenant IS NULL
       OR public.current_tenant_role() IS DISTINCT FROM 'tenant_admin'
       OR NOT public.is_active_membership() THEN
        RAISE EXCEPTION 'email_channel_stats: not allowed' USING errcode = '42501';
    END IF;

    SELECT jsonb_build_object(
        'received', count(*),
        'tickets_created', count(*) FILTER (WHERE outcome = 'ticket_created'),
        'replies_appended', count(*) FILTER (WHERE outcome = 'reply_appended'),
        'ignored', count(*) FILTER (WHERE status = 'ignored'),
        'failed', count(*) FILTER (WHERE status = 'failed'),
        'queued', count(*) FILTER (WHERE status IN ('pending', 'processing')),
        'avg_latency_seconds', round(avg(extract(epoch FROM (processed_at - coalesce(received_at, created_at))))
            FILTER (WHERE status = 'processed'))
    )
    INTO v_result
    FROM public.email_inbound_events
    WHERE tenant_id = v_tenant
      AND created_at >= p_since;

    RETURN v_result || jsonb_build_object(
        'sync_in_progress', EXISTS (
            SELECT 1 FROM public.email_sync_jobs j
            WHERE j.tenant_id = v_tenant
              AND j.kind = 'sync'
              AND j.status = 'processing'
              AND j.locked_at > now() - interval '5 minutes'
        )
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.email_history_greatest(text, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_enqueue_sync(uuid, text, text, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_email_sync_jobs(integer, interval) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_finish_sync_job(uuid, boolean, text, interval) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_acquire_integration_lease(uuid, uuid, interval) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_release_integration_lease(uuid, uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_advance_history(uuid, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_email_inbound_events(uuid, integer, interval) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_ingest_commit(uuid, jsonb) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_find_thread_ticket(uuid, text[]) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_ingest_ignore(uuid, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_ingest_complete(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_ingest_fail(uuid, text, text, interval) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_retry_inbound_event(uuid, uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_ingest_schedule() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_channel_stats(timestamptz) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.email_history_greatest(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_enqueue_sync(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_email_sync_jobs(integer, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_finish_sync_job(uuid, boolean, text, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_acquire_integration_lease(uuid, uuid, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_release_integration_lease(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_advance_history(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_email_inbound_events(uuid, integer, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_ingest_commit(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_find_thread_ticket(uuid, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_ingest_ignore(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_ingest_complete(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_ingest_fail(uuid, text, text, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_retry_inbound_event(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_ingest_schedule() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_channel_stats(timestamptz) TO authenticated, service_role;

-- Agent replies sent from the connected Gmail (migration 20261127150000).
CREATE OR REPLACE FUNCTION public.email_ingest_commit_agent_reply(
    p_event_id uuid,
    p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event       public.email_inbound_events%rowtype;
    v_integration public.tenant_email_integrations%rowtype;
    v_ticket      public.tickets%rowtype;
    v_requester   citext;
    v_author      uuid;
    v_match_id    uuid;
    v_match_src   text := coalesce(p_input ->> 'match_source', 'subject');
    v_sender      citext := lower(trim(p_input ->> 'sender_email'));
    v_recipients  text[];
    v_message     uuid;
    v_reason      text;
BEGIN
    SELECT * INTO v_event
    FROM public.email_inbound_events
    WHERE id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'email_ingest_commit_agent_reply: event % not found', p_event_id
            USING errcode = 'P0002';
    END IF;

    IF v_event.ticket_id IS NOT NULL OR v_event.status IN ('processed', 'ignored') THEN
        RETURN jsonb_build_object(
            'status', CASE WHEN v_event.status = 'ignored' THEN 'ignored' ELSE 'committed' END,
            'outcome', v_event.outcome,
            'ticket_id', v_event.ticket_id,
            'ticket_message_id', v_event.ticket_message_id,
            'ignore_reason', v_event.ignore_reason,
            'replayed', true
        );
    END IF;

    SELECT * INTO v_integration
    FROM public.tenant_email_integrations
    WHERE id = v_event.integration_id
      AND tenant_id = v_event.tenant_id;

    BEGIN
        v_match_id := nullif(p_input ->> 'match_ticket_id', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        v_match_id := NULL;
    END;

    SELECT coalesce(array_agg(lower(trim(r))), '{}')
    INTO v_recipients
    FROM jsonb_array_elements_text(coalesce(p_input -> 'recipients', '[]'::jsonb)) AS r;

    IF v_integration.id IS NULL
       OR v_integration.status = 'disconnected' OR NOT v_integration.enabled THEN
        v_reason := 'integration_inactive';
    ELSIF v_sender IS DISTINCT FROM v_integration.connected_email THEN
        v_reason := 'sent_not_ticket_reply';
    ELSIF v_match_id IS NULL THEN
        v_reason := 'sent_not_ticket_reply';
    ELSE
        SELECT * INTO v_ticket
        FROM public.tickets
        WHERE id = v_match_id
          AND tenant_id = v_event.tenant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            v_reason := 'sent_not_ticket_reply';
        ELSIF v_match_src NOT IN ('in_reply_to', 'references') THEN
            SELECT c.email INTO v_requester
            FROM public.customers c
            WHERE c.id = v_ticket.requester_customer_id;

            IF v_requester IS NULL OR NOT (v_requester::text = ANY (v_recipients)) THEN
                v_reason := 'sent_not_ticket_reply';
            END IF;
        END IF;
    END IF;

    IF v_reason IS NULL THEN
        -- Credited to whoever connected the mailbox, while they are still
        -- active staff here; otherwise to the workspace's earliest active
        -- Tenant Admin. Never to a customer.
        SELECT m.user_id INTO v_author
        FROM public.memberships m
        WHERE m.tenant_id = v_event.tenant_id
          AND m.status = 'active'
          AND m.role IN ('tenant_admin', 'manager', 'agent')
        ORDER BY (m.user_id = v_integration.connected_by) DESC,
                 (m.role = 'tenant_admin') DESC,
                 m.created_at
        LIMIT 1;

        IF v_author IS NULL THEN
            v_reason := 'no_staff_author';
        END IF;
    END IF;

    IF v_reason IS NOT NULL THEN
        UPDATE public.email_inbound_events
        SET status = 'ignored',
            ignore_reason = v_reason,
            processed_at = now(),
            locked_at = NULL,
            error_message = NULL,
            error_category = NULL
        WHERE id = v_event.id;

        RETURN jsonb_build_object('status', 'ignored', 'ignore_reason', v_reason, 'replayed', false);
    END IF;

    INSERT INTO public.ticket_messages (
        tenant_id, ticket_id, author_type, author_id, body, visibility,
        source, email_message_id, email_in_reply_to, email_references
    )
    VALUES (
        v_event.tenant_id,
        v_ticket.id,
        'agent',
        v_author,
        coalesce(nullif(trim(p_input ->> 'body'), ''), '(This email had no text.)'),
        'public',
        'email',
        nullif(trim(p_input ->> 'message_id'), ''),
        nullif(left(p_input ->> 'in_reply_to', 2000), ''),
        nullif(left(p_input ->> 'references', 8000), '')
    )
    RETURNING id INTO v_message;

    UPDATE public.email_inbound_events
    SET ticket_id = v_ticket.id,
        ticket_message_id = v_message,
        outcome = 'agent_reply_appended',
        sender_email = v_sender,
        subject = left(p_input ->> 'subject', 500),
        message_id = nullif(trim(p_input ->> 'message_id'), ''),
        in_reply_to = nullif(left(p_input ->> 'in_reply_to', 2000), ''),
        references_header = nullif(left(p_input ->> 'references', 8000), ''),
        error_message = NULL,
        error_category = NULL
    WHERE id = v_event.id;

    RETURN jsonb_build_object(
        'status', 'committed',
        'outcome', 'agent_reply_appended',
        'ticket_id', v_ticket.id,
        'ticket_number', v_ticket.number,
        'ticket_message_id', v_message,
        'author_id', v_author,
        'replayed', false
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.email_ingest_commit_agent_reply(uuid, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_ingest_commit_agent_reply(uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.email_purge_private_events()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH gone AS (
        DELETE FROM public.email_inbound_events
        WHERE status = 'ignored'
          AND ignore_reason IN ('not_support_address', 'sent_not_ticket_reply', 'draft_or_sent')
          AND created_at < now() - interval '30 days'
        RETURNING 1
    )
    SELECT count(*)::integer FROM gone;
$$;

REVOKE EXECUTE ON FUNCTION public.email_purge_private_events() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_purge_private_events() TO service_role;

-- "Sync now" runs the worker at once (migration 20261127160000).
CREATE OR REPLACE FUNCTION public.email_kick_worker()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_url text;
    v_key text;
BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name = 'email_ingest_url';

    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key';

    IF coalesce(v_url, '') = '' OR coalesce(v_key, '') = '' THEN
        RETURN NULL;
    END IF;

    RETURN net.http_post(
        url := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_key
        ),
        body := '{}'::jsonb
    );
END;
$$;
