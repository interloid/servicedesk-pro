-- Support impersonation. Migration 20261117160000.

SELECT authz.expect_refused(
    format('%s cannot read impersonation sessions', v.role),
    CASE WHEN v.role = 'authenticated'
         THEN authz.claims('a_admin', 'a_tenant', 'tenant_admin') END,
    v.role,
    'SELECT 1 FROM public.impersonation_sessions',
    ARRAY['0rows', '42501']
)
FROM (VALUES ('anon'), ('authenticated')) AS v(role);

SELECT authz.expect_refused(
    'a tenant admin cannot start an impersonation record',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format(
        $sql$INSERT INTO public.impersonation_sessions
            (auth_session_id, request_id, tenant_id, target_user_id,
             platform_admin_id, platform_admin_email, expires_at)
            VALUES (gen_random_uuid(), %L, %L, %L, gen_random_uuid(), 'x@y.z', now() + interval '1 hour')$sql$,
        authz.id('a_support_request'), authz.id('a_tenant'), authz.id('a_admin')
    ),
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'a signed-in user cannot end anyone''s session through the database',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    'SELECT public.end_impersonation_session(gen_random_uuid(), ''x'')',
    ARRAY['42501']
);

SELECT authz.expect_rows(
    'control',
    'an ordinary session is not an impersonation',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    'SELECT 1 WHERE public.impersonation_state() IS NULL',
    1
);

SELECT authz.expect_rows(
    'control',
    'a browser cannot label its own audit entries as platform support',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    $sql$SELECT 1 WHERE (
        SELECT set_config('request.headers', '{"x-audit-impersonator": "forged@x.y"}', true)
    ) IS NOT NULL AND public.audit_impersonator() IS NULL$sql$,
    1
);
