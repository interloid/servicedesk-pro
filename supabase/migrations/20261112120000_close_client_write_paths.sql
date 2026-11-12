-- Close the direct-API write and read paths that the app never uses but a
-- signed-in or anonymous caller could reach with the public anon key.
-- Tracker: SEC-031, SEC-007, SEC-008, SEC-004, SEC-029
-- (docs/security/security-remediation-tracker.md).
--
-- Every change below removes a path that no application code takes:
--   * provision_tenant is called only with the service role
--     (src/features/onboarding/services/onboarding.service.ts).
--   * Workspaces are created by provision_tenant and never deleted by the app.
--   * Avatars are uploaded through signed upload URLs minted by the service role
--     and removed by the service role (users/services/user-service.ts,
--     portal/services/portal.service.ts).
--   * Invoice PDFs are written by the paypal-webhook function (service role).
--   * Customers read only their own users row; the portal reads staff names
--     through the service role (portal.service.ts).
-- Mirrors supabase/schemas/functions/provision_tenant.sql,
-- policies/02_tenants.sql, 03_users.sql, 04_memberships.sql,
-- policies/storage/avatars.sql and policies/storage/invoices.sql.

------------------------------------------------------------
-- SEC-031: anyone could create a paid-plan workspace
------------------------------------------------------------
-- provision_tenant is SECURITY DEFINER and takes the plan, owner and email as
-- arguments, so with EXECUTE an anonymous caller could create a Business-plan
-- workspace without paying and claim any email address. Functions are
-- executable by PUBLIC by default, and the hosted default privileges also grant
-- anon and authenticated, so all three are revoked, for every overload.

DO $$
DECLARE
    fn regprocedure;
BEGIN
    FOR fn IN
        SELECT p.oid::regprocedure
        FROM pg_proc AS p
        WHERE p.pronamespace = 'public'::regnamespace
          AND p.proname = 'provision_tenant'
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END LOOP;
END
$$;

------------------------------------------------------------
-- SEC-007: a Tenant Admin could insert or delete workspaces directly
------------------------------------------------------------
-- Deleting through the API removed a workspace's data without cancelling its
-- PayPal agreement; inserting could reserve slugs or pick any plan.

DROP POLICY IF EXISTS "tenants_insert" ON public.tenants;
DROP POLICY IF EXISTS "tenants_delete" ON public.tenants;

------------------------------------------------------------
-- SEC-004: avatar writes trusted user-editable metadata
------------------------------------------------------------
-- The policies accepted user_metadata.tenant_id, which any user can set on
-- their own account, so a user of one workspace could write to or delete from
-- another workspace's avatar folder. The app never writes avatars with a user
-- token, so client writes are removed altogether. Reads stay public.

DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;

------------------------------------------------------------
-- SEC-008: invoice PDFs were writable through the storage API
------------------------------------------------------------

DROP POLICY IF EXISTS "invoices_insert" ON storage.objects;
DROP POLICY IF EXISTS "invoices_update" ON storage.objects;
DROP POLICY IF EXISTS "invoices_delete" ON storage.objects;

------------------------------------------------------------
-- SEC-029: customers could list every member of the workspace
------------------------------------------------------------
-- Staff keep the team list. A customer sees only their own membership and
-- their own profile row.

DROP POLICY IF EXISTS "memberships_select" ON public.memberships;

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

DROP POLICY IF EXISTS "users_select" ON public.users;

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
            FROM public.memberships AS m
            WHERE m.user_id = users.id
              AND m.tenant_id = public.current_tenant_id()
        )
    )
);
