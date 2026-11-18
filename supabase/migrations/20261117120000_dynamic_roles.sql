-- Dynamic roles (2026-11-11). Replaces the membership_role enum with the
-- public.roles table, managed from the platform console (/platform/roles).
--
-- Mirrors:
--   schemas/tables/04a_roles.sql, schemas/tables/05_memberships.sql,
--   schemas/functions/34_roles.sql, schemas/functions/19_audit_log.sql,
--   schemas/triggers/memberships_apply_role.sql, roles_guard.sql,
--   memberships_seat_limit.sql, schemas/policies/23_roles.sql,
--   schemas/policies/22_payment_methods.sql
--
-- memberships.role stays as the access tier (now text, same six values), so
-- the tenant_role JWT claim and every RLS policy keep working unchanged.
-- memberships.role_id names the role the member holds; every existing row is
-- backfilled to the built-in role of its tier.

begin;

-- 1. Roles catalogue ---------------------------------------------------------

create table if not exists public.roles
(
    id uuid primary key
        default gen_random_uuid(),

    -- Stable machine name. Never shown; never changes once created.
    key text
        not null
        constraint uq_roles_key unique
        constraint chk_roles_key
            check (key ~ '^[a-z][a-z0-9_]{1,49}$'),

    name text
        not null
        constraint chk_roles_name
            check (char_length(btrim(name)) between 1 and 60),

    description text
        not null
        default ''
        constraint chk_roles_description
            check (char_length(description) <= 300),

    base_role text
        not null
        constraint chk_roles_base_role
            check (base_role in (
                'platform_admin',
                'tenant_admin',
                'manager',
                'agent',
                'billing_admin',
                'customer'
            )),

    is_system boolean
        not null
        default false,

    status text
        not null
        default 'active'
        constraint chk_roles_status
            check (status in ('active', 'archived')),

    sort_order integer
        not null
        default 100,

    created_by uuid
        references auth.users(id)
        on delete set null,

    updated_by uuid
        references auth.users(id)
        on delete set null,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    -- A system row IS its tier.
    constraint chk_roles_system_key
        check (not is_system or key = base_role),

    -- Custom roles are staff roles: platform_admin is ours, and customers
    -- are created by the portal, never picked from a role list.
    constraint chk_roles_custom_base
        check (is_system or base_role in (
            'tenant_admin',
            'manager',
            'agent',
            'billing_admin'
        ))
);

create unique index if not exists uq_roles_name_ci
    on public.roles (lower(btrim(name)));

create index if not exists idx_roles_base_role
    on public.roles (base_role);

alter table public.roles enable row level security;

insert into public.roles (key, name, description, base_role, is_system, sort_order)
values
    ('tenant_admin', 'Tenant Admin',
     'Has full control over the workspace, including team management, settings, billing, and subscriptions.',
     'tenant_admin', true, 0),
    ('manager', 'Manager',
     'Manages tickets and team members, assigns work, and oversees day-to-day support operations.',
     'manager', true, 10),
    ('agent', 'Agent',
     'Handles assigned tickets, communicates with customers, and works on resolving support requests.',
     'agent', true, 20),
    ('billing_admin', 'Billing Admin',
     'Manages billing, subscriptions, invoices, payment methods, and plan-related changes.',
     'billing_admin', true, 30),
    ('customer', 'Customer',
     'Raises and follows their own requests through the customer portal.',
     'customer', true, 90),
    ('platform_admin', 'Platform Admin',
     'Platform operator account. Not part of any workspace team.',
     'platform_admin', true, 99)
on conflict (key) do nothing;

-- 2. memberships.role_id, backfilled from the tier --------------------------

alter table public.memberships
    add column if not exists role_id uuid
        references public.roles(id)
        on delete restrict;

update public.memberships m
set role_id = r.id
from public.roles r
where r.key = m.role::text
  and r.is_system
  and m.role_id is null;

alter table public.memberships
    alter column role_id set not null;

create index if not exists idx_memberships_role_id
    on public.memberships (role_id);

-- 3. memberships.role: enum -> text ------------------------------------------
-- The payment_methods policies read memberships.role directly, and a column
-- used in a policy can't change type, so they are dropped and recreated
-- word for word.

