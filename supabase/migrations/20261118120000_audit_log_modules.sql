-- =====================================================
-- Audit log modules
--
-- The audit log is regrouped into the modules a workspace admin thinks in:
-- tickets, conversations, attachments, users, roles, customers, SLA, the
-- workspace itself, billing, platform admin and support requests.
--
-- * Sign-ins are no longer recorded. Existing login / logout / failed-login
--   rows keep the legacy 'authentication' module and are hidden from every
--   reader by the select policy.
-- * Tickets, replies and notes, attachments, customers, SLA breaches and
--   support requests are now recorded by triggers.
-- * Existing rows are re-filed under the new modules.
-- =====================================================

------------------------------------------------------------
-- 1. Module column
------------------------------------------------------------

alter table public.audit_logs drop constraint if exists chk_audit_module;

-- 'general' stays as the column default only: it tells audit_logs_fill() to
-- work the module out, and never survives the insert.
alter table public.audit_logs
    add constraint chk_audit_module check (
        module in (
            'tickets',
            'conversations',
            'attachments',
            'users',
            'roles',
            'customers',
            'sla',
            'tenant',
            'billing',
            'platform',
            'support',
            -- Sign-ins recorded before 20261118120000. Hidden from readers.
            'authentication',
            'general'
        )
    ) not valid;

create or replace function public.audit_module_for(
    p_entity text,
    p_action text,
    p_meta jsonb
)
returns text
language sql
immutable
as $$
    select case
        when p_action in ('login', 'logout', 'login_failed') then 'authentication'
        when p_action = 'support_access' then 'platform'
        when p_entity in ('workspace', 'impersonation') then 'platform'
        when p_entity = 'ticket' then 'tickets'
        when p_entity = 'ticket_message' then 'conversations'
        when p_entity = 'attachment' then 'attachments'
        when p_entity = 'membership' and p_meta ->> 'role' = 'customer' then 'customers'
        when p_entity = 'customer' then 'customers'
        when p_action = 'role_change' then 'roles'
        when p_entity in ('role', 'tenant_ownership') then 'roles'
        when p_entity in ('membership', 'user', 'password', 'notification_prefs') then 'users'
        when p_entity in ('sla_policy', 'business_hours', 'sla_event') then 'sla'
        when p_entity in ('subscription', 'invoice', 'payment_method') then 'billing'
        when p_entity = 'support_request' then 'support'
        else 'tenant'
    end;
$$;

-- Re-file what is already there. Rows are append-only, so the guard is lifted
-- for this one statement; only the module column changes.
alter table public.audit_logs disable trigger audit_logs_immutable;

update public.audit_logs
set module = public.audit_module_for(entity, action::text, coalesce(meta_json, '{}'::jsonb))
where module is distinct from public.audit_module_for(entity, action::text, coalesce(meta_json, '{}'::jsonb));

alter table public.audit_logs enable trigger audit_logs_immutable;

alter table public.audit_logs validate constraint chk_audit_module;

-- An explicit module from a trusted writer is kept only when it is one of the
-- current ones; anything else is worked out from the entity.
create or replace function public.audit_logs_fill()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
declare
    v_ip text;
