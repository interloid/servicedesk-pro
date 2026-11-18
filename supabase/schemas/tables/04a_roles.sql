-- =====================================================
-- File: 04a_roles.sql
-- Description: Roles catalogue (replaces the membership_role enum)
--
-- Every role a membership can hold is a row here. The platform console
-- (/platform/roles) creates, renames and archives them.
--
-- `base_role` is the access tier: the value memberships.role carries, the
-- tenant_role JWT claim and every RLS policy compare against. A custom role
-- ("Senior Agent", "Finance") gets exactly its tier's access; what makes it
-- custom is its name and description. The six system rows are the tiers
-- themselves (key = base_role) and can't be archived, re-tiered or deleted.
--
-- Read by any signed-in user (the Team page lists them); written only by the
-- service role, i.e. the console after requirePlatformAdmin().
-- =====================================================

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