drop policy if exists "Tenants can view own payment methods" on public.payment_methods;
drop policy if exists "Tenants can insert own payment methods" on public.payment_methods;
drop policy if exists "Tenants can update own payment methods" on public.payment_methods;
drop policy if exists "Tenants can delete own payment methods" on public.payment_methods;

-- Likewise a trigger with a column list naming role; recreated in step 4.
drop trigger if exists enforce_team_seat_limit on public.memberships;

alter table public.memberships
    alter column role type text using role::text;

-- Dropped first so a re-run after a failed attempt doesn't trip over it.
alter table public.memberships
    drop constraint if exists chk_memberships_role;

alter table public.memberships
    add constraint chk_memberships_role
        check (role in (
            'platform_admin',
            'tenant_admin',
            'manager',
            'agent',
            'billing_admin',
            'customer'
        ));

create policy "Tenants can view own payment methods"
    on public.payment_methods
    for select
    using (
        tenant_id in (
            select tenant_id from public.memberships
            where user_id = auth.uid()
            and status = 'active'
            and role in ('tenant_admin', 'billing_admin')
        )
    );

create policy "Tenants can insert own payment methods"
    on public.payment_methods
    for insert
    with check (
        tenant_id in (
            select tenant_id from public.memberships
            where user_id = auth.uid()
            and status = 'active'
            and role in ('tenant_admin', 'billing_admin')
        )
    );

create policy "Tenants can update own payment methods"
    on public.payment_methods
    for update
    using (
        tenant_id in (
            select tenant_id from public.memberships
            where user_id = auth.uid()
            and status = 'active'
            and role in ('tenant_admin', 'billing_admin')
        )
    );

create policy "Tenants can delete own payment methods"
    on public.payment_methods
    for delete
    using (
        tenant_id in (
            select tenant_id from public.memberships
            where user_id = auth.uid()
            and status = 'active'
            and role in ('tenant_admin', 'billing_admin')
        )
    );

-- Any other column still typed membership_role becomes text too. The live
-- database has one no migration created: sla_policies.escalate_to_role was
-- added by hand as membership_role (20261002120000 then skipped it with ADD
-- COLUMN IF NOT EXISTS), and its check constraint compares against enum
-- literals. Each such column's default and check constraints are carried
-- over with the enum casts rewritten to text, so they read the same.
do $$
declare
    col record;
    con record;
    v_default text;
    v_checks text[];
    v_check text;
begin
    for col in
        select c.oid as rel, format('%I.%I', n.nspname, c.relname) as tbl, a.attname
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
        where a.atttypid = 'public.membership_role'::regtype
          and a.attnum > 0
          and not a.attisdropped
          and c.relkind in ('r', 'p')
    loop
        v_checks := '{}';

        for con in
            select conname, pg_get_constraintdef(oid) as def
            from pg_constraint
            where conrelid = col.rel
              and contype = 'c'
              and pg_get_constraintdef(oid) ~ 'membership_role'
        loop
            v_checks := v_checks || format(
                'alter table %s add constraint %I %s',
                col.tbl,
                con.conname,
                regexp_replace(con.def, '::(public\.)?membership_role', '::text', 'g')
            );
            execute format('alter table %s drop constraint %I', col.tbl, con.conname);
        end loop;

        select regexp_replace(pg_get_expr(d.adbin, d.adrelid), '::(public\.)?membership_role', '::text', 'g')
        into v_default
        from pg_attrdef d
        join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
        where d.adrelid = col.rel and a.attname = col.attname;

        execute format('alter table %s alter column %I drop default', col.tbl, col.attname);
        execute format(
            'alter table %s alter column %I type text using %I::text',
            col.tbl, col.attname, col.attname
        );

        if v_default is not null then
            execute format('alter table %s alter column %I set default %s', col.tbl, col.attname, v_default);
        end if;

        foreach v_check in array v_checks loop
            execute v_check;
        end loop;

        raise notice 'Converted %.% from membership_role to text', col.tbl, col.attname;
    end loop;
end
$$;

