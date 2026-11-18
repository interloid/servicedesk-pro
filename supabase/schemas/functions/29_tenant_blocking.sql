-- Workspace blocking (tenants.status = 'suspended'), set from the /platform
-- console or automatically below. The proxy enforces it; see workspaceGate.

-- A Tenant Admin may update their own tenants row (name, branding), so without
-- this they could lift a block or change plan with one request. Only a direct write from a
-- signed-in or anonymous caller is held back: the console and the billing
-- functions use the service role, and the trigger below runs nested.
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
        -- Only the platform console deletes or restores a workspace.
        new.deleted_at := old.deleted_at;
        new.deleted_by := old.deleted_by;
        new.delete_reason := old.delete_reason;
    end if;

    return new;
end;
$$;

drop trigger if exists tenants_guard_block on public.tenants;

create trigger tenants_guard_block
before update on public.tenants
for each row
execute function public.tenants_guard_block();

-- Payment trouble never blocks a workspace (migration 20261117150000): when the
-- grace period runs out unpaid it moves to Free and keeps access. This only
-- lifts a block an earlier version made, once the workspace subscribes again
-- (a new subscription clears cancellation_source). A platform admin's block is
-- never lifted here.
create or replace function public.subscriptions_sync_tenant_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if old.cancellation_source is not null and new.cancellation_source is null then
        update public.tenants
        set status = 'active',
            block_source = null,
            block_reason = null,
            blocked_at = null
        where id = new.tenant_id
          and status = 'suspended'
          and block_source = 'payment'
          and deleted_at is null;
    end if;

    return null;
end;
$$;

drop trigger if exists subscriptions_sync_tenant_block on public.subscriptions;

create trigger subscriptions_sync_tenant_block
after update of cancellation_source on public.subscriptions
for each row
execute function public.subscriptions_sync_tenant_block();
