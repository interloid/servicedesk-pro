-- Support impersonation (2026-11-17): platform support signs in as the
-- Tenant Admin who granted workspace access on a support request, with that
-- admin's full access, for as long as the grant lasts.
--
--   * The grant is the existing 72-hour switch on the support request;
--     access_granted_by records which admin turned it on, and only that admin
--     can be signed in as.
--   * Each sign-in is a real Auth session, recorded in impersonation_sessions.
--     The access token hook pins it to the granting workspace and adds an
--     impersonated_by claim.
--   * It ends when support ends it, the grant expires, the tenant withdraws it,
--     or the request is resolved or closed. An ended session's Auth session is
--     deleted, and any token still in hand is locked out of every tenant table
--     through current_workspace_block().
--   * Every audit entry written by the session, or by the server on its
--     behalf, carries meta_json.impersonated_by.
--
-- Mirrors schemas/tables/29_impersonation_sessions.sql,
-- schemas/functions/36_impersonation.sql, schemas/functions/03_custom_access_token_hook.sql,
-- schemas/functions/19_audit_log.sql and schemas/functions/30_workspace_block.sql.

begin;

-- 1. Who granted access -------------------------------------------------------

alter table public.support_requests
    add column if not exists access_granted_by uuid
        references public.users(id)
        on delete set null;

update public.support_requests
set access_granted_by = created_by
where allow_workspace_access
  and access_granted_by is null;

-- 2. Impersonation sessions ----------------------------------------------------

create table if not exists public.impersonation_sessions
(
    id uuid primary key
        default gen_random_uuid(),

    -- auth.sessions.id of the session minted for support. No foreign key:
    -- the Auth row is deleted when the impersonation ends; this record stays.
    auth_session_id uuid
        not null
        constraint uq_impersonation_sessions_auth_session unique,

    request_id uuid
        not null
        references public.support_requests(id)
        on delete cascade,

    tenant_id uuid
        not null
        references public.tenants(id)
        on delete cascade,

    target_user_id uuid
        not null
        references public.users(id)
        on delete cascade,

    -- A platform operator may have no users row.
    platform_admin_id uuid
        not null,

    platform_admin_email text
        not null,

    started_at timestamptz
        not null
        default now(),

    expires_at timestamptz
        not null,

    ended_at timestamptz,

    end_reason text
);

create index if not exists idx_impersonation_sessions_request_open
    on public.impersonation_sessions (request_id)
    where ended_at is null;

-- Service role and SECURITY DEFINER functions only.
alter table public.impersonation_sessions enable row level security;
revoke all on public.impersonation_sessions from anon, authenticated;

-- 3. Is this request's session an impersonation, and is it still allowed? ----
-- null: not an impersonation session. 'active': within its grant. 'ended'.

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

