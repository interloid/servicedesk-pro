-- ==========================================================
-- File: 32_email_sync_jobs.sql
-- Description: Mailbox sync / watch job queue (server-only)
-- Canonical copy; the change ships in migration 20261127120000_email_to_ticket.sql.
-- ==========================================================

--
-- Same shape and claim as email_jobs. Two kinds:
--   sync   read the mailbox's history after the saved cursor, record new
--          messages as events, then process the events that are due
--   watch  (re)register the provider's push subscription
--
-- At most one pending job per mailbox and kind: a burst of Pub/Sub
-- notifications for the same mailbox collapses into one job. The cursor is
-- the integration's own, so the notified historyId is only kept as the
-- highest seen, for diagnostics.

CREATE TABLE IF NOT EXISTS public.email_sync_jobs
(
    id uuid primary key
        default gen_random_uuid(),

    tenant_id uuid
        not null
        references public.tenants(id)
        on delete cascade,

    integration_id uuid
        not null,

    kind text
        not null
        default 'sync',

    -- push | reconcile | retry | connect | manual | renewal
    reason text
        not null
        default 'push',

    history_id text,

    status text
        not null
        default 'pending',

    attempts integer
        not null
        default 0,

    max_attempts integer
        not null
        default 5,

    run_after timestamptz
        not null
        default now(),

    locked_at timestamptz,

    last_error text,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    completed_at timestamptz,

    constraint email_sync_jobs_kind_check
        check (kind in ('sync', 'watch')),

    constraint email_sync_jobs_status_check
        check (status in ('pending', 'processing', 'completed', 'failed')),

    constraint email_sync_jobs_integration_fkey
        foreign key (tenant_id, integration_id)
        references public.tenant_email_integrations (tenant_id, id)
        on delete cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_sync_jobs_pending
    ON public.email_sync_jobs (integration_id, kind)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_email_sync_jobs_due
    ON public.email_sync_jobs (run_after)
    WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_email_sync_jobs_finished
    ON public.email_sync_jobs (completed_at)
    WHERE status IN ('completed', 'failed');
