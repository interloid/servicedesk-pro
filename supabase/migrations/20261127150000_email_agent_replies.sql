-- ==========================================================
-- File: 20261127150000_email_agent_replies.sql
-- Description: Agent replies sent straight from the connected Gmail mailbox
--              are added to the ticket they answer.
--
-- The sync now reads the mailbox's SENT mail as well as its inbox. A message
-- sent FROM the connected mailbox that continues a ticket's email thread is
-- the team answering the customer from Gmail: it becomes a public agent
-- message on that ticket (email_ingest_commit_agent_reply), credited to the
-- staff member who connected the mailbox.
--
-- The customer already received that email from Gmail, so the
-- customer_ticket_reply email notify_ticket_message would queue for an agent
-- reply is skipped for messages that came in by email (source = 'email').
--
-- Sent mail that is not a reply to a ticket is never stored beyond the
-- ledger row (no headers), and is purged like other non-support mail.
--
-- Canonical copies: schemas/functions/37_email_ingest.sql,
-- schemas/functions/25_ticket_notifications.sql,
-- schemas/tables/31_email_inbound_events.sql.
-- ==========================================================

BEGIN;

------------------------------------------------------------
-- 1. A third outcome
------------------------------------------------------------

ALTER TABLE public.email_inbound_events
    DROP CONSTRAINT IF EXISTS email_inbound_events_outcome_check;

ALTER TABLE public.email_inbound_events
    ADD CONSTRAINT email_inbound_events_outcome_check
        CHECK (outcome IS NULL OR outcome IN ('ticket_created', 'reply_appended', 'agent_reply_appended'));

------------------------------------------------------------
-- 2. Commit an agent reply sent from Gmail
------------------------------------------------------------
--
-- p_input: sender_email, recipients (text[] of To + Cc), body, message_id,
-- in_reply_to, references, match_ticket_id (uuid), match_source.
--
-- Accepted only when:
--   * the sender is the connected mailbox itself (the worker checks the
--     Gmail SENT label too; this re-checks the address);
--   * the ticket is this tenant's;
--   * the match came from the thread headers, or -- for a [#n] subject
--     match, which is guessable -- the ticket's requester is among the
--     recipients.
-- Anything else is ignored as sent_not_ticket_reply. Same lock-and-replay
-- contract as email_ingest_commit.

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

------------------------------------------------------------
-- 3. No second email to the customer for a reply sent from Gmail
------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_ticket_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket   public.tickets%rowtype;
    v_customer text;
BEGIN
    -- An agent reply that came in by email (sent from the connected Gmail)
    -- has already reached the customer: queue nothing for it.
    IF NEW.author_type = 'agent' AND NEW.visibility = 'public' AND NEW.source <> 'email' THEN
        PERFORM public.queue_customer_ticket_email(
            'customer_ticket_reply',
            NEW.tenant_id,
            jsonb_build_object('ticketId', NEW.ticket_id, 'messageId', NEW.id)
        );
    END IF;

    IF NEW.author_type = 'customer' THEN
        BEGIN
            SELECT * INTO v_ticket
            FROM public.tickets
            WHERE id = NEW.ticket_id;

            IF v_ticket.assignee_user_id IS NOT NULL THEN
                SELECT nullif(trim(c.full_name), '')
                INTO v_customer
                FROM public.customers c
                WHERE c.id = v_ticket.requester_customer_id;

                INSERT INTO public.notifications (tenant_id, user_id, type, payload_json)
                VALUES (
                    v_ticket.tenant_id,
                    v_ticket.assignee_user_id,
                    'ticket_updated',
                    jsonb_build_object(
                        'ticket_id', v_ticket.id,
                        'ticket_number', v_ticket.number,
                        'subject', v_ticket.subject,
                        'title', coalesce(v_customer, 'The customer')
                            || ' replied on #' || v_ticket.number,
                        'body', left(regexp_replace(NEW.body, '\s+', ' ', 'g'), 200)
                    )
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'notify_ticket_message(%) customer reply: %', NEW.id, SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_ticket_message() FROM public, anon, authenticated;

------------------------------------------------------------
-- 4. Purge sent mail that was not a ticket reply, like other private mail
------------------------------------------------------------

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

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'email-purge-private-events') THEN
        PERFORM cron.unschedule('email-purge-private-events');
    END IF;
END
$$;

SELECT cron.schedule(
    'email-purge-private-events',
    '17 3 * * *',
    $$ SELECT public.email_purge_private_events(); $$
);

COMMIT;
