-- =====================================================
-- File: rls_memberships.sql
-- Description: RLS Policies for Memberships
-- =====================================================

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SELECT
-- Tenant members can view memberships
-- =====================================================

CREATE POLICY "memberships_select"
ON public.memberships
FOR SELECT
TO authenticated
USING (
    tenant_id = public.current_tenant_id()
);

-- =====================================================
-- INSERT, UPDATE, DELETE
-- No client policies: the service role writes memberships,
-- after server code has checked the caller. Ownership
-- transfer and the token hook are SECURITY DEFINER.
-- =====================================================