drop type if exists public.membership_role;

-- 4. Keep role and role_id in step; guard the catalogue ----------------------

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

drop trigger if exists apply_membership_role on public.memberships;

create trigger apply_membership_role
before insert or update of role, role_id on public.memberships
for each row
execute function public.apply_membership_role();

drop trigger if exists guard_roles on public.roles;

create trigger guard_roles
before update or delete on public.roles
for each row
execute function public.guard_roles();

-- The seat check must also run when only role_id is written.
create trigger enforce_team_seat_limit
before insert or update of role, role_id, status, tenant_id on public.memberships
for each row
execute function public.enforce_team_seat_limit();

-- 5. Audit: name the role, and record moves between roles of one tier --------

create or replace function public.audit_memberships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.memberships := case when tg_op = 'DELETE' then old else new end;
    v_who text;
    v_role text;
    v_meta jsonb;
begin
    -- transfer_tenant_ownership() and provision_tenant() write their own row.
    if coalesce(current_setting('app.ownership_change', true), '') = 'on' then
        return null;
    end if;

    select coalesce(nullif(u.email::text, ''), u.full_name)
    into v_who
    from public.users u
    where u.id = v_row.user_id;

    v_who := coalesce(v_who, 'a member');
    v_role := v_row.role::text;
    v_meta := jsonb_build_object(
        'role', v_role,
        'target_user_id', v_row.user_id,
        'target_email', v_who
    );

    if tg_op = 'INSERT' then
        perform public.audit_record(
            new.tenant_id,
            case when new.status::text = 'invited' then 'invite' else 'create' end::public.audit_action,
            'membership',
            new.id,
            v_meta || jsonb_build_object(
                'summary',
                case when new.status::text = 'invited'
                    then format('Invited %s as %s', v_who, public.audit_membership_role_label(new.role_id, v_role))
                    else format('Added %s as %s', v_who, public.audit_membership_role_label(new.role_id, v_role))
                end
            )
        );
    elsif tg_op = 'DELETE' then
        perform public.audit_record(
            old.tenant_id,
            'delete',
            'membership',
            old.id,
            v_meta || jsonb_build_object(
                'summary',
                case when old.status::text = 'invited'
                    then format('Revoked the invitation for %s', v_who)
                    else format('Removed %s from the workspace', v_who)
                end
            )
        );
    else
        -- role_id too: two custom roles can share a tier.
        if new.role is distinct from old.role
           or new.role_id is distinct from old.role_id then
            perform public.audit_record(
                new.tenant_id,
                'role_change',
                'membership',
                new.id,
                v_meta || jsonb_build_object(
                    'summary',
                    format(
                        'Changed role of %s from %s to %s',
                        v_who,
                        public.audit_membership_role_label(old.role_id, old.role),
                        public.audit_membership_role_label(new.role_id, new.role)
                    ),
                    'changes',
                    jsonb_build_object('role', jsonb_build_object(
                        'from', public.audit_membership_role_label(old.role_id, old.role),
                        'to', public.audit_membership_role_label(new.role_id, new.role)
                    ))
                )
            );
        end if;

        if new.status is distinct from old.status then
            perform public.audit_record(
                new.tenant_id,
                'update',
                'membership',
                new.id,
                v_meta || jsonb_build_object(
                    'summary',
                    case
                        when old.status::text = 'invited' and new.status::text = 'active'
                            then format('%s accepted the invitation', v_who)
                        when new.status::text = 'disabled'
                            then format('Deactivated %s', v_who)
                        when old.status::text = 'disabled' and new.status::text = 'active'
                            then format('Reactivated %s', v_who)
                        else format('Changed status of %s to %s', v_who, new.status)
                    end,
                    'changes',
                    jsonb_build_object('status', jsonb_build_object(
                        'from', initcap(old.status::text),
                        'to', initcap(new.status::text)
                    ))
                )
            );
        end if;
    end if;

    return null;
end;
$$;

-- 6. RLS ---------------------------------------------------------------------

drop policy if exists "roles_select" on public.roles;

create policy "roles_select"
    on public.roles
    for select
    to authenticated
    using (true);

commit;
