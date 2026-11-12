-- Demo outbox (migration 20261112140000): captured emails can hold working
-- invite links, so only the workspace's Tenant Admins read them, and nobody
-- but the service role writes them.

SELECT authz.expect_rows(
    'control',
    'a Tenant Admin reads their workspace''s Demo outbox',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    'SELECT 1 FROM public.demo_outbox',
    1
);

SELECT authz.expect_refused(
    'a Manager cannot read the Demo outbox (it can hold an admin invite link)',
    authz.claims('a_manager', 'a_tenant', 'manager'),
    'authenticated',
    'SELECT 1 FROM public.demo_outbox',
    ARRAY['0rows', '42501']
);

SELECT authz.expect_refused(
    'an Agent cannot read the Demo outbox',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    'SELECT 1 FROM public.demo_outbox',
    ARRAY['0rows', '42501']
);

SELECT authz.expect_refused(
    'a customer cannot read the Demo outbox',
    authz.claims('a_customer_user', 'a_tenant', 'customer'),
    'authenticated',
    'SELECT 1 FROM public.demo_outbox',
    ARRAY['0rows', '42501']
);

SELECT authz.expect_refused(
    'anon cannot read the Demo outbox',
    NULL,
    'anon',
    'SELECT 1 FROM public.demo_outbox',
    ARRAY['0rows', '42501']
);

SELECT authz.expect_refused(
    'a Tenant Admin cannot write to the Demo outbox',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format(
        $sql$INSERT INTO public.demo_outbox (tenant_id, kind, recipient, subject, html)
             VALUES (%L, 'team_invitation', 'x@example.test', 'Fake', '<p>x</p>')$sql$,
        authz.id('a_tenant')
    ),
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'a Tenant Admin cannot delete from the Demo outbox',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    'DELETE FROM public.demo_outbox',
    ARRAY['0rows', '42501']
);

SELECT authz.expect_rows(
    'control',
    'a workspace''s Demo outbox is deleted with the workspace (ON DELETE CASCADE)',
    NULL,
    'service_role',
    $sql$SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.demo_outbox'::regclass
           AND confrelid = 'public.tenants'::regclass
           AND contype = 'f' AND confdeltype = 'c'$sql$,
    1
);
