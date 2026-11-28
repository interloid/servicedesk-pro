-- ==========================================================
-- File: 31_email_inbound_events.sql
-- Description: Inbound email ledger, retry queue and monitoring list
-- Canonical copy; the change ships in migration 20261127120000_email_to_ticket.sql.
-- ==========================================================

--
-- One row per provider message the sync saw: the dedupe ledger, the
-- per-message retry queue and the admin's monitoring list at once. Holds
-- headers only -- the body is fetched from the provider when processed, so
-- message content is not copied into a second table.

CREATE TABLE IF NOT EXISTS public.email_inbound_events
(
    id uuid primary key
        default gen_random_uuid(),

    tenant_id uuid
        not null
        references public.tenants(id)
        on delete cascade,

    integration_id uuid
        not null,

    provider text
        not null,

    provider_message_id text
        not null,

    provider_thread_id text,

    sender_email citext,

    sender_name text,

    -- The support address the email matched (filled once it is filtered).
    recipient_email citext,

    subject text,

    -- RFC 5322 headers, as received.
    message_id text,

    in_reply_to text,

    references_header text,

    status text
        not null
        default 'pending',

    -- Why an email was ignored: not_support_address, auto_generated,
    -- sender_is_team, unknown_sender, duplicate_message, ...
    ignore_reason text,

    -- ticket_created | reply_appended, once committed.
    outcome text,

    ticket_id uuid,

    ticket_message_id uuid,

    customer_id uuid,

    retry_count integer
        not null
        default 0,

    max_retries integer
        not null
        default 4,

    next_attempt_at timestamptz
        not null
        default now(),

    locked_at timestamptz,

    error_message text,

    -- temporary | permanent
    error_category text,

    received_at timestamptz,

    processed_at timestamptz,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    constraint email_inbound_events_status_check
        check (status in ('pending', 'processing', 'processed', 'ignored', 'failed')),

    constraint email_inbound_events_outcome_check
        check (outcome is null or outcome in ('ticket_created', 'reply_appended', 'agent_reply_appended')),

    constraint email_inbound_events_error_category_check
        check (error_category is null or error_category in ('temporary', 'permanent')),

    -- The same provider message never produces two events.
    constraint uq_email_inbound_message
        unique (integration_id, provider_message_id),

    constraint email_inbound_events_integration_fkey
        foreign key (tenant_id, integration_id)
        references public.tenant_email_integrations (tenant_id, id)
        on delete cascade,

    -- Tenant-consistent references (SEC-032). SET NULL on the one column only,
    -- so deleting a ticket keeps the event (and its tenant) for the record.
    constraint email_inbound_events_ticket_fkey
        foreign key (tenant_id, ticket_id)
        references public.tickets (tenant_id, id)
        on delete set null (ticket_id),

    constraint email_inbound_events_message_fkey
        foreign key (tenant_id, ticket_message_id)
        references public.ticket_messages (tenant_id, id)
        on delete set null (ticket_message_id),

    constraint email_inbound_events_customer_fkey
        foreign key (tenant_id, customer_id)
        references public.customers (tenant_id, id)
        on delete set null (customer_id)
);

COMMENT ON TABLE public.email_inbound_events IS
'Every inbound email the sync saw: idempotency ledger, retry queue and monitoring list. Headers only, never bodies.';

CREATE INDEX IF NOT EXISTS idx_email_inbound_events_tenant_created
    ON public.email_inbound_events (tenant_id, created_at DESC);

-- The worker's claim: due work per mailbox.
CREATE INDEX IF NOT EXISTS idx_email_inbound_events_due
    ON public.email_inbound_events (integration_id, next_attempt_at)
    WHERE status IN ('pending', 'processing');

-- Threading and the Message-ID dedupe.
CREATE INDEX IF NOT EXISTS idx_email_inbound_events_message_id
    ON public.email_inbound_events (tenant_id, message_id)
    WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_inbound_events_ticket
    ON public.email_inbound_events (ticket_id)
    WHERE ticket_id IS NOT NULL;
