-- Platform admin permissions (2026-11-17).
--
--   Tenant metadata & status   view; suspend/activate; soft-delete only
--   Tenant internal data       only through the In-Person View (consent grant)
--   Subscriptions & plans      view; extend trials, create and edit plans;
--                              deprecate plans, never delete them
--   Platform support requests  view; reply and update status; no delete
--   Audit logs                 view; append-only; immutable
--
-- Mirrors schemas/tables/02_tenants.sql, schemas/functions/35_platform_admin.sql
-- and schemas/triggers/audit_logs_immutable.sql.

begin;

-- 1. Soft-deleted workspaces ---------------------------------------------------
-- A deleted workspace is an admin-blocked one with a deletion stamp: every RLS
-- policy already locks an admin block out (current_workspace_block()), so no
-- policy changes. The row and all its data stay; restore clears the stamp.

alter table public.tenants
    add column if not exists deleted_at timestamptz,
    add column if not exists deleted_by uuid,
    add column if not exists delete_reason text;

alter table public.tenants
    drop constraint if exists chk_tenants_deleted_locked;

-- Deleted means locked: it can't be "activated" while the stamp is set.
alter table public.tenants
    add constraint chk_tenants_deleted_locked
        check (
            deleted_at is null
            or (status = 'suspended' and block_source = 'admin')
        );

alter table public.tenants
    drop constraint if exists chk_tenants_delete_reason;

alter table public.tenants
    add constraint chk_tenants_delete_reason
        check (
            delete_reason is null
            or char_length(btrim(delete_reason)) between 3 and 300
        );

-- Clients never write the deletion columns, any more than the block ones: the
-- same guard that keeps plan and block columns keeps these.
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

-- 2. Audit logs are append-only and immutable ---------------------------------
-- No API role may change or remove a row, the service role included. The one
-- way a row goes is with its workspace, when the database itself removes the
-- workspace (the foreign key's ON DELETE CASCADE). The platform console can't
-- do that: it only soft-deletes. Development seed clean-up still can.

revoke update, delete, truncate on public.audit_logs from anon, authenticated, service_role;

create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
        -- Fired by the tenants foreign key cascade, not by a statement.
        return old;
    end if;

    raise exception 'Audit log entries can''t be changed or removed.'
        using errcode = '42501';
end;
$$;

revoke execute on function public.audit_logs_immutable() from public, anon, authenticated;

drop trigger if exists audit_logs_immutable on public.audit_logs;

create trigger audit_logs_immutable
before update or delete on public.audit_logs
for each row
execute function public.audit_logs_immutable();

drop trigger if exists audit_logs_no_truncate on public.audit_logs;

create trigger audit_logs_no_truncate
before truncate on public.audit_logs
for each statement
execute function public.audit_logs_immutable();

-- 3. Trial extension -----------------------------------------------------------
-- Only a trial with no PayPal agreement: its end date is ours alone. A paid
-- agreement's dates come from PayPal and must not be moved here.

create or replace function public.platform_extend_trial(
    p_tenant_id uuid,
    p_days integer
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
    v_end timestamptz;
begin
    if p_days is null or p_days < 1 or p_days > 90 then
        raise exception 'Extend a trial by 1 to 90 days.'
            using errcode = '22023';
    end if;

    update public.subscriptions
    set current_period_end = greatest(coalesce(current_period_end, now()), now())
                             + make_interval(days => p_days),
        updated_at = now()
    where tenant_id = p_tenant_id
      and status = 'trialing'
      and paypal_subscription_id is null
      and exists (
          select 1 from public.tenants t
          where t.id = p_tenant_id and t.deleted_at is null
      )
    returning current_period_end into v_end;

    if v_end is null then
        raise exception 'This workspace isn''t on a trial that can be extended.'
            using errcode = 'P0002';
    end if;

    return v_end;
end;
$$;

-- Service role only: the platform console calls it after requirePlatformAdmin.
revoke all on function public.platform_extend_trial(uuid, integer) from public, anon, authenticated;
grant execute on function public.platform_extend_trial(uuid, integer) to service_role;

commit;
