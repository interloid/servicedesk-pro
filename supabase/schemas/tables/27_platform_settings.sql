-- =====================================================
-- Platform Settings
-- One row of platform-wide configuration, edited from the /platform console.
-- allow_signups gates new workspaces (registerTenant); maintenance_mode puts
-- every workspace and portal behind a maintenance screen.
--
-- Read and written only by the service role (the console, the tenant layouts,
-- onboarding); RLS is on with no policies, so no browser client can touch it.
-- =====================================================

create table if not exists public.platform_settings
(
    -- Pins the table to a single row.
    id boolean primary key
        default true
        constraint chk_platform_settings_singleton
            check (id),

    platform_name text
        not null
        default 'ServiceDeskPro'
        constraint chk_platform_settings_name
            check (char_length(btrim(platform_name)) between 1 and 80),

    support_email citext
        not null
        default 'support@servicedeskpro.com',

    allow_signups boolean
        not null
        default true,

    maintenance_mode boolean
        not null
        default false,

    -- Block a workspace when its subscription is cancelled over failed payments
    -- (functions/29_tenant_blocking.sql).
    block_on_payment_failure boolean
        not null
        default true,

    updated_by uuid
        references auth.users(id)
        on delete set null,

    updated_at timestamptz
        not null
        default now()
);

alter table public.platform_settings enable row level security;

insert into public.platform_settings (id)
values (true)
on conflict (id) do nothing;
