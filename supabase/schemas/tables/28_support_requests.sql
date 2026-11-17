-- =====================================================
-- File: 28_support_requests.sql
-- Description: Workspace -> platform support requests
--
-- A Tenant Admin raises a request from Help & Support; platform admins answer
-- it from /platform/support. Written only by the service role, after the app
-- has checked the caller (tenant: an active Tenant Admin of that workspace;
-- platform: requirePlatformAdmin). Tenant Admins may read their own
-- workspace's rows (policies/24_support_requests.sql).
--
-- allow_workspace_access / access_expires_at: the tenant's consent to the
-- read-only "In-Person View". It holds only while granted, unexpired and the
-- request is not resolved or closed (computed in the app, see support-access.ts).
-- =====================================================

create table if not exists public.support_requests
(
    id uuid primary key
        default gen_random_uuid(),

    -- Shown as SR-1001, SR-1002, ...
    number bigint
        generated always as identity (start with 1001)
        constraint uq_support_requests_number unique,

    tenant_id uuid
        not null
        references public.tenants(id)
        on delete cascade,

    created_by uuid
        references public.users(id)
        on delete set null,

    subject text
        not null
        constraint chk_support_requests_subject
            check (char_length(btrim(subject)) between 3 and 150),

    description text
        not null
        constraint chk_support_requests_description
            check (char_length(btrim(description)) between 10 and 5000),

    status text
        not null
        default 'open'
        constraint chk_support_requests_status
            check (status in ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed')),

    allow_workspace_access boolean
        not null
        default false,

    access_granted_at timestamptz,

    access_expires_at timestamptz,

    -- The Tenant Admin who turned access on: the only one support may sign in
    -- as (migration 20261117160000).
    access_granted_by uuid
        references public.users(id)
        on delete set null,

    resolved_at timestamptz,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    constraint chk_support_requests_access
        check (not allow_workspace_access or access_expires_at is not null)
);

create index if not exists idx_support_requests_tenant_created
    on public.support_requests (tenant_id, created_at desc);

create index if not exists idx_support_requests_status_updated
    on public.support_requests (status, updated_at desc);

alter table public.support_requests enable row level security;


create table if not exists public.support_request_messages
(
    id uuid primary key
        default gen_random_uuid(),

    request_id uuid
        not null
        references public.support_requests(id)
        on delete cascade,

    author_type text
        not null
        constraint chk_support_messages_author_type
            check (author_type in ('tenant', 'platform')),

    -- No foreign key: a platform operator may have no users row.
    author_id uuid,

    -- Snapshot, so the thread still reads right after an account is renamed or removed.
    author_name text
        not null,

    body text
        not null
        constraint chk_support_messages_body
            check (char_length(btrim(body)) between 1 and 5000),

    created_at timestamptz
        not null
        default now()
);

create index if not exists idx_support_messages_request_created
    on public.support_request_messages (request_id, created_at);

alter table public.support_request_messages enable row level security;
