-- SEC-002, SEC-003, SEC-030 (docs/security/security-remediation-tracker.md).
-- Mirrors supabase/schemas/policies/03_users.sql and 04_memberships.sql.

-- Memberships are written by the service role only. Team and customer invites,
-- role and status changes and removal all go through server code that checks the
-- caller first; ownership transfer and the token hook are SECURITY DEFINER. The
-- client policies were only reachable through direct API calls, where they let:
--   * a Manager create a Tenant Admin;
--   * a Tenant Admin attach any user, by insert or by rewriting user_id;
--   * a removed member's unexpired token grant lasting access.
drop policy if exists "memberships_insert" on public.memberships;
drop policy if exists "memberships_update" on public.memberships;
drop policy if exists "memberships_delete" on public.memberships;

-- public.users is global, so a workspace role must not reach it: deleting a row
-- removes that person's memberships in every workspace. No application code
-- deletes users, or edits anyone's profile but the caller's own.
drop policy if exists "users_delete" on public.users;
drop policy if exists "users_update" on public.users;

create policy "users_update"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());
