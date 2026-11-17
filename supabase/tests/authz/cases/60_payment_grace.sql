-- Grace period for failed payments. Migration 20261117150000.
-- Payment trouble ends in the Free plan, never a blocked workspace.

SELECT authz.expect_rows(
    'control',
    'a subscription ended after its grace period leaves the workspace open',
    NULL,
    'service_role',
    format(
        $sql$WITH s AS (
                UPDATE public.subscriptions
                SET cancellation_source = 'system', cancelled_at = now(),
                    payment_failure_count = 3
                WHERE tenant_id = %1$L
                RETURNING tenant_id
            )
            SELECT 1 FROM public.tenants t, s
            WHERE t.id = %1$L AND t.status = 'active' AND t.block_source IS NULL$sql$,
        authz.id('a_tenant')
    ),
    1
);

SELECT authz.expect_rows(
    'control',
    'PayPal cancelling during payment trouble leaves the workspace open',
    NULL,
    'service_role',
    format(
        $sql$WITH s AS (
                UPDATE public.subscriptions
                SET cancellation_source = 'paypal', grace_period_ends_at = now() + interval '14 days',
                    payment_failure_count = 1
                WHERE tenant_id = %1$L
                RETURNING tenant_id
            )
            SELECT 1 FROM public.tenants t, s
            WHERE t.id = %1$L AND t.status = 'active'$sql$,
        authz.id('a_tenant')
    ),
    1
);

SELECT authz.expect_refused(
    'the grace period cannot be set outside 1 to 30 days',
    NULL,
    'service_role',
    'UPDATE public.platform_settings SET payment_grace_days = 0 WHERE id',
    ARRAY['23514']
);

SELECT authz.expect_refused(
    'a signed-in user cannot change the grace period',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    'UPDATE public.platform_settings SET payment_grace_days = 30 WHERE id',
    ARRAY['0rows', '42501']
);