begin
    new.meta_json := coalesce(new.meta_json, '{}'::jsonb);

    if new.actor_id is null then
        new.actor_id := coalesce(
            public.audit_trusted_actor(),
            public.audit_fallback_actor()
        );
    end if;

    new.meta_json := new.meta_json - 'actor' - 'impersonated_by';

    if public.audit_impersonator() is not null then
        new.meta_json := new.meta_json || jsonb_build_object(
            'impersonated_by', public.audit_impersonator()
        );
    end if;
    if new.actor_id is not null then
        new.meta_json := new.meta_json || jsonb_build_object(
            'actor',
            public.audit_actor_snapshot(new.tenant_id, new.actor_id)
        );
    end if;

    if new.module is null
       or new.module in ('general', 'authentication')
       or current_user in ('authenticated', 'anon') then
        new.module := public.audit_module_for(
            new.entity,
            new.action::text,
            new.meta_json
        );
    end if;

    if new.action::text = 'login_failed' then
        new.result := 'failure';
    end if;

    if new.user_agent is null then
        new.user_agent := left(
            coalesce(
                nullif(new.meta_json ->> 'user_agent', ''),
                public.audit_request_header('x-audit-user-agent')
            ),
            512
        );
    end if;

    new.meta_json := new.meta_json - 'user_agent';

    if new.ip is null then
        v_ip := btrim(split_part(
            coalesce(
                public.audit_request_header('x-audit-ip'),
                public.audit_request_header('x-forwarded-for'),
                ''
            ),
            ',',
            1
        ));

        begin
            new.ip := nullif(v_ip, '')::inet;
        exception
            when others then
                new.ip := null;
        end;
    end if;

    return new;
end;
$$;

------------------------------------------------------------
-- 2. Readers and client writers
------------------------------------------------------------

drop policy if exists "audit_logs_select" on public.audit_logs;

CREATE POLICY "audit_logs_select"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_tenant_role()) IN (
        'tenant_admin',
        'manager'
    )
    AND (SELECT public.current_tenant_has_feature('audit_logs'))
    -- Sign-ins are no longer part of the audit log.
    AND module <> 'authentication'
);

-- Login and logout are no longer written by the app.
drop policy if exists "audit_logs_insert" on public.audit_logs;

CREATE POLICY "audit_logs_insert"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
    actor_id = (SELECT auth.uid())
    AND tenant_id = (SELECT public.current_tenant_id())
    AND result = 'success'
    AND (
        (
            (SELECT public.current_tenant_role()) <> 'customer'
            AND entity_id = actor_id
            AND NOT (meta_json ? 'summary')
            AND action::text = 'update'
            AND entity = 'notification_prefs'
        )
        OR (
            (SELECT public.current_tenant_role()) IN ('tenant_admin', 'manager')
            AND action::text = 'export'
            AND entity = 'audit_log'
        )
    )
);

------------------------------------------------------------
-- 3. Stat cards: platform access instead of security
------------------------------------------------------------

