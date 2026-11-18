-- =====================================================
-- File: 29_impersonation_sessions.sql
-- Description: Platform support signed in as a workspace's Tenant Admin
-- (migration 20261117160000). See functions/36_impersonation.sql.
-- =====================================================

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
