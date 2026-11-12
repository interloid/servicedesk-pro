-- Two workspaces, Alpha and Bravo, each with staff of every role, a portal
-- customer, a ticket with a message, a tag and stored files. Built as the
-- database owner, the way provisioning and the service role build them.
-- Ids are recorded in authz.ids for the cases to use.

DO $$
DECLARE
    v_tz uuid := (SELECT id FROM public.timezones ORDER BY id LIMIT 1);
    v_sla jsonb := '[
        {"priority": "urgent", "first_response_mins": 60,  "resolution_mins": 240},
        {"priority": "high",   "first_response_mins": 120, "resolution_mins": 480},
        {"priority": "normal", "first_response_mins": 240, "resolution_mins": 1440},
        {"priority": "low",    "first_response_mins": 480, "resolution_mins": 2880}
    ]';
    w record;
    u record;
    v_tenant uuid;
    v_user uuid;
    v_customer uuid;
    v_ticket uuid;
    v_message uuid;
    v_tag uuid;
    v_pm uuid;
BEGIN
    FOR w IN
        SELECT * FROM (VALUES
            ('a', 'Alpha Support', 'authz-alpha', 'Pro'),
            ('b', 'Bravo Support', 'authz-bravo', 'Business')
        ) AS t(key, name, slug, plan)
    LOOP
        -- Owner, through provisioning (tenant, subscription, owner membership,
        -- business hours, default SLA policy).
        INSERT INTO auth.users (email, email_confirmed_at)
        VALUES (format('admin@%s.authz.test', w.slug), now())
        RETURNING id INTO v_user;

        SELECT tenant_id INTO v_tenant
        FROM public.provision_tenant(
            v_user,
            format('admin@%s.authz.test', w.slug),
            initcap(w.key) || ' Admin',
            w.name,
            w.slug,
            (SELECT id FROM public.plans WHERE name = w.plan),
            v_tz,
            '["mon","tue","wed","thu","fri"]'::jsonb,
            '09:00'::time,
            '17:00'::time,
            v_sla
        );

        INSERT INTO authz.ids VALUES
            (w.key || '_tenant', v_tenant),
            (w.key || '_admin', v_user),
            (w.key || '_policy', (SELECT id FROM public.sla_policies WHERE tenant_id = v_tenant LIMIT 1)),
            (w.key || '_hours', (SELECT id FROM public.business_hours WHERE tenant_id = v_tenant LIMIT 1)),
            (w.key || '_subscription', (SELECT id FROM public.subscriptions WHERE tenant_id = v_tenant));

        -- The rest of the team.
        FOR u IN
            SELECT * FROM (VALUES
                ('manager', 'manager'),
                ('agent', 'agent'),
                ('billing', 'billing_admin')
            ) AS t(key, role)
        LOOP
            INSERT INTO auth.users (email, email_confirmed_at)
            VALUES (format('%s@%s.authz.test', u.key, w.slug), now())
            RETURNING id INTO v_user;

            INSERT INTO public.users (id, email, full_name)
            VALUES (v_user, format('%s@%s.authz.test', u.key, w.slug), initcap(w.key || ' ' || u.key));

            INSERT INTO public.memberships (tenant_id, user_id, role, status)
            VALUES (v_tenant, v_user, u.role::public.membership_role, 'active');

            INSERT INTO authz.ids VALUES (w.key || '_' || u.key, v_user);
        END LOOP;

        -- A portal customer with a sign-in.
        INSERT INTO auth.users (email, email_confirmed_at)
        VALUES (format('customer@%s.authz.test', w.slug), now())
        RETURNING id INTO v_user;

        INSERT INTO public.users (id, email, full_name)
        VALUES (v_user, format('customer@%s.authz.test', w.slug), initcap(w.key) || ' Customer');

        INSERT INTO public.memberships (tenant_id, user_id, role, status)
        VALUES (v_tenant, v_user, 'customer', 'active');

        INSERT INTO public.customers (tenant_id, email, full_name, portal_user_id)
        VALUES (v_tenant, format('customer@%s.authz.test', w.slug), initcap(w.key) || ' Customer', v_user)
        RETURNING id INTO v_customer;

        INSERT INTO authz.ids VALUES
            (w.key || '_customer_user', v_user),
            (w.key || '_customer', v_customer);

        -- A ticket with one agent reply, and a tag.
        INSERT INTO public.tickets (tenant_id, subject, description, requester_customer_id, created_by)
        VALUES (v_tenant, 'Cannot sign in', 'The sign-in page loops.', v_customer, authz.id(w.key || '_agent'))
        RETURNING id INTO v_ticket;

        INSERT INTO public.ticket_messages (tenant_id, ticket_id, author_type, author_id, body)
        VALUES (v_tenant, v_ticket, 'agent', authz.id(w.key || '_agent'), 'Looking into it.')
        RETURNING id INTO v_message;

        INSERT INTO public.tags (tenant_id, name)
        VALUES (v_tenant, 'login')
        RETURNING id INTO v_tag;

        INSERT INTO authz.ids VALUES
            (w.key || '_ticket', v_ticket),
            (w.key || '_message', v_message),
            (w.key || '_tag', v_tag);

        -- A saved card, linked both ways with the subscription.
        INSERT INTO public.payment_methods (tenant_id, subscription_id)
        VALUES (v_tenant, authz.id(w.key || '_subscription'))
        RETURNING id INTO v_pm;

        UPDATE public.subscriptions
        SET payment_method_id = v_pm
        WHERE id = authz.id(w.key || '_subscription');

        INSERT INTO authz.ids VALUES (w.key || '_payment_method', v_pm);

        -- Rows in the remaining workspace tables, so the cross-tenant sweep
        -- has something to find in each.
        INSERT INTO public.ticket_tags (tenant_id, ticket_id, tag_id)
        VALUES (v_tenant, v_ticket, v_tag);

        INSERT INTO public.attachments
            (tenant_id, ticket_id, message_id, storage_path, filename, original_filename, mime, size, uploaded_by)
        VALUES
            (v_tenant, v_ticket, v_message, format('%s/%s/log.txt', v_tenant, v_ticket),
             'log.txt', 'log.txt', 'text/plain', 10, authz.id(w.key || '_agent'));

        INSERT INTO public.invoices (tenant_id, subscription_id, amount, status, period_start, period_end)
        VALUES (v_tenant, authz.id(w.key || '_subscription'), 29, 'paid', current_date - 30, current_date);

        INSERT INTO public.csat_ratings (tenant_id, ticket_id, customer_id, score, resolved_at)
        VALUES (v_tenant, v_ticket, v_customer, 5, now());

        INSERT INTO public.demo_outbox (tenant_id, kind, recipient, subject, html)
        VALUES (v_tenant, 'team_invitation', format('new@%s.authz.test', w.slug),
                'You''ve been invited', '<p>Accept: https://example.test/invite</p>');

        INSERT INTO public.sla_policy_customers (tenant_id, policy_id, customer_id)
        VALUES (v_tenant, authz.id(w.key || '_policy'), v_customer);

        INSERT INTO public.notification_prefs (tenant_id, user_id)
        VALUES (v_tenant, authz.id(w.key || '_agent'))
        ON CONFLICT DO NOTHING;

        INSERT INTO public.sla_alert_jobs (tenant_id, sla_event_id, kind)
        SELECT v_tenant, e.id, 'sla_warning'
        FROM public.sla_events AS e
        WHERE e.ticket_id = v_ticket
        LIMIT 1;

        INSERT INTO public.subscription_cancellation_reasons (tenant_id, subscription_id, reason)
        VALUES (v_tenant, authz.id(w.key || '_subscription'), 'Too expensive');

        -- Provisioning seeds the system saved views.
        INSERT INTO public.saved_view_user_preferences (tenant_id, user_id, saved_view_id)
        SELECT v_tenant, authz.id(w.key || '_agent'), v.id
        FROM public.saved_views AS v
        WHERE v.tenant_id = v_tenant
        LIMIT 1;

        -- A second customer with their own ticket, for isolation between
        -- customers of the same workspace.
        INSERT INTO auth.users (email, email_confirmed_at)
        VALUES (format('customer2@%s.authz.test', w.slug), now())
        RETURNING id INTO v_user;

        INSERT INTO public.users (id, email, full_name)
        VALUES (v_user, format('customer2@%s.authz.test', w.slug), initcap(w.key) || ' Customer Two');

        INSERT INTO public.memberships (tenant_id, user_id, role, status)
        VALUES (v_tenant, v_user, 'customer', 'active');

        INSERT INTO public.customers (tenant_id, email, full_name, portal_user_id)
        VALUES (v_tenant, format('customer2@%s.authz.test', w.slug), initcap(w.key) || ' Customer Two', v_user)
        RETURNING id INTO v_customer;

        INSERT INTO public.tickets (tenant_id, subject, description, requester_customer_id)
        VALUES (v_tenant, 'Refund request', 'Please refund last month.', v_customer)
        RETURNING id INTO v_ticket;

        INSERT INTO public.ticket_messages (tenant_id, ticket_id, author_type, author_id, body)
        VALUES (v_tenant, v_ticket, 'customer', v_customer, 'My card number ends 4242.')
        RETURNING id INTO v_message;

        INSERT INTO authz.ids VALUES
            (w.key || '_customer2_user', v_user),
            (w.key || '_customer2', v_customer),
            (w.key || '_ticket2', v_ticket),
            (w.key || '_message2', v_message);

        -- Stored files: a staff avatar and an invoice PDF.
        INSERT INTO storage.objects (bucket_id, name)
        VALUES
            ('avatars', format('%s/%s/photo.png', v_tenant, authz.id(w.key || '_agent'))),
            ('invoices', format('%s/invoice-1.pdf', v_tenant));
    END LOOP;

    -- A signed-in user who belongs to no workspace.
    INSERT INTO auth.users (email, email_confirmed_at)
    VALUES ('outsider@authz.test', now())
    RETURNING id INTO v_user;

    INSERT INTO public.users (id, email, full_name)
    VALUES (v_user, 'outsider@authz.test', 'Outsider');

    INSERT INTO authz.ids VALUES ('outsider', v_user);

    -- An auth account that has signed up but has no workspace or profile yet:
    -- the state provision_tenant is called in.
    INSERT INTO auth.users (email, email_confirmed_at)
    VALUES ('newcomer@authz.test', now())
    RETURNING id INTO v_user;

    INSERT INTO authz.ids VALUES ('newcomer', v_user);
END
$$;
