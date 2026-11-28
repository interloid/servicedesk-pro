-- Email-to-ticket (migration 20261127120000): who can see a connected mailbox
-- and its inbound emails, that the tokens never reach an API role, and that
-- email_ingest_commit files each email exactly once, in its own workspace.

-- Reading the mailbox -------------------------------------------------------------

SELECT authz.expect_allowed(
    'a tenant admin can read their workspace''s email channel',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    'SELECT id, connected_email, receiving_email, status FROM public.tenant_email_integrations',
    1
);

SELECT authz.expect_refused(
    'a tenant admin cannot read the encrypted access token',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    'SELECT access_token_encrypted FROM public.tenant_email_integrations',
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'a tenant admin cannot read the encrypted refresh token',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    'SELECT refresh_token_encrypted FROM public.tenant_email_integrations',
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'select * on the email channel is refused (token columns are not granted)',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    'SELECT * FROM public.tenant_email_integrations',
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'an agent cannot read the email channel',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    'SELECT id FROM public.tenant_email_integrations',
    ARRAY['0rows']
);

SELECT authz.expect_refused(
    'a manager cannot read the email channel',
    authz.claims('a_manager', 'a_tenant', 'manager'),
    'authenticated',
    'SELECT id FROM public.tenant_email_integrations',
    ARRAY['0rows']
);

SELECT authz.expect_refused(
    'a customer cannot read the email channel',
    authz.claims('a_customer_user', 'a_tenant', 'customer'),
    'authenticated',
    'SELECT id FROM public.tenant_email_integrations',
    ARRAY['0rows']
);

SELECT authz.expect_refused(
    'a tenant admin cannot read another workspace''s email channel by id',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format('SELECT id FROM public.tenant_email_integrations WHERE id = %L', authz.id('b_email_integration')),
    ARRAY['0rows']
);

SELECT authz.expect_refused(
    'a tenant admin with a forged tenant claim (no membership) cannot read that workspace''s channel',
    authz.claims('a_admin', 'b_tenant', 'tenant_admin'),
    'authenticated',
    'SELECT id FROM public.tenant_email_integrations',
    ARRAY['0rows']
);

SELECT authz.expect_refused(
    'anon cannot read any email channel',
    NULL,
    'anon',
    'SELECT id FROM public.tenant_email_integrations',
    ARRAY['42501']
);

-- Writing the mailbox -------------------------------------------------------------

SELECT authz.expect_refused(
    'a tenant admin cannot change the channel directly (server actions only)',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    $sql$UPDATE public.tenant_email_integrations SET receiving_email = 'attacker@evil.test'$sql$,
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'a tenant admin cannot connect a mailbox by inserting a row',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format(
        $sql$INSERT INTO public.tenant_email_integrations (tenant_id, provider, connected_email, receiving_email)
             VALUES (%L, 'gmail', 'x@evil.test', 'x@evil.test')$sql$,
        authz.id('a_tenant')
    ),
    ARRAY['42501']
);

-- Inbound emails and the queue ----------------------------------------------------

SELECT authz.expect_allowed(
    'a tenant admin can read their workspace''s inbound emails',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    'SELECT id, status, sender_email, subject FROM public.email_inbound_events',
    1,
    true
);

SELECT authz.expect_refused(
    'an agent cannot read inbound emails',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    'SELECT id FROM public.email_inbound_events',
    ARRAY['0rows']
);

SELECT authz.expect_refused(
    'a tenant admin cannot read another workspace''s inbound emails',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format('SELECT id FROM public.email_inbound_events WHERE tenant_id = %L', authz.id('b_tenant')),
    ARRAY['0rows']
);

