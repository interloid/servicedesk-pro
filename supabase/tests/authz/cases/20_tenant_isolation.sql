-- Tenant isolation: staff of Alpha against Bravo's records (SEC-032).
-- Migration 20261112130000 for the cross-workspace references.

-- Reading or changing another workspace's rows by id -------------------------------

SELECT authz.expect_refused(
    'a tenant admin cannot read another workspace''s ticket by id',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format('SELECT 1 FROM public.tickets WHERE id = %L', authz.id('b_ticket')),
    ARRAY['0rows']
);

SELECT authz.expect_refused(
    'a tenant admin cannot read another workspace''s messages',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format('SELECT 1 FROM public.ticket_messages WHERE ticket_id = %L', authz.id('b_ticket')),
    ARRAY['0rows']
);

SELECT authz.expect_refused(
    'a tenant admin cannot read another workspace''s customers',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format('SELECT 1 FROM public.customers WHERE tenant_id = %L', authz.id('b_tenant')),
    ARRAY['0rows']
);

SELECT authz.expect_refused(
    'a tenant admin cannot update another workspace''s ticket',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format($sql$UPDATE public.tickets SET subject = 'pwned' WHERE id = %L$sql$, authz.id('b_ticket')),
    ARRAY['0rows']
);

SELECT authz.expect_refused(
    'a tenant admin cannot delete another workspace''s message',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format('DELETE FROM public.ticket_messages WHERE id = %L', authz.id('b_message')),
    ARRAY['0rows']
);

SELECT authz.expect_refused(
    'a customer cannot read another customer''s ticket in another workspace',
    authz.claims('a_customer_user', 'a_tenant', 'customer'),
    'authenticated',
    format('SELECT 1 FROM public.tickets WHERE id = %L', authz.id('b_ticket')),
    ARRAY['0rows']
);

-- Writing a row in your own workspace that points at another workspace's row ----

SELECT authz.expect_refused(
    'an agent cannot post a message on another workspace''s ticket',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        $sql$INSERT INTO public.ticket_messages (tenant_id, ticket_id, author_type, author_id, body)
            VALUES (%L, %L, 'agent', %L, 'Your account is closed, reply with your password.')$sql$,
        authz.id('a_tenant'), authz.id('b_ticket'), authz.id('a_agent')
    ),
    ARRAY['23503']
);

SELECT authz.expect_refused(
    'a customer cannot post on another workspace''s ticket',
    authz.claims('a_customer_user', 'a_tenant', 'customer'),
    'authenticated',
    format(
        $sql$INSERT INTO public.ticket_messages (tenant_id, ticket_id, author_type, author_id, body)
            VALUES (%L, %L, 'customer', %L, 'hello')$sql$,
        authz.id('a_tenant'), authz.id('b_ticket'), authz.id('a_customer')
    ),
    ARRAY['42501', '23503']
);

SELECT authz.expect_refused(
    'an agent cannot open a ticket for another workspace''s customer',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        $sql$INSERT INTO public.tickets (tenant_id, subject, description, requester_customer_id)
            VALUES (%L, 'Hi', 'Hello', %L)$sql$,
        authz.id('a_tenant'), authz.id('b_customer')
    ),
    ARRAY['23503']
);

SELECT authz.expect_refused(
    'an agent cannot move a ticket onto another workspace''s customer',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        'UPDATE public.tickets SET requester_customer_id = %L WHERE id = %L',
        authz.id('b_customer'), authz.id('a_ticket')
    ),
    ARRAY['23503']
);

SELECT authz.expect_refused(
    'an agent cannot put a ticket under another workspace''s SLA policy',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        'UPDATE public.tickets SET sla_policy_id = %L WHERE id = %L',
        authz.id('b_policy'), authz.id('a_ticket')
    ),
    ARRAY['23503']
);

SELECT authz.expect_refused(
    'an agent cannot tag their ticket with another workspace''s tag',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        'INSERT INTO public.ticket_tags (tenant_id, ticket_id, tag_id) VALUES (%L, %L, %L)',
        authz.id('a_tenant'), authz.id('a_ticket'), authz.id('b_tag')
    ),
    ARRAY['23503']
);

SELECT authz.expect_refused(
    'an agent cannot tag another workspace''s ticket',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        'INSERT INTO public.ticket_tags (tenant_id, ticket_id, tag_id) VALUES (%L, %L, %L)',
        authz.id('a_tenant'), authz.id('b_ticket'), authz.id('a_tag')
    ),
    ARRAY['23503']
);