create or replace function public.audit_log_summary(
    p_from timestamptz,
    p_to timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
    with span as (
        select p_from - (p_to - p_from) as prev_from
    ),
    scoped as (
        select
            a.actor_id,
            a.module,
            a.result,
            a.created_at >= p_from as is_current
        from public.audit_logs a, span
        where a.tenant_id = public.current_tenant_id()
          and a.created_at >= span.prev_from
          and a.created_at < p_to
    )
    select jsonb_build_object(
        'total', count(*) filter (where is_current),
        'prev_total', count(*) filter (where not is_current),
        'users', count(distinct actor_id) filter (where is_current),
        'prev_users', count(distinct actor_id) filter (where not is_current),
        'modules', count(distinct module) filter (where is_current),
        'prev_modules', count(distinct module) filter (where not is_current),
        -- Key kept as "security" for the app: platform access and failures.
        'security', count(*) filter (
            where is_current and (module = 'platform' or result = 'failure')
        ),
        'prev_security', count(*) filter (
            where not is_current and (module = 'platform' or result = 'failure')
        )
    )
    from scoped;
$$;

------------------------------------------------------------
-- 4. New writers
------------------------------------------------------------

-- "Jane Doe", else the email, else a fallback.
create or replace function public.audit_user_label(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (
            select coalesce(nullif(btrim(u.full_name), ''), u.email::text)
            from public.users u
            where u.id = p_user_id
        ),
        'a deleted user'
    );
$$;

revoke execute on function public.audit_user_label(uuid) from public, anon, authenticated;

create or replace function public.audit_ticket_status_label(p_status text)
returns text
language sql
immutable
as $$
    select case p_status
        when 'on_hold' then 'On hold'
        else initcap(coalesce(p_status, ''))
    end;
$$;

-- Who acted, when nobody is signed in ------------------------------------

-- The app writes some rows with the admin client (portal, support requests,
-- uploads), where auth.uid() is null. The row itself names the person:
-- these set app.audit_fallback_actor (audit_fallback_actor) for the rows
-- that follow, so they name that person instead of "System". A signed-in
-- user or an x-audit-actor header still wins. Reset with null afterwards.
create or replace function public.audit_use_actor(p_user_id uuid)
returns void
language sql
volatile
as $$
    select set_config('app.audit_fallback_actor', coalesce(p_user_id::text, ''), true);
$$;

revoke execute on function public.audit_use_actor(uuid) from public, anon, authenticated;

-- A customer's portal sign-in, as a users id.
create or replace function public.audit_customer_user(p_customer_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select c.portal_user_id from public.customers c where c.id = p_customer_id;
$$;

revoke execute on function public.audit_customer_user(uuid) from public, anon, authenticated;

-- Tickets ----------------------------------------------------------------

create or replace function public.audit_tickets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ref text;
    v_old_assignee text;
    v_new_assignee text;
    v_meta jsonb;
    v_changes jsonb;
begin
    if tg_op = 'INSERT' then
        perform public.audit_use_actor(coalesce(
            new.created_by,
            public.audit_customer_user(new.requester_customer_id)
        ));
        perform public.audit_record(
            new.tenant_id,
            'create',
            'ticket',
            new.id,
            jsonb_build_object(
                'summary', format('Created ticket #%s: %s', new.number, new.subject),
                'ticket_number', new.number
            )
        );
        perform public.audit_use_actor(null);
        return null;
    elsif tg_op = 'DELETE' then
        -- A whole workspace going is not a ticket deletion.
        if pg_trigger_depth() > 1 then
            return null;
        end if;

        perform public.audit_record(
            old.tenant_id,
            'delete',
            'ticket',
            old.id,
            jsonb_build_object(
                'summary', format('Deleted ticket #%s: %s', old.number, old.subject),
                'ticket_number', old.number
            )
        );
        return null;
    end if;

    v_ref := format('ticket #%s', new.number);
    v_meta := jsonb_build_object('ticket_number', new.number);

    if new.assignee_user_id is distinct from old.assignee_user_id then
        v_old_assignee := case when old.assignee_user_id is not null
            then public.audit_user_label(old.assignee_user_id) end;
        v_new_assignee := case when new.assignee_user_id is not null
            then public.audit_user_label(new.assignee_user_id) end;

        perform public.audit_record(
            new.tenant_id,
            'assign',
            'ticket',
            new.id,
            v_meta || jsonb_build_object(
                'summary',
                case
                    when v_old_assignee is null
                        then format('Assigned %s to %s', v_ref, v_new_assignee)
                    when v_new_assignee is null
                        then format('Unassigned %s from %s', v_ref, v_old_assignee)
                    else format('Reassigned %s from %s to %s', v_ref, v_old_assignee, v_new_assignee)
                end,
                'changes', jsonb_build_object('assignee', jsonb_build_object(
                    'from', coalesce(v_old_assignee, 'Unassigned'),
                    'to', coalesce(v_new_assignee, 'Unassigned')
                ))
            )
        );
    end if;

    if new.status is distinct from old.status then
        perform public.audit_record(
            new.tenant_id,
            'update',
            'ticket',
            new.id,
            v_meta || jsonb_build_object(
                'summary',
                case
                    when old.status in ('resolved', 'closed')
                         and new.status not in ('resolved', 'closed')
                        then format('Reopened %s', v_ref)
                    when new.status = 'closed'
                        then format('Closed %s', v_ref)
                    when new.status = 'resolved'
                        then format('Resolved %s', v_ref)
                    else format(
                        'Changed status of %s from %s to %s',
                        v_ref,
                        public.audit_ticket_status_label(old.status::text),
                        public.audit_ticket_status_label(new.status::text)
                    )
                end,
                'changes', jsonb_build_object('status', jsonb_build_object(
                    'from', public.audit_ticket_status_label(old.status::text),
                    'to', public.audit_ticket_status_label(new.status::text)
                ))
            )
        );
    end if;

    -- Priority is recorded by tickets_audit_priority_change, with its reason.
    v_changes := public.audit_diff(
        jsonb_build_object('subject', old.subject),
        jsonb_build_object('subject', new.subject),
        array['subject']
    );

    if new.description is distinct from old.description then
        v_changes := v_changes || jsonb_build_object(
            'description', jsonb_build_object('from', 'Previous text', 'to', 'Updated')
        );
    end if;

    if v_changes <> '{}'::jsonb then
        perform public.audit_record(
            new.tenant_id,
            'update',
            'ticket',
            new.id,
            v_meta || jsonb_build_object(
                'summary', format('Updated %s', v_ref),
                'changes', v_changes
            )
        );
    end if;

    return null;
end;
$$;

revoke execute on function public.audit_tickets() from public, anon, authenticated;

drop trigger if exists audit_tickets on public.tickets;

create trigger audit_tickets
after insert or update of assignee_user_id, status, subject, description or delete
on public.tickets
for each row
execute function public.audit_tickets();

-- The priority row now carries a sentence like every other row.
create or replace function public.tickets_audit_priority_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_reason text := nullif(btrim(current_setting('app.priority_change_reason', true)), '');
    v_kept text := nullif(current_setting('app.priority_sla_kept', true), '');
begin
    insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta_json)
    values (
        new.tenant_id,
        auth.uid(),
        'update',
        'ticket',
        new.id,
        jsonb_build_object(
            'summary', format(
                'Changed priority of ticket #%s from %s to %s',
                new.number,
                initcap(old.priority::text),
                initcap(new.priority::text)
            ),
            'changes', jsonb_build_object('priority', jsonb_build_object(
                'from', initcap(old.priority::text),
                'to', initcap(new.priority::text)
            )),
            'field', 'priority',
            'ticket_number', new.number,
            'from', old.priority,
            'to', new.priority,
            'direction', case when new.priority > old.priority then 'raised' else 'lowered' end,
            'reason', v_reason,
            'sla_kept', coalesce(v_kept::jsonb, '[]'::jsonb)
        )
    );
    return null;
end;
$$;

-- Replies and internal notes ---------------------------------------------

create or replace function public.audit_ticket_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.ticket_messages := case when tg_op = 'DELETE' then old else new end;
    v_number bigint;
    v_kind text;
begin
    -- Automatic messages, and replies going with their ticket or workspace.
    if v_row.author_type = 'system'
       or (tg_op = 'DELETE' and pg_trigger_depth() > 1) then
        return null;
    end if;

    if tg_op = 'UPDATE' and new.body is not distinct from old.body then
        return null;
    end if;

    select t.number into v_number
    from public.tickets t
    where t.tenant_id = v_row.tenant_id and t.id = v_row.ticket_id;

    v_kind := case when v_row.visibility = 'internal' then 'internal note' else 'reply' end;

    -- Written or edited by its author; a deletion may be anyone's.
    if tg_op <> 'DELETE' then
        perform public.audit_use_actor(case
            when v_row.author_type = 'customer'
                then public.audit_customer_user(v_row.author_id)
            else v_row.author_id
        end);
    end if;

    perform public.audit_record(
        v_row.tenant_id,
        case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'update' end::public.audit_action,
        'ticket_message',
        v_row.id,
        jsonb_build_object(
            'summary',
            case tg_op
                when 'INSERT' then
                    case
                        when v_row.visibility = 'internal'
                            then format('Added an internal note on ticket #%s', v_number)
                        when v_row.author_type = 'customer'
                            then format('Customer replied on ticket #%s', v_number)
                        else format('Replied on ticket #%s', v_number)
                    end
                when 'DELETE' then format('Deleted a %s on ticket #%s', v_kind, v_number)
                else format('Edited a %s on ticket #%s', v_kind, v_number)
            end,
            'ticket_number', v_number,
            'ticket_id', v_row.ticket_id,
            'visibility', v_row.visibility,
            'author_type', v_row.author_type
        )
    );

    perform public.audit_use_actor(null);
    return null;
end;
$$;

revoke execute on function public.audit_ticket_messages() from public, anon, authenticated;

drop trigger if exists audit_ticket_messages on public.ticket_messages;

create trigger audit_ticket_messages
after insert or update of body or delete on public.ticket_messages
for each row
execute function public.audit_ticket_messages();

-- Attachments -------------------------------------------------------------

create or replace function public.audit_attachments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.attachments := case when tg_op = 'DELETE' then old else new end;
    v_number bigint;
begin
    if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
        return null;
    end if;

    select t.number into v_number
    from public.tickets t
    where t.tenant_id = v_row.tenant_id and t.id = v_row.ticket_id;

    if tg_op = 'INSERT' then
        perform public.audit_use_actor(v_row.uploaded_by);
    end if;

    perform public.audit_record(
        v_row.tenant_id,
        case when tg_op = 'INSERT' then 'create' else 'delete' end::public.audit_action,
        'attachment',
        v_row.id,
        jsonb_build_object(
            'summary',
            case when tg_op = 'INSERT'
                then format('Uploaded %s to ticket #%s', v_row.original_filename, v_number)
                else format('Deleted %s from ticket #%s', v_row.original_filename, v_number)
            end,
            'filename', v_row.original_filename,
            'size', v_row.size,
            'mime', v_row.mime,
            'ticket_number', v_number,
            'ticket_id', v_row.ticket_id
        )
    );

    perform public.audit_use_actor(null);
    return null;
end;
$$;

revoke execute on function public.audit_attachments() from public, anon, authenticated;

drop trigger if exists audit_attachments on public.attachments;

create trigger audit_attachments
after insert or delete on public.attachments
for each row
execute function public.audit_attachments();

-- Customers ---------------------------------------------------------------

create or replace function public.audit_customers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_changes jsonb;
begin
    if tg_op = 'INSERT' then
        perform public.audit_record(
            new.tenant_id,
            'create',
            'customer',
            new.id,
            jsonb_build_object(
                'summary', format('Added customer %s', coalesce(nullif(new.full_name, ''), new.email::text)),
                'email', new.email
            )
        );
        return null;
    elsif tg_op = 'DELETE' then
        if pg_trigger_depth() > 1 then
            return null;
        end if;

        perform public.audit_record(
            old.tenant_id,
            'delete',
            'customer',
            old.id,
            jsonb_build_object(
                'summary', format('Deleted customer %s', coalesce(nullif(old.full_name, ''), old.email::text)),
                'email', old.email
            )
        );
        return null;
    end if;

    -- Portal sign-in bookkeeping isn't an edit.
    v_changes := public.audit_diff(
        to_jsonb(old),
        to_jsonb(new),
        array['full_name', 'email', 'company', 'phone']
    );

    if v_changes = '{}'::jsonb then
        return null;
    end if;

    perform public.audit_record(
        new.tenant_id,
        'update',
        'customer',
        new.id,
        jsonb_build_object(
            'summary', format('Updated customer %s', coalesce(nullif(new.full_name, ''), new.email::text)),
            'email', new.email,
            'changes', v_changes
        )
    );

    return null;
end;
$$;

revoke execute on function public.audit_customers() from public, anon, authenticated;

drop trigger if exists audit_customers on public.customers;

create trigger audit_customers
after insert or update or delete on public.customers
for each row
execute function public.audit_customers();

-- SLA breaches ------------------------------------------------------------

-- Breaches are found by the SLA cron, so the row names nobody ("System")
-- rather than whoever's statement happened to tip the clock over.
create or replace function public.audit_sla_breaches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_number bigint;
begin
    if new.status <> 'breached' or old.status = 'breached' then
        return null;
    end if;

    select t.number into v_number
    from public.tickets t
    where t.tenant_id = new.tenant_id and t.id = new.ticket_id;

    insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta_json)
    values (
        new.tenant_id,
        null,
        'update',
        'sla_event',
        new.id,
        jsonb_build_object(
            'summary', format(
                'SLA breached on ticket #%s (%s)',
                v_number,
                case new.type when 'first_response' then 'first response' else 'resolution' end
            ),
            'ticket_number', v_number,
            'ticket_id', new.ticket_id,
            'sla_type', new.type,
            'due_at', new.due_at
        )
    );

    return null;
