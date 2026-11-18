-- =====================================================
-- File: 36_impersonation.sql
-- Description: Support impersonation state, ending, and audit attribution
-- (migration 20261117160000). The token hook, audit_logs_fill and
-- current_workspace_block use these.
-- =====================================================

create or replace function public.impersonation_state()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select case
        when s.id is null then null
        when s.ended_at is null
             and s.expires_at > now()
             and r.allow_workspace_access
             and r.access_expires_at > now()
             and r.status in ('open', 'in_progress', 'waiting_on_customer')
            then 'active'
        else 'ended'
    end
    from (
        select case
            when auth.jwt() ->> 'session_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then (auth.jwt() ->> 'session_id')::uuid
        end as sid
    ) j
    left join public.impersonation_sessions s
        on s.auth_session_id = j.sid
    left join public.support_requests r
        on r.id = s.request_id;
$$;

revoke all on function public.impersonation_state() from public, anon;
grant execute on function public.impersonation_state() to authenticated, service_role;

-- Ends one session: records why and deletes its Auth session, so its refresh
-- token stops working. Service role only.
create or replace function public.end_impersonation_session(
    p_auth_session_id uuid,
    p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.impersonation_sessions
    set ended_at = coalesce(ended_at, now()),
        end_reason = coalesce(end_reason, left(p_reason, 100))
    where auth_session_id = p_auth_session_id;

    delete from auth.sessions where id = p_auth_session_id;
end;
$$;

revoke all on function public.end_impersonation_session(uuid, text) from public, anon, authenticated;
grant execute on function public.end_impersonation_session(uuid, text) to service_role;

-- Withdrawing access, or resolving/closing the request, ends its sessions now.
create or replace function public.support_requests_end_impersonation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    s record;
begin
    if (old.allow_workspace_access and not new.allow_workspace_access)
       or (new.status in ('resolved', 'closed') and old.status is distinct from new.status) then
        for s in
            select auth_session_id
            from public.impersonation_sessions
            where request_id = new.id
              and ended_at is null
        loop
            perform public.end_impersonation_session(
                s.auth_session_id,
                case when not new.allow_workspace_access then 'access withdrawn'
                     else 'request ' || new.status end
            );
        end loop;
    end if;

    return null;
end;
$$;

revoke execute on function public.support_requests_end_impersonation() from public, anon, authenticated;

drop trigger if exists support_requests_end_impersonation on public.support_requests;

create trigger support_requests_end_impersonation
after update of allow_workspace_access, status on public.support_requests
for each row
execute function public.support_requests_end_impersonation();

create or replace function public.audit_impersonator()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
    if v_claims is null then
        return null;
    end if;

    if v_claims ->> 'role' = 'service_role' then
        return left(public.audit_request_header('x-audit-impersonator'), 320);
    end if;

    return left(nullif(v_claims ->> 'impersonated_by', ''), 320);
exception
    when others then
        return null;
end;
$$;

-- Called by audit_logs_fill, which runs as the writer (authenticated for a
-- session insert); it only ever reads the caller's own token and headers.
revoke all on function public.audit_impersonator() from public, anon;
grant execute on function public.audit_impersonator() to authenticated, service_role;
