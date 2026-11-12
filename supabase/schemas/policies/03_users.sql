-- =====================================================
-- File: 03_users.sql
-- Description: RLS Policies for Users
-- =====================================================

ALTER TABLE public.users
ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- SELECT
-- Users can view:
-- 1. Their own profile
-- 2. As staff, users belonging to the current tenant
--    (any membership status: the team screen renders
--    invited and disabled members too)
-- Customers see only their own row; the portal reads
-- staff names through the service role. SEC-029,
-- migration 20261112120000.
-- =====================================================

CREATE POLICY "users_select"
ON public.users
FOR SELECT
TO authenticated
USING (
    id = auth.uid()

    OR (
        public.current_tenant_role() IN (
            'tenant_admin',
            'manager',
            'agent',
            'billing_admin'
        )
        AND EXISTS (
            SELECT 1
            FROM public.memberships m
            WHERE m.user_id = public.users.id
              AND m.tenant_id = public.current_tenant_id()
        )
    )
);


-- =====================================================
-- INSERT
-- Users can create their own profile
-- =====================================================

CREATE POLICY "users_insert"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
    id = auth.uid()
);


-- =====================================================
-- UPDATE
-- Users can update their own profile
-- =====================================================

CREATE POLICY "users_update"
ON public.users
FOR UPDATE
TO authenticated
USING (
    id = auth.uid()
)
WITH CHECK (
    id = auth.uid()
);


-- =====================================================
-- DELETE
-- No client policy: this table is global, and deleting a
-- row removes the person from every workspace.
-- =====================================================