exception
    when others then
        raise warning 'audit_sla_breaches not written: %', sqlerrm;
        return null;
end;
$$;

revoke execute on function public.audit_sla_breaches() from public, anon, authenticated;

drop trigger if exists audit_sla_breaches on public.sla_events;

create trigger audit_sla_breaches
after update of status on public.sla_events
for each row
execute function public.audit_sla_breaches();

-- Support requests --------------------------------------------------------

create or replace function public.audit_support_requests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ref text;
    v_meta jsonb;
begin
    if tg_op = 'INSERT' then
        perform public.audit_use_actor(new.created_by);
        perform public.audit_record(
            new.tenant_id,
            'create',
            'support_request',
            new.id,
            jsonb_build_object(
                'summary', format('Created support request #%s: %s', new.number, new.subject),
                'request_number', new.number
            )
        );
        perform public.audit_use_actor(null);
        return null;
    end if;

    v_ref := format('support request #%s', new.number);
    v_meta := jsonb_build_object('request_number', new.number);

    if new.status is distinct from old.status then
        perform public.audit_record(
            new.tenant_id,
            'update',
            'support_request',
            new.id,
            v_meta || jsonb_build_object(
                'summary',
                case
                    when old.status in ('resolved', 'closed')
                         and new.status not in ('resolved', 'closed')
                        then format('Reopened %s', v_ref)
                    when new.status = 'resolved' then format('Resolved %s', v_ref)
                    when new.status = 'closed' then format('Closed %s', v_ref)
                    else format(
                        'Changed status of %s to %s',
                        v_ref,
                        initcap(replace(new.status, '_', ' '))
                    )
                end,
                'changes', jsonb_build_object('status', jsonb_build_object(
                    'from', initcap(replace(old.status, '_', ' ')),
                    'to', initcap(replace(new.status, '_', ' '))
                ))
            )
        );
    end if;

    if new.allow_workspace_access is distinct from old.allow_workspace_access then
        -- A grant names its admin; a withdrawal relies on the caller.
        if new.allow_workspace_access then
            perform public.audit_use_actor(new.access_granted_by);
        end if;

        perform public.audit_record(
            new.tenant_id,
            'update',
            'support_request',
            new.id,
            v_meta || jsonb_build_object(
                'summary',
                case when new.allow_workspace_access
                    then format('Allowed support to access the workspace for %s', v_ref)
                    else format('Withdrew support access for %s', v_ref)
                end,
                'access_expires_at', new.access_expires_at
            )
        );
        perform public.audit_use_actor(null);
    end if;

    return null;
end;
$$;

revoke execute on function public.audit_support_requests() from public, anon, authenticated;

drop trigger if exists audit_support_requests on public.support_requests;

create trigger audit_support_requests
after insert or update of status, allow_workspace_access on public.support_requests
for each row
execute function public.audit_support_requests();
