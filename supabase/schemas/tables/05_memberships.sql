-- ==========================================================
-- File: 05_memberships.sql
-- ==========================================================

create table if not exists public.memberships
(
    id uuid primary key
        default gen_random_uuid(),

    tenant_id uuid
        not null
        references public.tenants(id)
        on delete cascade,

    user_id uuid
        not null
        references public.users(id)
        on delete cascade,

    -- The access tier (roles.base_role of role_id), kept in step by the
    -- apply_membership_role trigger. RLS and the tenant_role claim read this;
    -- role_id says which named role the member holds.
    role text
        not null
        constraint chk_memberships_role
            check (role in (
                'platform_admin',
                'tenant_admin',
                'manager',
                'agent',
                'billing_admin',
                'customer'
            )),

    role_id uuid
        not null
        references public.roles(id)
        on delete restrict,

    status membership_status
        not null
        default 'invited',

    invited_by uuid
        references public.users(id),

    joined_at timestamptz,

    disabled_at timestamptz,

    -- The workspace owner. Set by provision_tenant at signup, moved only by
    -- transfer_tenant_ownership(); protect_primary_membership() guards it.
    is_primary boolean
        not null
        default false,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    constraint uq_membership
        unique(tenant_id, user_id)
);

-- One owner per workspace.
create unique index if not exists uq_memberships_primary_per_tenant
    on public.memberships (tenant_id)
    where is_primary;

create index if not exists idx_memberships_role_id
    on public.memberships (role_id);
