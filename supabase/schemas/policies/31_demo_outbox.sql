-- =====================================================
-- File: 31_demo_outbox.sql
-- =====================================================
--
-- Captured demo emails can hold working invite and sign-in links for new
-- accounts in the workspace, including a pending Tenant Admin's or Manager's
-- invite. So only the workspace's Tenant Admins read them -- an Agent or
-- Manager reading an admin invite could take that role. Rows are written only
-- by the service role (the email Edge Functions), so there is no client write.
-- Migration: 20261112140000_demo_outbox.sql.

ALTER TABLE public.demo_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.demo_outbox FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.demo_outbox FROM authenticated;
GRANT SELECT ON public.demo_outbox TO authenticated;

CREATE POLICY "demo_outbox_select"
ON public.demo_outbox
FOR SELECT
TO authenticated
USING (
    tenant_id = public.current_tenant_id()
    AND public.is_active_membership()
    AND public.current_tenant_role() = 'tenant_admin'
);
