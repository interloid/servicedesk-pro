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
