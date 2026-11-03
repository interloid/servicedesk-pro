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
