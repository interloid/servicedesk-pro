-- =====================================================
-- File: rls_tenants.sql
-- Description: RLS Policies for Tenants
-- =====================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SELECT
-- Users can only view their own tenant
-- =====================================================

CREATE POLICY "tenants_select"
ON public.tenants
FOR SELECT
TO authenticated
USING (
    id = public.current_tenant_id()
);

-- =====================================================
-- INSERT, DELETE
-- No client policies. Workspaces are created by
-- provision_tenant (service role) and never deleted by
-- the app; a direct delete skipped the PayPal
-- cancellation. SEC-007, migration 20261112120000.
-- =====================================================

-- =====================================================
-- UPDATE
-- Only tenant_admin can update tenant details
-- =====================================================

CREATE POLICY "tenants_update"
ON public.tenants
FOR UPDATE
TO authenticated
USING (
    id = public.current_tenant_id()
    AND public.current_tenant_role() = 'tenant_admin'
)
WITH CHECK (
    id = public.current_tenant_id()
    AND public.current_tenant_role() = 'tenant_admin'
);
