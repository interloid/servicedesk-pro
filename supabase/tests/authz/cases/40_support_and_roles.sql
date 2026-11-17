-- Support requests and the roles catalogue. Migrations 20261117120000 and
-- 20261117130000. Clients only read these tables; every write goes through the
-- server with the service role.

-- support_requests: the workspace's tenant admin only ---------------------------

SELECT authz.expect_rows(
    'flow',
    'a tenant admin reads their workspace''s support request',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format('SELECT 1 FROM public.support_requests WHERE id = %L', authz.id('a_support_request')),
    1
);

SELECT authz.expect_rows(
    'flow',
    'a tenant admin reads the messages on their support request',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format('SELECT 1 FROM public.support_request_messages WHERE request_id = %L', authz.id('a_support_request')),
    1
);

SELECT authz.expect_refused(
    format('%s cannot read their workspace''s support requests', v.role),
    authz.claims(v.usr, 'a_tenant', v.role),
    'authenticated',
    format('SELECT 1 FROM public.support_requests WHERE id = %L', authz.id('a_support_request')),
    ARRAY['0rows', '42501']
)
FROM (VALUES
    ('a_manager', 'manager'),
    ('a_agent', 'agent'),
    ('a_billing', 'billing_admin'),
    ('a_customer_user', 'customer')
) AS v(usr, role);

SELECT authz.expect_refused(
    'an agent cannot read the messages on a support request',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format('SELECT 1 FROM public.support_request_messages WHERE request_id = %L', authz.id('a_support_request')),
    ARRAY['0rows', '42501']
);

SELECT authz.expect_refused(
    'a tenant admin cannot read another workspace''s support request messages',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format('SELECT 1 FROM public.support_request_messages WHERE request_id = %L', authz.id('b_support_request')),
    ARRAY['0rows', '42501']
);

SELECT authz.expect_refused(
    'a tenant admin cannot grant workspace access by updating the request directly',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format(
        $sql$UPDATE public.support_requests
            SET allow_workspace_access = true, access_expires_at = now() + interval '1 year'
            WHERE id = %L$sql$,
        authz.id('a_support_request')
    ),
    ARRAY['0rows', '42501']
);

SELECT authz.expect_refused(
    'a tenant admin cannot insert a support request directly',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format(
        $sql$INSERT INTO public.support_requests (tenant_id, subject, description)
            VALUES (%L, 'Direct insert', 'Skipping the server action.')$sql$,
        authz.id('a_tenant')
    ),
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'a tenant admin cannot post a message as the platform team',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format(
        $sql$INSERT INTO public.support_request_messages (request_id, author_type, author_name, body)
            VALUES (%L, 'platform', 'Platform Support', 'Your account is suspended.')$sql$,
        authz.id('a_support_request')
    ),
    ARRAY['42501']
);

-- roles: readable, never writable by clients -----------------------------------

SELECT authz.expect_rows(
    'flow',
    'a signed-in member reads the built-in roles',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    'SELECT 1 FROM public.roles WHERE is_system',
    6
);

SELECT authz.expect_refused(
    'a tenant admin cannot create a role',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    $sql$INSERT INTO public.roles (key, name, base_role) VALUES ('boss', 'Boss', 'tenant_admin')$sql$,
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'a tenant admin cannot re-tier a role',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    $sql$UPDATE public.roles SET base_role = 'tenant_admin' WHERE key = 'agent'$sql$,
    ARRAY['0rows', '42501']
);

SELECT authz.expect_refused(
    'an agent cannot promote themselves by changing their membership role_id',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        $sql$UPDATE public.memberships
            SET role_id = (SELECT id FROM public.roles WHERE key = 'tenant_admin')
            WHERE user_id = %L$sql$,
        authz.id('a_agent')
    ),
    ARRAY['0rows', '42501']
);
