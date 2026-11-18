-- =====================================================
-- Roles policies
-- Any signed-in user may read the catalogue (the Team page lists it). No
-- client writes: the platform console writes with the service role.
-- =====================================================

alter table public.roles enable row level security;

drop policy if exists "roles_select" on public.roles;

create policy "roles_select"
    on public.roles
    for select
    to authenticated
    using (true);
