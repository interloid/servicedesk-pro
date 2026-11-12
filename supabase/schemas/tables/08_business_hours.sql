-- ==========================================================
-- File: 08_business_hours.sql
-- ==========================================================

create table if not exists public.business_hours
(
    id uuid primary key
        default gen_random_uuid(),

    tenant_id uuid
        not null
        references public.tenants(id)
        on delete cascade,

    name text
        not null,

    timezone_id UUID NOT NULL
        REFERENCES public.timezones(id),

    schedule_json jsonb
        not null,

    holidays_json jsonb
        not null default '[]'::jsonb,

    created_at timestamptz
        default now(),

    updated_at timestamptz
        default now(),

    -- Tenant-consistent keys (SEC-032, migration 20261112130000): a reference
    -- to another workspace-owned row must stay in the same workspace.
    constraint business_hours_tenant_id_id_key
        unique (tenant_id, id)
);

