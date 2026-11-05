-- Platform console settings (2026-10-31). Mirrors
-- supabase/schemas/tables/27_platform_settings.sql.

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

-- /platform and /maintenance are app routes now, so no new workspace may take
-- them as its address. NOT VALID like the original: existing rows are untouched.
alter table public.tenants
    drop constraint if exists tenants_slug_not_reserved;

alter table public.tenants
    add constraint tenants_slug_not_reserved
    check (
        slug <> all (array[
            'www',
            'app',
            'api',
            'admin',
            'auth',
            'static',
            'assets',
            'cdn',
            'mail',
            'login',
            'signup',
            'setup',
            'contact-sales',
            'forgot-password',
            'reset-password',
            'tickets',
            'views',
            'customers',
            'reports',
            'settings',
            'account',
            'billing',
            'plans',
            'payment',
            'sla',
            'kb',
            'macros',
            'unauthorized',
            'portal',
            'platform',
            'maintenance'
        ])
    ) not valid;

comment on constraint tenants_slug_not_reserved on public.tenants is
'Reserved labels are the app''s own paths (RESERVED_LABELS in src/lib/tenancy.ts). A workspace on one of them shadows a central route -- a tenant called "portal" takes /portal/requests for its own queue and makes its own portal unreachable. NOT VALID: enforced for new and updated rows only, so an existing address is never rewritten by a migration.';