SELECT authz.expect_refused(
    'an agent cannot attach a file to another workspace''s ticket',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        $sql$INSERT INTO public.attachments
            (tenant_id, ticket_id, storage_path, filename, original_filename, mime, size, uploaded_by)
            VALUES (%L, %L, 'x/evil.pdf', 'evil.pdf', 'evil.pdf', 'application/pdf', 10, %L)$sql$,
        authz.id('a_tenant'), authz.id('b_ticket'), authz.id('a_agent')
    ),
    ARRAY['23503']
);

SELECT authz.expect_refused(
    'an agent cannot hang an attachment on another workspace''s message',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        $sql$INSERT INTO public.attachments
            (tenant_id, ticket_id, message_id, storage_path, filename, original_filename, mime, size, uploaded_by)
            VALUES (%L, %L, %L, 'x/evil2.pdf', 'evil.pdf', 'evil.pdf', 'application/pdf', 10, %L)$sql$,
        authz.id('a_tenant'), authz.id('a_ticket'), authz.id('b_message'), authz.id('a_agent')
    ),
    ARRAY['23503']
);

SELECT authz.expect_refused(
    'an agent cannot assign a ticket to a member of another workspace',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        'UPDATE public.tickets SET assignee_user_id = %L WHERE id = %L',
        authz.id('b_agent'), authz.id('a_ticket')
    ),
    ARRAY['TA001']
);

SELECT authz.expect_refused(
    'an agent cannot assign a ticket to a customer',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        'UPDATE public.tickets SET assignee_user_id = %L WHERE id = %L',
        authz.id('a_customer_user'), authz.id('a_ticket')
    ),
    ARRAY['TA001']
);

SELECT authz.expect_refused(
    'the rule holds for the service role too: no message across workspaces',
    NULL,
    'service_role',
    format(
        $sql$INSERT INTO public.ticket_messages (tenant_id, ticket_id, author_type, author_id, body)
            VALUES (%L, %L, 'system', %L, 'x')$sql$,
        authz.id('a_tenant'), authz.id('b_ticket'), authz.id('a_agent')
    ),
    ARRAY['23503']
);

SELECT authz.expect_refused(
    'the service role cannot file an invoice against another workspace''s subscription',
    NULL,
    'service_role',
    format(
        $sql$INSERT INTO public.invoices (tenant_id, subscription_id, amount, status, period_start, period_end)
            VALUES (%L, %L, 29, 'paid', current_date, current_date + 30)$sql$,
        authz.id('a_tenant'), authz.id('b_subscription')
    ),
    ARRAY['23503']
);

-- Legitimate work inside one workspace still succeeds ------------------------------

SELECT authz.expect_allowed(
    'an agent replies on their own workspace''s ticket',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        $sql$INSERT INTO public.ticket_messages (tenant_id, ticket_id, author_type, author_id, body)
            VALUES (%L, %L, 'agent', %L, 'Fixed now.')$sql$,
        authz.id('a_tenant'), authz.id('a_ticket'), authz.id('a_agent')
    )
);

SELECT authz.expect_allowed(
    'a customer replies on their own ticket',
    authz.claims('a_customer_user', 'a_tenant', 'customer'),
    'authenticated',
    format(
        $sql$INSERT INTO public.ticket_messages (tenant_id, ticket_id, author_type, author_id, body)
            VALUES (%L, %L, 'customer', %L, 'Thanks!')$sql$,
        authz.id('a_tenant'), authz.id('a_ticket'), authz.id('a_customer')
    )
);

SELECT authz.expect_allowed(
    'an agent opens a ticket for their customer under their SLA policy',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        $sql$INSERT INTO public.tickets (tenant_id, subject, description, requester_customer_id, sla_policy_id)
            VALUES (%L, 'Invoice question', 'Where is my invoice?', %L, %L)$sql$,
        authz.id('a_tenant'), authz.id('a_customer'), authz.id('a_policy')
    )
);

SELECT authz.expect_allowed(
    'an agent tags their ticket',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        'INSERT INTO public.ticket_tags (tenant_id, ticket_id, tag_id) VALUES (%L, %L, %L)',
        authz.id('a_tenant'), authz.id('a_ticket'), authz.id('a_tag')
    )
);