-- 4. Audit attribution -----------------------------------------------------------
-- The operator's email: from the signed token of an impersonation session, or
-- from x-audit-impersonator when the server writes on its behalf with the
-- service role (a browser can't send that as the service role).

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

create or replace function public.audit_logs_fill()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
declare
    v_ip text;
begin
    new.meta_json := coalesce(new.meta_json, '{}'::jsonb);

    -- No session user: the person a service-role caller named, else the one
    -- a billing trigger attributes this to. Still null for true system work.
    if new.actor_id is null then
        new.actor_id := coalesce(
            public.audit_trusted_actor(),
            public.audit_fallback_actor()
        );
    end if;

    -- Who it was, as they were then. Never taken from the writer: a client
    -- could otherwise put any name on its own row.
    new.meta_json := new.meta_json - 'actor' - 'impersonated_by';

    -- Platform support acting as this user (never taken from the writer).
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

    -- current_user is the API role only for a direct PostgREST insert; inside
    -- audit_record() and the other SECURITY DEFINER writers it is the owner.
    -- A client-sent module is never kept.
    if new.module is null
       or new.module = 'general'
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

-- 5. Token hook and lock ----------------------------------------------------------

create or replace function public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
    claims          jsonb;
    app_metadata    jsonb;
    preferred_tenant uuid;
    v_tenant_id     uuid;
    v_tenant_role   text;
    v_tenant_slug   text;
    v_membership_id uuid;
    v_imp_tenant    uuid;
    v_imp_by        text;
begin
    --------------------------------------------------------
    -- Existing JWT claims
    --------------------------------------------------------

    claims := COALESCE(event -> 'claims', '{}'::jsonb);

    app_metadata := COALESCE(claims -> 'app_metadata', '{}'::jsonb);

    -- Validated before the cast rather than caught after it: this function runs
    -- inside token minting, so anything it raises is a failed sign-in, and
    -- app_metadata is writable by anything that can reach the user record.
    preferred_tenant := case
        when app_metadata ->> 'preferred_tenant_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then (app_metadata ->> 'preferred_tenant_id')::uuid
        else null
    end;

    --------------------------------------------------------
    -- Pick the caller's membership.
    --
    -- One token carries one tenant_id / tenant_role / tenant_slug, and every RLS
    -- policy in the database reads those three claims, so this ORDER BY is a
    -- permission decision about which workspace the session acts in -- not a
    -- display detail. It was `created_at` alone, i.e. whichever membership row
    -- was inserted first, which nobody chose and nobody can see.
    --
    --   * active before invited: an invite is not access until it is accepted;
    --   * the preferred workspace, if the caller has a membership in it;
    --   * staff before customer: an agent of one workspace who is also a portal
    --     customer of another lands in the one where the agent shell works. The
    --     portal reads through the admin client and is unaffected either way.
    --
    -- Every candidate is still a real, non-disabled membership, so the claims
    -- can only ever name a tenant the user belongs to.
    --------------------------------------------------------

    select
        m.id,
        m.tenant_id,
        m.role::text,
        t.slug
    into
        v_membership_id,
        v_tenant_id,
        v_tenant_role,
        v_tenant_slug
    from public.memberships m
    join public.tenants t
        on t.id = m.tenant_id
    where m.user_id = (event ->> 'user_id')::uuid
      and m.status <> 'disabled'
    order by
        case
            when m.status = 'active' then 0
            else 1
        end,
        case
            when preferred_tenant is not null
                 and m.tenant_id = preferred_tenant then 0
            else 1
        end,
        case
            when m.role <> 'customer' then 0
            else 1
        end,
        -- created_at, then id: two memberships inserted in one transaction share
        -- a timestamp, and without the id the choice would vary between calls.
        m.created_at,
        m.id
    limit 1;

    --------------------------------------------------------
    -- Platform support signed in as this user (impersonation_sessions).
    --
    -- The session is pinned to the workspace that granted access, whatever
    -- the user's preferred workspace is, and carries impersonated_by so the
    -- app shows its banner and every audit entry names the operator. The
    -- claim stays after the session ends: impersonation_state() then locks
    -- the data and the proxy signs the browser out.
    --------------------------------------------------------

    select s.tenant_id, s.platform_admin_email
    into v_imp_tenant, v_imp_by
    from public.impersonation_sessions s
    where s.auth_session_id = case
        when claims ->> 'session_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then (claims ->> 'session_id')::uuid
    end;

    if v_imp_by is not null then
        v_membership_id := null;
        v_tenant_id := null;
        v_tenant_role := null;
        v_tenant_slug := null;

        select m.id, m.tenant_id, m.role::text, t.slug
        into v_membership_id, v_tenant_id, v_tenant_role, v_tenant_slug
        from public.memberships m
        join public.tenants t
            on t.id = m.tenant_id
        where m.user_id = (event ->> 'user_id')::uuid
          and m.tenant_id = v_imp_tenant
          and m.status = 'active';

        claims := jsonb_set(claims, '{impersonated_by}', to_jsonb(v_imp_by), true);
    end if;

    --------------------------------------------------------
    -- Activate the invite on first sign-in (idempotent).
    --------------------------------------------------------

    if v_membership_id is not null then
        update public.memberships
        set
            status = 'active',
            joined_at = COALESCE(joined_at, now()),
            updated_at = now()
        where id = v_membership_id
          and status = 'invited';
    end if;

    --------------------------------------------------------
    -- Add tenant_id claim
    --------------------------------------------------------

    if v_tenant_id is not null then
        claims := jsonb_set(
            claims,
            '{tenant_id}',
            to_jsonb(v_tenant_id),
            true
        );
    end if;

    --------------------------------------------------------
    -- Add tenant_role claim
    --------------------------------------------------------

    if v_tenant_role is not null then
        claims := jsonb_set(
            claims,
            '{tenant_role}',
            to_jsonb(v_tenant_role),
            true
        );
    end if;

    --------------------------------------------------------
    -- Add tenant_slug claim
    --------------------------------------------------------

    if v_tenant_slug is not null then
        claims := jsonb_set(
            claims,
            '{tenant_slug}',
            to_jsonb(v_tenant_slug),
            true
        );
    end if;

    --------------------------------------------------------
    -- Update event claims
    --------------------------------------------------------

    event := jsonb_set(
        event,
        '{claims}',
        claims,
        true
    );

    return event;
end;
$$;

create or replace function public.current_workspace_block()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
    select case
        -- An impersonation session whose grant has ended reads as an admin
        -- block: every tenant table's restrictive policy then refuses it.
        when public.impersonation_state() = 'ended' then 'admin'
        when t.status = 'suspended' then coalesce(t.block_source, 'admin')
    end
    from public.tenants t
    where t.id = nullif(auth.jwt() ->> 'tenant_id', '')::uuid;
$$;

commit;
