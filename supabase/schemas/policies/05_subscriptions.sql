-- =====================================================
-- File: 05_subscriptions.sql
-- Description: RLS Policies for Subscriptions
-- =====================================================

ALTER TABLE public.subscriptions
ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- SELECT
-- Tenant Admin + Billing Admin
-- =====================================================

CREATE POLICY "subscriptions_select"
ON public.subscriptions
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

-- No INSERT, UPDATE or DELETE for signed-in users. Subscriptions are written
-- only by the service role (the billing Edge Functions): a client write could
-- grant a paid plan or forge payment records.
