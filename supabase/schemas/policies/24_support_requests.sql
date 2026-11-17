-- =====================================================
-- Support request policies
-- An active Tenant Admin reads their own workspace's requests and messages.
-- No client writes: the app writes with the service role after its checks.
-- =====================================================

alter table public.support_requests enable row level security;
alter table public.support_request_messages enable row level security;

drop policy if exists "support_requests_select" on public.support_requests;

create policy "support_requests_select"
    on public.support_requests
    for select
    to authenticated
    using (
        tenant_id = public.current_tenant_id()
        and public.current_tenant_role() = 'tenant_admin'
        and public.is_active_membership()
    );

drop policy if exists "support_request_messages_select" on public.support_request_messages;

create policy "support_request_messages_select"
    on public.support_request_messages
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.support_requests r
            where r.id = request_id
              and r.tenant_id = public.current_tenant_id()
        )
        and public.current_tenant_role() = 'tenant_admin'
        and public.is_active_membership()
    );
