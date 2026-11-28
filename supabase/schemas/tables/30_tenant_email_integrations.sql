-- ==========================================================
-- File: 30_tenant_email_integrations.sql
-- Description: Connected support mailboxes (email-to-ticket)
-- Canonical copy; the change ships in migration 20261127120000_email_to_ticket.sql.
-- ==========================================================

--
-- One connected mailbox. Business rules, as partial unique indexes over the
-- rows that are not disconnected (a disconnected row stays for its history):
--   * one live integration per provider per workspace;
--   * a mailbox can be connected to one workspace at a time -- otherwise one
--     Gmail notification would file tickets into two tenants.
-- receiving_email is deliberately NOT unique across workspaces: mail is routed
-- by the mailbox it arrived in, never by address, so a uniqueness rule would
-- only let one workspace squat another's support address.
--
-- provider is a check list, not an enum, so adding 'outlook' is one ALTER.
-- Tokens are AES-256-GCM ciphertext (EMAIL_ENCRYPTION_KEY, never in the
-- database) and are not granted to the API roles at all, see section 6.

CREATE TABLE IF NOT EXISTS public.tenant_email_integrations
(
    id uuid primary key
        default gen_random_uuid(),

    tenant_id uuid
        not null
        references public.tenants(id)
        on delete cascade,

    provider text
        not null,

    -- The mailbox OAuth was granted for, as the provider reports it.
    connected_email citext
        not null,

    -- The address customers write to. The connected mailbox, or an alias that
    -- lands in it (admin+support@gmail.com). Only mail to this is filed.
    receiving_email citext
        not null,

    access_token_encrypted text,

    refresh_token_encrypted text,

    token_expires_at timestamptz,

    granted_scopes text,

    -- Gmail's history cursor: the sync reads changes after it.
    provider_history_id text,

    watch_expiration timestamptz,

    auto_create_customer boolean
        not null
        default true,

    enabled boolean
        not null
        default true,

    status text
        not null
        default 'connecting',

    last_sync_at timestamptz,

    last_error text,

    last_error_at timestamptz,

    -- One sync at a time per mailbox (email_acquire_integration_lease).
    sync_lease_owner uuid,

    sync_lease_until timestamptz,

    connected_by uuid
        references public.users(id)
        on delete set null,

    disconnected_at timestamptz,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    constraint tenant_email_integrations_provider_check
        check (provider in ('gmail')),

    constraint tenant_email_integrations_status_check
        check (status in ('connecting', 'connected', 'expired', 'error', 'disconnected')),

    constraint tenant_email_integrations_receiving_email_check
        check (receiving_email::text ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),

    -- A live integration has credentials; a disconnected one has none left.
    constraint tenant_email_integrations_tokens_check
        check (
            status <> 'disconnected'
            or (access_token_encrypted is null and refresh_token_encrypted is null)
        ),

    constraint tenant_email_integrations_tenant_id_id_key
        unique (tenant_id, id)
);

COMMENT ON TABLE public.tenant_email_integrations IS
'Connected support mailboxes (email-to-ticket). Tokens are encrypted by the app and never granted to API roles.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_integration_tenant_provider
    ON public.tenant_email_integrations (tenant_id, provider)
    WHERE status <> 'disconnected';

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_integration_mailbox
    ON public.tenant_email_integrations (provider, connected_email)
    WHERE status <> 'disconnected';

CREATE INDEX IF NOT EXISTS idx_email_integrations_tenant
    ON public.tenant_email_integrations (tenant_id);

-- Watch renewal and reconciliation scan the live ones.
CREATE INDEX IF NOT EXISTS idx_email_integrations_live
    ON public.tenant_email_integrations (watch_expiration)
    WHERE status IN ('connected', 'error');
