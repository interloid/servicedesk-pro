-- Platform admin permissions. Migration 20261117140000.

-- Audit logs: append-only and immutable, for every API role -------------------

SELECT authz.expect_refused(
    format('%s cannot change an audit entry', v.role),
    CASE WHEN v.role = 'authenticated'
         THEN authz.claims('a_admin', 'a_tenant', 'tenant_admin') END,
    v.role,
    format(
        $sql$UPDATE public.audit_logs SET meta_json = '{}'::jsonb WHERE tenant_id = %L$sql$,
        authz.id('a_tenant')
    ),
    ARRAY['0rows', '42501']
)
FROM (VALUES ('authenticated'), ('service_role')) AS v(role);

SELECT authz.expect_refused(
    format('%s cannot delete an audit entry', v.role),
    CASE WHEN v.role = 'authenticated'
         THEN authz.claims('a_admin', 'a_tenant', 'tenant_admin') END,
    v.role,
    format('DELETE FROM public.audit_logs WHERE tenant_id = %L', authz.id('a_tenant')),
    ARRAY['0rows', '42501']
)
FROM (VALUES ('authenticated'), ('service_role')) AS v(role);

SELECT authz.expect_refused(
    'the service role cannot truncate the audit log',
    NULL,
    'service_role',
    'TRUNCATE public.audit_logs',
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'even the database owner cannot edit an audit entry',
    NULL,
    'postgres',
    format(
        $sql$UPDATE public.audit_logs SET meta_json = '{}'::jsonb WHERE tenant_id = %L$sql$,
        authz.id('a_tenant')
    ),
    ARRAY['42501']
);

SELECT authz.expect_allowed(
    'new audit entries are still written (append-only)',
    NULL,
    'service_role',
    format(
        $sql$INSERT INTO public.audit_logs (tenant_id, action, entity, module, meta_json)
            VALUES (%L, 'update', 'workspace', 'settings', '{"summary": "test"}')$sql$,
        authz.id('a_tenant')
    )
);

SELECT authz.expect_allowed(
    'a workspace removed by the database takes its audit entries with it (seed clean-up)',
    NULL,
    'service_role',
    format('DELETE FROM public.tenants WHERE id = %L', authz.id('b_tenant'))
);

-- Soft delete: deleted always means locked ------------------------------------

SELECT authz.expect_refused(
    'a workspace cannot be marked deleted while it is still active',
    NULL,
    'service_role',
    format('UPDATE public.tenants SET deleted_at = now() WHERE id = %L', authz.id('a_tenant')),
    ARRAY['23514']
);

SELECT authz.expect_allowed(
    'the console soft-deletes a workspace by locking and stamping it',
    NULL,
    'service_role',
    format(
        $sql$UPDATE public.tenants
            SET status = 'suspended', block_source = 'admin', blocked_at = now(),
                deleted_at = now(), delete_reason = 'Closed at the customer''s request'
            WHERE id = %L$sql$,
        authz.id('a_tenant')
    )
);

SELECT authz.expect_refused(
    'a tenant admin cannot mark their own workspace deleted',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    -- The guard keeps the old values, so the stamp must not come back set.
    format(
        $sql$WITH u AS (
                UPDATE public.tenants
                SET deleted_at = now(), delete_reason = 'Self-service delete'
                WHERE id = %L
                RETURNING deleted_at, delete_reason
            )
            SELECT 1 FROM u WHERE deleted_at IS NOT NULL OR delete_reason IS NOT NULL$sql$,
        authz.id('a_tenant')
    ),
    ARRAY['0rows', '42501']
);

-- Trial extension: service role only, trials without PayPal only ----------------

SELECT authz.expect_refused(
    format('%s cannot extend a trial', v.role),
    CASE WHEN v.role = 'authenticated'
         THEN authz.claims('a_admin', 'a_tenant', 'tenant_admin') END,
    v.role,
    format('SELECT public.platform_extend_trial(%L, 30)', authz.id('a_tenant')),
    ARRAY['42501']
)
FROM (VALUES ('anon'), ('authenticated')) AS v(role);

SELECT authz.expect_refused(
    'a trial cannot be extended by more than 90 days',
    NULL,
    'service_role',
    format('SELECT public.platform_extend_trial(%L, 365)', authz.id('a_tenant')),
    ARRAY['22023']
);
