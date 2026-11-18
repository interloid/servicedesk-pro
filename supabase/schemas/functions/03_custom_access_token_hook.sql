-- ==========================================================
-- File: 03_custom_access_token_hook.sql
-- Description: Choose one workspace for the session and publish it as claims
-- ==========================================================

BEGIN;

------------------------------------------------------------
-- Update Access Token Hook
------------------------------------------------------------
--
-- One token carries one tenant_id / tenant_role / tenant_slug, and every RLS
-- policy in the database reads those three claims. The ORDER BY below is
-- therefore a permission decision about which workspace the session acts in --
-- not a display detail.

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

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
'Supabase Auth custom access token hook. Picks one workspace for the session and writes tenant_id / tenant_role / tenant_slug, which every RLS policy reads.';

------------------------------------------------------------
-- Permissions
------------------------------------------------------------

GRANT USAGE
ON SCHEMA public
TO supabase_auth_admin;

GRANT EXECUTE
ON FUNCTION public.custom_access_token_hook(jsonb)
TO supabase_auth_admin;

-- The hook reads memberships/tenants and activates invites.
GRANT SELECT, UPDATE
ON TABLE public.memberships
TO supabase_auth_admin;

GRANT SELECT
ON TABLE public.tenants
TO supabase_auth_admin;

REVOKE EXECUTE
ON FUNCTION public.custom_access_token_hook(jsonb)
FROM authenticated, anon, public;

COMMIT;