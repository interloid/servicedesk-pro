-- ==========================================================
-- File: 28_demo_outbox.sql
-- Description: Emails captured instead of sent on a public demo
-- ==========================================================
--
-- With EMAIL_DEMO_OUTBOX on, the Edge Functions store mail for anyone outside
-- EMAIL_ALLOWED_RECIPIENTS here rather than sending it, and the workspace's
-- Tenant Admins read it on Settings -> Demo outbox. Written only by the
-- service role; see policies/31_demo_outbox.sql.

CREATE TABLE IF NOT EXISTS public.demo_outbox
(
    id uuid primary key
        default gen_random_uuid(),

    tenant_id uuid
        not null
        references public.tenants(id)
        on delete cascade,

    -- team_invitation, customer_invitation, portal_sign_in, notification,
    -- customer_ticket, invoice.
    kind text
        not null,

    recipient text
        not null,

    subject text
        not null,

    html text
        not null,

    text text
        not null
        default '',

    -- The sign-in link was replaced by a note (the account isn't new).
    link_withheld boolean
        not null
        default false,

    created_at timestamptz
        not null
        default now()
);

CREATE INDEX IF NOT EXISTS idx_demo_outbox_tenant_created
    ON public.demo_outbox (tenant_id, created_at DESC);
