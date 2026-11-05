-- =====================================================
-- File: 18_invoices.sql
-- Description: RLS Policies for Invoices
-- =====================================================

ALTER TABLE public.invoices
ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- SELECT
-- Tenant Admin + Billing Admin
-- =====================================================

CREATE POLICY "invoices_select"
ON public.invoices
FOR SELECT
TO authenticated
USING (
    tenant_id = public.current_tenant_id()
    AND public.is_active_membership()
    AND public.current_tenant_role() IN (
        'tenant_admin',
        'billing_admin'
    )
);

-- No INSERT, UPDATE or DELETE for signed-in users. Invoices are written
-- only by the service role (the billing Edge Functions): a client write could
-- grant a paid plan or forge payment records.
