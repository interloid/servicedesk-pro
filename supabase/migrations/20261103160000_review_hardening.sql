-- Fixes from docs/reviews/code-review-2026-11-03.md (RISK-001, 003, 008).
-- Mirrors supabase/schemas/policies/05_subscriptions.sql, 18_invoices.sql,
-- 30_workspace_block.sql and functions/29, 30 and 31.

-- RISK-001: billing records are written by the service role only.
drop policy if exists "subscriptions_insert" on public.subscriptions;
drop policy if exists "subscriptions_update" on public.subscriptions;
drop policy if exists "subscriptions_delete" on public.subscriptions;
drop policy if exists "invoices_insert" on public.invoices;
drop policy if exists "invoices_update" on public.invoices;
drop policy if exists "invoices_delete" on public.invoices;

create or replace function public.tenants_guard_block()
returns trigger
language plpgsql
as $$
declare
    v_role text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
begin
    if pg_trigger_depth() = 1 and v_role in ('authenticated', 'anon') then
        -- Billing decides the plan; a client write would be a free upgrade.
        new.plan_id := old.plan_id;
        new.status := old.status;
        new.block_reason := old.block_reason;
        new.block_source := old.block_source;
        new.blocked_at := old.blocked_at;
    end if;

    return new;
end;
$$;

drop trigger if exists tenants_guard_block on public.tenants;

create trigger tenants_guard_block
before update on public.tenants
for each row
execute function public.tenants_guard_block();

-- The block on the caller's workspace: 'admin', 'payment', or null when none.
-- Read by the restrictive policies in policies/30_workspace_block.sql, wrapped
-- in a subselect so it runs once per statement, not once per row.
create or replace function public.current_workspace_block()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select case
        when t.status = 'suspended' then coalesce(t.block_source, 'admin')
    end
    from public.tenants t
    where t.id = nullif(auth.jwt() ->> 'tenant_id', '')::uuid;
$$;

revoke all on function public.current_workspace_block() from public, anon;
grant execute on function public.current_workspace_block() to authenticated, service_role;

-- Blocking at the data layer. The proxy only guards the app, so without these a
-- blocked user's token could still read and write through the Supabase API.
--
-- Restrictive: combined with AND on top of each table's own policies. Every
-- table with a tenant_id is covered, so a new table needs this re-run.
--
-- A payment block keeps what paying needs (billing, the app shell, sign-in's
-- audit row). The service role bypasses all of this, so billing keeps working.
do $block$
declare
    v_table text;
    v_rule text;
    v_payment_ok constant text[] := array[
        'tenants', 'memberships', 'subscriptions', 'invoices', 'payment_methods',
        'notifications', 'notification_prefs', 'audit_logs'
    ];
begin
    for v_table in
        select c.table_name
        from information_schema.columns c
        join information_schema.tables t
          on t.table_schema = c.table_schema and t.table_name = c.table_name
        where c.table_schema = 'public'
          and c.column_name = 'tenant_id'
          and t.table_type = 'BASE TABLE'
        union
        select 'tenants'
    loop
        v_rule := case
            when v_table = any (v_payment_ok)
                then $r$(select public.current_workspace_block()) is distinct from 'admin'$r$
            else $r$(select public.current_workspace_block()) is null$r$
        end;

        execute format('drop policy if exists workspace_not_blocked on public.%I', v_table);
        execute format(
            'create policy workspace_not_blocked on public.%I as restrictive for all to authenticated using (%s) with check (%s)',
            v_table, v_rule, v_rule
        );
    end loop;

    if to_regclass('storage.objects') is not null then
        drop policy if exists workspace_not_blocked on storage.objects;
        create policy workspace_not_blocked on storage.objects
            as restrictive for all to authenticated
            using ((select public.current_workspace_block()) is distinct from 'admin')
            with check ((select public.current_workspace_block()) is distinct from 'admin');
    end if;
end;
$block$;

-- Totals for the /platform console, worked out here so the app doesn't load every
-- row. One jsonb value each, so PostgREST's row cap can't cut them short.
-- Execute is granted to service_role alone.

-- { tenant_id: { lifetime_paid, recent: [up to 5 newest invoices] } }
create or replace function public.platform_invoice_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(jsonb_object_agg(s.tenant_id, jsonb_build_object(
        'lifetime_paid', s.lifetime_paid,
        'recent', s.recent
    )), '{}'::jsonb)
    from (
        select
            r.tenant_id,
            coalesce(
                sum(coalesce(r.amount_paid, r.amount)) filter (where r.status = 'paid'),
                0
            ) as lifetime_paid,
            coalesce(
                jsonb_agg(jsonb_build_object(
                    'number', r.invoice_number,
                    'amount', coalesce(r.amount_paid, r.amount),
                    'status', r.status,
                    'date', coalesce(r.paid_at, r.created_at)
                ) order by r.position) filter (where r.position <= 5),
                '[]'::jsonb
            ) as recent
        from (
            select
                i.*,
                row_number() over (
                    partition by i.tenant_id order by i.created_at desc
                ) as position
            from public.invoices i
        ) r
        group by r.tenant_id
    ) s;
$$;

revoke all on function public.platform_invoice_summary() from public, anon, authenticated;
grant execute on function public.platform_invoice_summary() to service_role;

-- { user_id: last_sign_in_at }, instead of paging through the Auth admin API.
create or replace function public.platform_last_sign_ins()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
    select coalesce(jsonb_object_agg(u.id, u.last_sign_in_at), '{}'::jsonb)
    from auth.users u
    where u.last_sign_in_at is not null;
$$;

revoke all on function public.platform_last_sign_ins() from public, anon, authenticated;
grant execute on function public.platform_last_sign_ins() to service_role;
