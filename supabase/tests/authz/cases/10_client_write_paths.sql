-- Direct-API paths the app never takes (SEC-031, SEC-007, SEC-004, SEC-008,
-- SEC-029). Migration 20261112120000.

-- provision_tenant: only the service role may create a workspace ---------------

SELECT authz.expect_refused(
    'anon cannot create a Business workspace with provision_tenant',
    NULL,
    'anon',
    format(
        $sql$SELECT * FROM public.provision_tenant(%L, 'newcomer@authz.test', 'New Comer',
            'Free Riders', 'free-riders', %L, %L, '["mon"]', '09:00', '17:00', '[]')$sql$,
        authz.id('newcomer'),
        (SELECT id FROM public.plans WHERE name = 'Business'),
        (SELECT id FROM public.timezones ORDER BY id LIMIT 1)
    ),
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'a signed-in user cannot call provision_tenant',
    authz.claims('outsider'),
    'authenticated',
    format(
        $sql$SELECT * FROM public.provision_tenant(%L, 'newcomer@authz.test', 'New Comer',
            'Free Riders', 'free-riders', %L, %L, '["mon"]', '09:00', '17:00', '[]')$sql$,
        authz.id('newcomer'),
        (SELECT id FROM public.plans WHERE name = 'Business'),
        (SELECT id FROM public.timezones ORDER BY id LIMIT 1)
    ),
    ARRAY['42501']
);

SELECT authz.expect_allowed(
    'the service role still provisions a workspace (sign-up path)',
    NULL,
    'service_role',
    format(
        $sql$SELECT * FROM public.provision_tenant(%L, 'newcomer@authz.test', 'New Comer',
            'New Workspace', 'new-workspace', %L, %L, '["mon"]', '09:00', '17:00', '[]')$sql$,
        authz.id('newcomer'),
        (SELECT id FROM public.plans WHERE name = 'Free'),
        (SELECT id FROM public.timezones ORDER BY id LIMIT 1)
    )
);

-- tenants: no direct insert or delete --------------------------------------------

SELECT authz.expect_refused(
    'a tenant admin cannot insert a workspace directly',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format(
        $sql$INSERT INTO public.tenants (name, slug, plan_id) VALUES ('Squatter', 'squatter', %L)$sql$,
        (SELECT id FROM public.plans WHERE name = 'Business')
    ),
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'a tenant admin cannot delete their workspace directly',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format('DELETE FROM public.tenants WHERE id = %L', authz.id('a_tenant')),
    ARRAY['0rows']
);

SELECT authz.expect_allowed(
    'a tenant admin can still rename their workspace',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format($sql$UPDATE public.tenants SET name = 'Alpha Support Ltd' WHERE id = %L$sql$, authz.id('a_tenant'))
);

-- avatars: no client writes --------------------------------------------------------

SELECT authz.expect_refused(
    'a user of another workspace cannot upload into its avatar folder by spoofing user_metadata',
    authz.claims('b_admin', 'b_tenant', 'tenant_admin')
        || jsonb_build_object('user_metadata', jsonb_build_object('tenant_id', authz.id('a_tenant'))),
    'authenticated',
    format(
        $sql$INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars', %L)$sql$,
        authz.id('a_tenant') || '/x/evil.png'
    ),
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'a customer cannot overwrite a staff member''s avatar',
    authz.claims('a_customer_user', 'a_tenant', 'customer'),
    'authenticated',
    format(
        $sql$UPDATE storage.objects SET name = name WHERE bucket_id = 'avatars' AND name LIKE %L$sql$,
        authz.id('a_tenant') || '/%'
    ),
    ARRAY['0rows']
);

SELECT authz.expect_refused(
    'a tenant admin cannot delete avatars directly',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    $sql$DELETE FROM storage.objects WHERE bucket_id = 'avatars'$sql$,
    ARRAY['0rows']
);

SELECT authz.expect_allowed(
    'avatars stay publicly readable',
    NULL,
    'anon',
    $sql$SELECT 1 FROM storage.objects WHERE bucket_id = 'avatars'$sql$,
    2
);

-- invoice PDFs: written only by the webhook ----------------------------------------

SELECT authz.expect_refused(
    'a tenant admin cannot upload an invoice PDF',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format(
        $sql$INSERT INTO storage.objects (bucket_id, name) VALUES ('invoices', %L)$sql$,
        authz.id('a_tenant') || '/invoice-2.pdf'
    ),
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'a billing admin cannot replace an invoice PDF',
    authz.claims('a_billing', 'a_tenant', 'billing_admin'),
    'authenticated',
    $sql$UPDATE storage.objects SET name = name WHERE bucket_id = 'invoices'$sql$,
    ARRAY['0rows']
);

SELECT authz.expect_refused(
    'a tenant admin cannot delete an invoice PDF',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    $sql$DELETE FROM storage.objects WHERE bucket_id = 'invoices'$sql$,
    ARRAY['0rows']
);

SELECT authz.expect_allowed(
    'a billing admin can still read their own invoice PDFs',
    authz.claims('a_billing', 'a_tenant', 'billing_admin'),
    'authenticated',
    $sql$SELECT 1 FROM storage.objects WHERE bucket_id = 'invoices'$sql$
);

-- members: customers see only themselves -------------------------------------------

SELECT authz.expect_rows(
    'attack',
    'a customer sees only their own membership',
    authz.claims('a_customer_user', 'a_tenant', 'customer'),
    'authenticated',
    'SELECT 1 FROM public.memberships',
    1
);

SELECT authz.expect_rows(
    'attack',
    'a customer sees only their own profile, not staff names and emails',
    authz.claims('a_customer_user', 'a_tenant', 'customer'),
    'authenticated',
    'SELECT 1 FROM public.users',
    1
);

SELECT authz.expect_rows(
    'control',
    'an agent still sees the whole team',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    'SELECT 1 FROM public.memberships',
    5
);

SELECT authz.expect_rows(
    'control',
    'an agent still sees every member''s profile',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    'SELECT 1 FROM public.users',
    5
);

SELECT authz.expect_rows(
    'control',
    'a billing admin still sees the team',
    authz.claims('a_billing', 'a_tenant', 'billing_admin'),
    'authenticated',
    'SELECT 1 FROM public.memberships',
    5
);
