-- =====================================================
-- File: 34_roles.sql
-- Description: Keep memberships.role in step with roles, guard the catalogue
-- =====================================================

-- memberships.role (the tier) and memberships.role_id (the named role) must
-- agree. Writers may set either:
--   * role_id set or changed  -> role becomes that role's base_role. A role
--     that is archived can't be newly handed out.
--   * only role set/changed   -> role_id becomes the system role of that tier
--     (provision_tenant, the portal, transfer_tenant_ownership and older code
--     write the tier only).
-- Named so it sorts before enforce_team_seat_limit and
-- protect_primary_membership: BEFORE triggers fire in name order, and both
-- read NEW.role.
create or replace function public.apply_membership_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_base   text;
    v_status text;
begin
    if new.role_id is not null
       and (tg_op = 'INSERT' or new.role_id is distinct from old.role_id) then
        select r.base_role, r.status
        into v_base, v_status
        from public.roles r
        where r.id = new.role_id;

        if v_base is null then
            raise exception 'Unknown role %', new.role_id
                using errcode = '23503';
        end if;

        if v_status <> 'active' then
            raise exception 'That role is archived and can''t be assigned.'
                using errcode = '23514';
        end if;

        new.role := v_base;
    elsif new.role is not null
       and (tg_op = 'INSERT' or new.role is distinct from old.role) then
        select r.id
        into new.role_id
        from public.roles r
        where r.key = new.role
          and r.is_system;

        if new.role_id is null then
            raise exception 'Unknown role %', new.role
                using errcode = '23514';
        end if;
    end if;

    return new;
end;
$$;

revoke execute on function public.apply_membership_role() from public, anon, authenticated;


-- System rows are the tiers every policy is written against: their key, tier
-- and system flag are fixed and they stay active. A custom role's tier is
-- fixed once anyone holds it -- re-tiering would silently change what every
-- holder, in every workspace, can reach.
create or replace function public.guard_roles()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if tg_op = 'DELETE' then
        if old.is_system then
            raise exception 'Built-in roles can''t be deleted.'
                using errcode = '42501';
        end if;

        return old;
    end if;

    if tg_op = 'UPDATE' then
        if new.key is distinct from old.key then
            raise exception 'A role''s key can''t be changed.'
                using errcode = '42501';
        end if;

        if new.is_system is distinct from old.is_system then
            raise exception 'A role can''t be made built-in or custom.'
                using errcode = '42501';
        end if;

        if old.is_system
           and (new.base_role is distinct from old.base_role
                or new.status <> 'active') then
            raise exception 'Built-in roles can''t be re-tiered or archived.'
                using errcode = '42501';
        end if;

        if new.base_role is distinct from old.base_role
           and exists (
               select 1 from public.memberships m where m.role_id = old.id
           ) then
            raise exception 'This role is held by members, so its access level can''t change.'
                using errcode = '23514';
        end if;

        new.updated_at := now();
    end if;

    return new;
end;
$$;

revoke execute on function public.guard_roles() from public, anon, authenticated;


-- Display name of a membership's role for audit summaries: the named role
-- when there is one, else the tier label.
create or replace function public.audit_membership_role_label(
    p_role_id uuid,
    p_role text
)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (select r.name from public.roles r where r.id = p_role_id),
        public.audit_role_label(p_role)
    );
$$;

revoke execute on function public.audit_membership_role_label(uuid, text) from public, anon, authenticated;