SELECT authz.expect_refused(
    'a tenant admin cannot mark an inbound email processed',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    $sql$UPDATE public.email_inbound_events SET status = 'processed'$sql$,
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'a tenant admin cannot read the sync queue',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    'SELECT id FROM public.email_sync_jobs',
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'a signed-in user cannot file an email through the ingest function',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format(
        $sql$SELECT public.email_ingest_commit(%L, '{}'::jsonb)$sql$,
        (SELECT id FROM public.email_inbound_events WHERE tenant_id = authz.id('a_tenant') LIMIT 1)
    ),
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'a signed-in user cannot post an agent reply through the email function',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format(
        $sql$SELECT public.email_ingest_commit_agent_reply(%L, '{}'::jsonb)$sql$,
        (SELECT id FROM public.email_inbound_events WHERE tenant_id = authz.id('a_tenant') LIMIT 1)
    ),
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'a signed-in user cannot queue a mailbox sync',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format($sql$SELECT public.email_enqueue_sync(%L)$sql$, authz.id('b_email_integration')),
    ARRAY['42501']
);

SELECT authz.expect_refused(
    'a signed-in user cannot retry another workspace''s email',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    format(
        $sql$SELECT public.email_retry_inbound_event(%L, gen_random_uuid())$sql$,
        authz.id('b_tenant')
    ),
    ARRAY['42501']
);

SELECT authz.expect_allowed(
    'a tenant admin can read their channel''s stats',
    authz.claims('a_admin', 'a_tenant', 'tenant_admin'),
    'authenticated',
    'SELECT public.email_channel_stats()',
    1
);

SELECT authz.expect_refused(
    'an agent cannot read the channel''s stats',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    'SELECT public.email_channel_stats()',
    ARRAY['42501']
);

-- A browser cannot pass a message off as an email ---------------------------------

SELECT authz.expect_rows(
    'attack',
    'an agent''s message claiming source = email is stored as app, without email headers',
    authz.claims('a_agent', 'a_tenant', 'agent'),
    'authenticated',
    format(
        $sql$WITH m AS (
                 INSERT INTO public.ticket_messages
                     (tenant_id, ticket_id, author_type, author_id, body, source, email_message_id)
                 VALUES (%L, %L, 'agent', %L, 'hi', 'email', '<forged@x>')
                 RETURNING source, email_message_id
             )
             SELECT 1 FROM m WHERE source = 'app' AND email_message_id IS NULL$sql$,
        authz.id('a_tenant'), authz.id('a_ticket'), authz.id('a_agent')
    ),
    1
);

