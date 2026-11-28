-- ==========================================================
-- File: 31_email_integrations.sql
-- Description: RLS and column grants for the email-to-ticket tables
-- Canonical copy; the change ships in migration 20261127120000_email_to_ticket.sql.
-- ==========================================================

--
-- Reads only, and only for the workspace's Tenant Admin, with the membership
-- re-checked in the database (is_active_membership), not just the JWT. No
-- write policy: every change goes through a server action that checks the
-- caller and then uses the service role.
--
-- The token columns are not granted to authenticated at all -- column grants
-- below -- so even a policy mistake could not hand a browser ciphertext.

ALTER TABLE public.tenant_email_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_inbound_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sync_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tenant_email_integrations FROM anon, authenticated;
REVOKE ALL ON public.email_inbound_events FROM anon, authenticated;
REVOKE ALL ON public.email_sync_jobs FROM anon, authenticated;

GRANT ALL ON public.tenant_email_integrations TO service_role;
GRANT ALL ON public.email_inbound_events TO service_role;
GRANT ALL ON public.email_sync_jobs TO service_role;

GRANT SELECT (
    id,
    tenant_id,
    provider,
    connected_email,
    receiving_email,
    token_expires_at,
    provider_history_id,
    watch_expiration,
    auto_create_customer,
    enabled,
    status,
    last_sync_at,
    last_error,
    last_error_at,
    connected_by,
    disconnected_at,
    created_at,
    updated_at
) ON public.tenant_email_integrations TO authenticated;

GRANT SELECT (
    id,
    tenant_id,
    integration_id,
    provider,
    provider_message_id,
    sender_email,
    sender_name,
    recipient_email,
    subject,
    message_id,
    in_reply_to,
    references_header,
    status,
    ignore_reason,
    outcome,
    ticket_id,
    customer_id,
    retry_count,
    max_retries,
    next_attempt_at,
    error_message,
    error_category,
    received_at,
    processed_at,
    created_at,
    updated_at
) ON public.email_inbound_events TO authenticated;

DROP POLICY IF EXISTS "tenant_email_integrations_select" ON public.tenant_email_integrations;

CREATE POLICY "tenant_email_integrations_select"
ON public.tenant_email_integrations
FOR SELECT
TO authenticated
USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_tenant_role()) = 'tenant_admin'
    AND (SELECT public.is_active_membership())
);

DROP POLICY IF EXISTS "email_inbound_events_select" ON public.email_inbound_events;

CREATE POLICY "email_inbound_events_select"
ON public.email_inbound_events
FOR SELECT
TO authenticated
USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_tenant_role()) = 'tenant_admin'
    AND (SELECT public.is_active_membership())
);

-- email_sync_jobs: no policies -- service role only, like email_jobs.