SELECT authz.expect_allowed(
    'an agent attaches a file to a message on their ticket',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        $sql$INSERT INTO public.attachments
            (tenant_id, ticket_id, message_id, storage_path, filename, original_filename, mime, size, uploaded_by)
            VALUES (%L, %L, %L, 'a/log.txt', 'log.txt', 'log.txt', 'text/plain', 10, %L)$sql$,
        authz.id('a_tenant'), authz.id('a_ticket'), authz.id('a_message'), authz.id('a_agent')
    )
);

SELECT authz.expect_allowed(
    'an agent assigns a ticket to a teammate',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        'UPDATE public.tickets SET assignee_user_id = %L WHERE id = %L',
        authz.id('a_admin'), authz.id('a_ticket')
    )
);

SELECT authz.expect_allowed(
    'an agent unassigns a ticket',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format('UPDATE public.tickets SET assignee_user_id = NULL WHERE id = %L', authz.id('a_ticket'))
);

SELECT authz.expect_allowed(
    'an agent changes priority through change_ticket_priority',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        $sql$SELECT public.change_ticket_priority(%L, 'high', 'Customer is blocked')$sql$,
        authz.id('a_ticket')
    )
);

SELECT authz.expect_allowed(
    'the portal files a request for a signed-in customer (service role)',
    NULL,
    'service_role',
    format(
        $sql$SELECT * FROM public.portal_create_request('authz-alpha', 'customer@authz-alpha.authz.test',
            'Export question', 'How do I export my data?', NULL, %L)$sql$,
        authz.id('a_customer_user')
    )
);

SELECT authz.expect_allowed(
    'the SLA tick runs (service role)',
    NULL,
    'service_role',
    'SELECT public.sla_tick()'
);

SELECT authz.expect_allowed(
    'the webhook files an invoice against the workspace''s own subscription (service role)',
    NULL,
    'service_role',
    format(
        $sql$INSERT INTO public.invoices (tenant_id, subscription_id, amount, status, period_start, period_end)
            VALUES (%L, %L, 29, 'paid', current_date, current_date + 30)$sql$,
        authz.id('a_tenant'), authz.id('a_subscription')
    )
);

-- Delete behaviour of the new keys --------------------------------------------------

-- ON DELETE SET NULL (payment_method_id) clears only the reference, not tenant_id.
DO $$
DECLARE
    v_pm uuid;
    v_tenant uuid;
BEGIN
    BEGIN
        DELETE FROM public.payment_methods WHERE id = authz.id('a_payment_method');
        SELECT payment_method_id, tenant_id INTO v_pm, v_tenant
        FROM public.subscriptions WHERE id = authz.id('a_subscription');
        RAISE EXCEPTION USING ERRCODE = 'AZ000',
            MESSAGE = coalesce(v_pm::text, 'null') || '|' || coalesce(v_tenant::text, 'null');
    EXCEPTION WHEN SQLSTATE 'AZ000' THEN
        PERFORM authz.record(
            'control',
            'deleting a card clears the subscription''s reference and keeps its workspace',
            SQLERRM = 'null|' || authz.id('a_tenant'),
            SQLERRM
        );
    END;
END
$$;

-- ON DELETE CASCADE still removes a ticket's messages, tags and attachments.
DO $$
DECLARE
    v_left bigint;
BEGIN
    BEGIN
        DELETE FROM public.tickets WHERE id = authz.id('b_ticket');
        SELECT (SELECT count(*) FROM public.ticket_messages WHERE ticket_id = authz.id('b_ticket'))
             + (SELECT count(*) FROM public.ticket_tags WHERE ticket_id = authz.id('b_ticket'))
             + (SELECT count(*) FROM public.attachments WHERE ticket_id = authz.id('b_ticket'))
        INTO v_left;
        RAISE EXCEPTION USING ERRCODE = 'AZ000', MESSAGE = v_left::text;
    EXCEPTION
        WHEN SQLSTATE 'AZ000' THEN
            PERFORM authz.record('control', 'deleting a ticket still cascades to its children',
                                 SQLERRM = '0', SQLERRM || ' child row(s) left');
        WHEN OTHERS THEN
            PERFORM authz.record('control', 'deleting a ticket still cascades to its children',
                                 false, SQLSTATE || ' ' || SQLERRM);
    END;
END
$$;