-- The pipeline (as the service role's functions run it) ---------------------------

CREATE OR REPLACE FUNCTION authz.email_event(p_tenant text, p_provider_id text)
RETURNS uuid
LANGUAGE sql AS $$
    INSERT INTO public.email_inbound_events (tenant_id, integration_id, provider, provider_message_id, status)
    VALUES (authz.id(p_tenant || '_tenant'), authz.id(p_tenant || '_email_integration'), 'gmail', p_provider_id, 'processing')
    RETURNING id;
$$;

CREATE OR REPLACE FUNCTION authz.check(p_label text, p_ok boolean, p_detail text DEFAULT NULL)
RETURNS void
LANGUAGE sql AS $$
    SELECT authz.record('control', p_label, coalesce(p_ok, false), p_detail);
$$;

DO $$
DECLARE
    v_event uuid;
    v_result jsonb;
    v_again jsonb;
    v_ticket uuid;
    v_ticket2 uuid;
    v_customer uuid;
    v_count bigint;
    v_status text;
    v_job uuid;
    v_job2 uuid;
    v_a uuid := authz.id('a_tenant');
    v_b uuid := authz.id('b_tenant');
BEGIN
    -- 1. A new email from an unknown sender: customer and ticket are created.
    v_event := authz.email_event('a', 'm-new-1');
    v_result := public.email_ingest_commit(v_event, jsonb_build_object(
        'sender_email', 'New.Person@External.test',
        'sender_name', 'New Person',
        'recipient_email', 'mailbox+support@authz-alpha.authz.test',
        'subject', 'Login problem',
        'body', 'I cannot log in.',
        'message_id', '<m-new-1@external.test>'
    ));
    v_ticket := (v_result ->> 'ticket_id')::uuid;

    PERFORM authz.check('email: a new email creates a ticket', v_result ->> 'outcome' = 'ticket_created', v_result::text);

    SELECT id INTO v_customer FROM public.customers
    WHERE tenant_id = v_a AND email = 'new.person@external.test';
    PERFORM authz.check('email: an unknown sender becomes a customer (lower-cased, not linked to a sign-in)',
        v_customer IS NOT NULL AND (SELECT portal_user_id IS NULL FROM public.customers WHERE id = v_customer));

    PERFORM authz.check('email: the ticket is source email, low priority, new, numbered, for that customer',
        EXISTS (SELECT 1 FROM public.tickets
                WHERE id = v_ticket AND tenant_id = v_a AND source = 'email' AND priority = 'low'
                  AND status = 'new' AND number IS NOT NULL AND requester_customer_id = v_customer));

    PERFORM authz.check('email: the ticket triggers ran (customer confirmation queued)',
        EXISTS (SELECT 1 FROM public.email_jobs
                WHERE kind = 'customer_ticket_created' AND payload ->> 'ticketId' = v_ticket::text));

    PERFORM authz.check('email: a committed event waits for attachments (still processing, ticket recorded)',
        EXISTS (SELECT 1 FROM public.email_inbound_events
                WHERE id = v_event AND status = 'processing' AND ticket_id = v_ticket));

    -- 2. The same event again (worker crashed after the commit): nothing new.
    v_again := public.email_ingest_commit(v_event, jsonb_build_object(
        'sender_email', 'new.person@external.test', 'subject', 'Login problem', 'body', 'again'));
    SELECT count(*) INTO v_count FROM public.tickets WHERE tenant_id = v_a AND subject = 'Login problem';
    PERFORM authz.check('email: replaying a committed event returns the same ticket and files nothing',
        (v_again ->> 'replayed')::boolean AND (v_again ->> 'ticket_id')::uuid = v_ticket AND v_count = 1,
        v_again::text);

    PERFORM public.email_ingest_complete(v_event);
    PERFORM authz.check('email: completing marks the event processed',
        (SELECT status FROM public.email_inbound_events WHERE id = v_event) = 'processed');

    -- 3. The same Message-ID under another provider id: a duplicate.
    v_event := authz.email_event('a', 'm-new-1-copy');
    v_result := public.email_ingest_commit(v_event, jsonb_build_object(
        'sender_email', 'new.person@external.test', 'subject', 'Login problem', 'body', 'I cannot log in.',
        'message_id', '<m-new-1@external.test>'));
    PERFORM authz.check('email: the same Message-ID twice files once',
        v_result ->> 'ignore_reason' = 'duplicate_message', v_result::text);

    -- 4. A reply by In-Reply-To: appended, not a new ticket.
    v_event := authz.email_event('a', 'm-reply-1');
    v_result := public.email_ingest_commit(v_event, jsonb_build_object(
        'sender_email', 'new.person@external.test', 'subject', 'Re: Login problem', 'body', 'Still broken.',
        'message_id', '<m-reply-1@external.test>', 'in_reply_to', '<m-new-1@external.test>',
        'references', '<m-new-1@external.test>',
        'match_ticket_id', v_ticket, 'match_source', 'in_reply_to'));
    PERFORM authz.check('email: a reply is appended to the ticket',
        v_result ->> 'outcome' = 'reply_appended' AND (v_result ->> 'ticket_id')::uuid = v_ticket, v_result::text);
    PERFORM authz.check('email: the reply is a public customer message with its email headers',
        EXISTS (SELECT 1 FROM public.ticket_messages
                WHERE id = (v_result ->> 'ticket_message_id')::uuid AND ticket_id = v_ticket
                  AND author_type = 'customer' AND author_id = v_customer AND visibility = 'public'
                  AND source = 'email' AND email_message_id = '<m-reply-1@external.test>'
                  AND email_in_reply_to = '<m-new-1@external.test>'));
    PERFORM authz.check('email: thread lookup finds the ticket by the opening email''s Message-ID',
        public.email_find_thread_ticket(v_a, ARRAY['<nope@x>', '<m-new-1@external.test>']) = v_ticket);
    PERFORM authz.check('email: thread lookup finds the ticket by a reply''s Message-ID',
        public.email_find_thread_ticket(v_a, ARRAY['<m-reply-1@external.test>']) = v_ticket);
    PERFORM authz.check('email: thread lookup never crosses tenants',
        public.email_find_thread_ticket(v_b, ARRAY['<m-new-1@external.test>', '<m-reply-1@external.test>']) IS NULL);
    PERFORM authz.check('email: a reply on a new ticket leaves its status alone',
        (SELECT status::text FROM public.tickets WHERE id = v_ticket) = 'new');

    -- 5. Reopen policy: pending -> open; closed stays closed.
    UPDATE public.tickets SET status = 'pending' WHERE id = v_ticket;
    v_event := authz.email_event('a', 'm-reply-2');
    PERFORM public.email_ingest_commit(v_event, jsonb_build_object(
        'sender_email', 'new.person@external.test', 'body', 'Here is more detail.',
        'match_ticket_id', v_ticket, 'match_source', 'references'));
    PERFORM authz.check('email: a reply to a pending ticket puts it back to open',
        (SELECT status::text FROM public.tickets WHERE id = v_ticket) = 'open');

    UPDATE public.tickets SET status = 'closed', closed_at = now() WHERE id = v_ticket;
    v_event := authz.email_event('a', 'm-reply-3');
    v_result := public.email_ingest_commit(v_event, jsonb_build_object(
        'sender_email', 'new.person@external.test', 'body', 'Thanks!',
        'match_ticket_id', v_ticket, 'match_source', 'in_reply_to'));
    PERFORM authz.check('email: a reply to a closed ticket is kept on it and does not reopen it',
        v_result ->> 'outcome' = 'reply_appended'
        AND (SELECT status::text FROM public.tickets WHERE id = v_ticket) = 'closed');

    -- 5b. The team answering from Gmail (migration 20261127150000).
    UPDATE public.tickets SET status = 'open', closed_at = NULL WHERE id = v_ticket;
    v_event := authz.email_event('a', 'm-agent-1');
    v_result := public.email_ingest_commit_agent_reply(v_event, jsonb_build_object(
        'sender_email', 'mailbox@authz-alpha.authz.test',
        'recipients', jsonb_build_array('new.person@external.test'),
        'subject', 'Re: Login problem', 'body', 'ok i will fix that',
        'message_id', '<agent-1@mail.gmail.com>', 'in_reply_to', '<m-new-1@external.test>',
        'match_ticket_id', v_ticket, 'match_source', 'in_reply_to'));
    PERFORM authz.check('email: a Gmail reply from the mailbox is added as a public agent reply',
        v_result ->> 'outcome' = 'agent_reply_appended'
        AND EXISTS (SELECT 1 FROM public.ticket_messages m
                    WHERE m.id = (v_result ->> 'ticket_message_id')::uuid AND m.ticket_id = v_ticket
                      AND m.author_type = 'agent' AND m.visibility = 'public' AND m.source = 'email'
                      AND m.author_id = authz.id('a_admin')), v_result::text);
    PERFORM authz.check('email: no second email is queued to the customer for a reply sent from Gmail',
        NOT EXISTS (SELECT 1 FROM public.email_jobs
                    WHERE kind = 'customer_ticket_reply' AND payload ->> 'messageId' = v_result ->> 'ticket_message_id'));
    PERFORM authz.check('email: replaying an agent reply adds nothing',
        (public.email_ingest_commit_agent_reply(v_event, '{}'::jsonb) ->> 'replayed')::boolean
        AND (SELECT count(*) FROM public.ticket_messages WHERE ticket_id = v_ticket AND author_type = 'agent' AND source = 'email') = 1);

    v_event := authz.email_event('a', 'm-agent-spoof');
    v_result := public.email_ingest_commit_agent_reply(v_event, jsonb_build_object(
        'sender_email', 'attacker@evil.test', 'body', 'x',
        'match_ticket_id', v_ticket, 'match_source', 'in_reply_to'));
    PERFORM authz.check('email: only the connected mailbox can add agent replies',
        v_result ->> 'ignore_reason' = 'sent_not_ticket_reply', v_result::text);

    v_event := authz.email_event('a', 'm-agent-subject');
    v_result := public.email_ingest_commit_agent_reply(v_event, jsonb_build_object(
        'sender_email', 'mailbox@authz-alpha.authz.test',
        'recipients', jsonb_build_array('someone@else.test'), 'body', 'x',
        'match_ticket_id', v_ticket, 'match_source', 'subject'));
    PERFORM authz.check('email: a subject-matched agent reply needs the requester among the recipients',
        v_result ->> 'ignore_reason' = 'sent_not_ticket_reply', v_result::text);

    v_event := authz.email_event('a', 'm-agent-cross');
    v_result := public.email_ingest_commit_agent_reply(v_event, jsonb_build_object(
        'sender_email', 'mailbox@authz-alpha.authz.test', 'body', 'x',
        'match_ticket_id', authz.id('b_ticket'), 'match_source', 'in_reply_to'));
    PERFORM authz.check('email: an agent reply can never land on another workspace''s ticket',
        v_result ->> 'ignore_reason' = 'sent_not_ticket_reply', v_result::text);

    INSERT INTO public.ticket_messages (tenant_id, ticket_id, author_type, author_id, body)
    VALUES (v_a, v_ticket, 'agent', authz.id('a_agent'), 'Replied in the app')
    RETURNING id INTO v_job;
    PERFORM authz.check('email: an agent reply written in the app still emails the customer',
        EXISTS (SELECT 1 FROM public.email_jobs
                WHERE kind = 'customer_ticket_reply' AND payload ->> 'messageId' = v_job::text));

    -- 6. A subject match from somebody else is not trusted.
    v_event := authz.email_event('a', 'm-subject-other');
    v_result := public.email_ingest_commit(v_event, jsonb_build_object(
        'sender_email', 'stranger@external.test', 'subject', 'Re: [#1] Login problem', 'body', 'Me too',
        'match_ticket_id', v_ticket, 'match_source', 'subject'));
    PERFORM authz.check('email: a ticket number in the subject only threads for the requester',
        v_result ->> 'outcome' = 'ticket_created' AND (v_result ->> 'ticket_id')::uuid <> v_ticket, v_result::text);

    v_event := authz.email_event('a', 'm-subject-none');
    v_result := public.email_ingest_commit(v_event, jsonb_build_object(
        'sender_email', 'stranger2@external.test', 'body', 'Me too',
        'match_ticket_id', v_ticket));
    PERFORM authz.check('email: a match with no source is treated like a subject match',
        v_result ->> 'outcome' = 'ticket_created', v_result::text);

    -- 7. Tenant isolation: Alpha's email naming Bravo's ticket.
    SELECT count(*) INTO v_count FROM public.ticket_messages WHERE ticket_id = authz.id('b_ticket');
    v_event := authz.email_event('a', 'm-cross');
    v_result := public.email_ingest_commit(v_event, jsonb_build_object(
        'sender_email', 'customer@authz-bravo.authz.test', 'subject', 'Cross', 'body', 'Hello',
        'match_ticket_id', authz.id('b_ticket'), 'match_source', 'in_reply_to'));
    v_ticket2 := (v_result ->> 'ticket_id')::uuid;
    PERFORM authz.check('email: Alpha''s email can never write to Bravo''s ticket',
        (SELECT count(*) FROM public.ticket_messages WHERE ticket_id = authz.id('b_ticket')) = v_count
        AND (SELECT tenant_id FROM public.tickets WHERE id = v_ticket2) = v_a, v_result::text);
    PERFORM authz.check('email: Alpha''s email creates the customer in Alpha, not Bravo',
        (SELECT tenant_id FROM public.customers WHERE id = (v_result ->> 'customer_id')::uuid) = v_a
        AND (v_result ->> 'customer_id')::uuid <> authz.id('b_customer'));

    -- 8. Existing customer: reused, not duplicated.
    v_event := authz.email_event('a', 'm-existing');
    v_result := public.email_ingest_commit(v_event, jsonb_build_object(
        'sender_email', 'CUSTOMER@authz-alpha.authz.test', 'subject', 'Billing', 'body', 'Question'));
    PERFORM authz.check('email: an existing customer is matched by tenant and email, case-insensitively',
        (v_result ->> 'customer_id')::uuid = authz.id('a_customer'), v_result::text);

    -- 9. Auto-create off.
    UPDATE public.tenant_email_integrations SET auto_create_customer = false WHERE id = authz.id('a_email_integration');
    v_event := authz.email_event('a', 'm-unknown');
    v_result := public.email_ingest_commit(v_event, jsonb_build_object(
        'sender_email', 'nobody@external.test', 'subject', 'Hi', 'body', 'Hi'));
    PERFORM authz.check('email: with auto-create off an unknown sender is ignored and no customer is made',
        v_result ->> 'ignore_reason' = 'unknown_sender'
        AND NOT EXISTS (SELECT 1 FROM public.customers WHERE email = 'nobody@external.test'), v_result::text);
    UPDATE public.tenant_email_integrations SET auto_create_customer = true WHERE id = authz.id('a_email_integration');

    -- 10. Staff and loops.
    v_event := authz.email_event('a', 'm-staff');
    v_result := public.email_ingest_commit(v_event, jsonb_build_object(
        'sender_email', 'agent@authz-alpha.authz.test', 'subject', 'Fwd: something', 'body', 'fyi'));
    PERFORM authz.check('email: mail from the team is ignored', v_result ->> 'ignore_reason' = 'sender_is_team', v_result::text);

    v_event := authz.email_event('a', 'm-loop');
    v_result := public.email_ingest_commit(v_event, jsonb_build_object(
        'sender_email', 'mailbox@authz-alpha.authz.test', 'subject', 'loop', 'body', 'loop'));
    PERFORM authz.check('email: mail from the mailbox itself is ignored', v_result ->> 'ignore_reason' = 'sender_is_mailbox', v_result::text);

    -- 11. Disabled channel.
    UPDATE public.tenant_email_integrations SET enabled = false WHERE id = authz.id('a_email_integration');
    v_event := authz.email_event('a', 'm-disabled');
    v_result := public.email_ingest_commit(v_event, jsonb_build_object(
        'sender_email', 'someone@external.test', 'subject', 'x', 'body', 'x'));
    PERFORM authz.check('email: a disabled channel files nothing', v_result ->> 'ignore_reason' = 'integration_inactive', v_result::text);
    UPDATE public.tenant_email_integrations SET enabled = true WHERE id = authz.id('a_email_integration');

    -- 12. Retries.
    v_event := authz.email_event('a', 'm-retry');
    v_status := public.email_ingest_fail(v_event, 'Gmail 503', 'temporary', interval '5 seconds');
    PERFORM authz.check('email: a temporary failure goes back to pending with retry_count 1',
        v_status = 'pending' AND (SELECT retry_count FROM public.email_inbound_events WHERE id = v_event) = 1);
    UPDATE public.email_inbound_events SET status = 'processing' WHERE id = v_event;
    UPDATE public.email_inbound_events SET retry_count = max_retries WHERE id = v_event;
    v_status := public.email_ingest_fail(v_event, 'Gmail 503', 'temporary', interval '10 minutes');
    PERFORM authz.check('email: a temporary failure past the last retry is failed', v_status = 'failed');

    v_event := authz.email_event('a', 'm-permanent');
    v_status := public.email_ingest_fail(v_event, 'bad', 'permanent', interval '5 seconds');
    PERFORM authz.check('email: a permanent failure is failed at once', v_status = 'failed');

    -- Separate statements: AND has no guaranteed evaluation order.
    PERFORM authz.check('email: another workspace cannot retry the email',
        NOT public.email_retry_inbound_event(v_b, v_event));
    PERFORM authz.check('email: the owning workspace can retry a failed email',
        public.email_retry_inbound_event(v_a, v_event));
    PERFORM authz.check('email: a retried email is pending with its retries reset',
        (SELECT status = 'pending' AND retry_count = 0 FROM public.email_inbound_events WHERE id = v_event));

    -- 13. Queue: coalescing, claim, settle.
    DELETE FROM public.email_sync_jobs WHERE integration_id = authz.id('a_email_integration');
    v_job := public.email_enqueue_sync(authz.id('a_email_integration'), '1500', 'push');
    v_job2 := public.email_enqueue_sync(authz.id('a_email_integration'), '1200', 'push');
    PERFORM authz.check('email: notifications for one mailbox collapse into one pending job, keeping the highest history id',
        v_job = v_job2
        AND (SELECT count(*) FROM public.email_sync_jobs WHERE integration_id = authz.id('a_email_integration') AND status = 'pending') = 1
        AND (SELECT history_id FROM public.email_sync_jobs WHERE id = v_job) = '1500');

    PERFORM authz.check('email: a claimed job is processing',
        EXISTS (SELECT 1 FROM public.claim_email_sync_jobs(50) c WHERE c.id = v_job AND c.status = 'processing'));

    v_job2 := public.email_enqueue_sync(authz.id('a_email_integration'), '1600', 'push');
    PERFORM authz.check('email: a notification during a sync queues the next one', v_job2 IS NOT NULL AND v_job2 <> v_job);

    v_status := public.email_finish_sync_job(v_job, false, 'Gmail 429', interval '30 seconds');
    PERFORM authz.check('email: retrying a job while a newer one is pending folds into the newer one',
        v_status = 'completed');

    v_status := public.email_finish_sync_job(v_job2, true);
    PERFORM authz.check('email: a finished job is completed', v_status = 'completed');

    -- 14. Lease and cursor.
    PERFORM authz.check('email: one worker at a time holds a mailbox',
        public.email_acquire_integration_lease(authz.id('a_email_integration'), '00000000-0000-0000-0000-000000000001')
        AND NOT public.email_acquire_integration_lease(authz.id('a_email_integration'), '00000000-0000-0000-0000-000000000002'));
    PERFORM public.email_release_integration_lease(authz.id('a_email_integration'), '00000000-0000-0000-0000-000000000001');
    PERFORM authz.check('email: a released mailbox can be taken',
        public.email_acquire_integration_lease(authz.id('a_email_integration'), '00000000-0000-0000-0000-000000000002'));
    PERFORM public.email_release_integration_lease(authz.id('a_email_integration'), '00000000-0000-0000-0000-000000000002');

    PERFORM public.email_advance_history(authz.id('a_email_integration'), '5000');
    PERFORM public.email_advance_history(authz.id('a_email_integration'), '4000');
    PERFORM authz.check('email: the history cursor never moves back',
        (SELECT provider_history_id FROM public.tenant_email_integrations WHERE id = authz.id('a_email_integration')) = '5000');

    -- 15. Scheduler: due retries, watch renewal.
    UPDATE public.tenant_email_integrations SET watch_expiration = now() + interval '2 hours'
    WHERE id = authz.id('a_email_integration');
    PERFORM public.email_ingest_schedule();
    PERFORM authz.check('email: the scheduler queues a watch renewal for an expiring watch',
        EXISTS (SELECT 1 FROM public.email_sync_jobs
                WHERE integration_id = authz.id('a_email_integration') AND kind = 'watch' AND status = 'pending'));
    PERFORM authz.check('email: the scheduler queues a sync for an email due a retry',
        EXISTS (SELECT 1 FROM public.email_sync_jobs
                WHERE integration_id = authz.id('a_email_integration') AND kind = 'sync' AND status = 'pending'));
END
$$;
