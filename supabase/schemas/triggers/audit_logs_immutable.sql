-- =====================================================
-- File: audit_logs_immutable.sql
-- Description: Audit logs are append-only; rows go only with their workspace
-- =====================================================

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
