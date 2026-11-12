-- =====================================================
-- File: rls_memberships.sql
-- Description: RLS Policies for Memberships
-- =====================================================

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SELECT
-- Staff can view the tenant's memberships; a customer
-- sees only their own. SEC-029, migration 20261112120000.
-- =====================================================

CREATE POLICY "memberships_select"
ON public.memberships
FOR SELECT
TO authenticated
USING (
    tenant_id = public.current_tenant_id()
    AND (
        user_id = auth.uid()
        OR public.current_tenant_role() IN (
            'tenant_admin',
            'manager',
            'agent',
            'billing_admin'
        )
    )
);

-- =====================================================
-- INSERT, UPDATE, DELETE
-- No client policies: the service role writes memberships,
-- after server code has checked the caller. Ownership
-- transfer and the token hook are SECURITY DEFINER.
-- =====================================================
