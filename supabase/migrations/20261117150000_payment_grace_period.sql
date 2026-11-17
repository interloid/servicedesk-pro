-- Grace period for failed subscription payments (2026-11-17).
--
-- One failed charge never closes a subscription. The first failure opens a
-- grace period of platform_settings.payment_grace_days (default 14); the plan,
-- seats and features stay while PayPal retries, and any successful charge
-- closes it (supabase/functions/_shared/payment-grace.ts). When it runs out
-- unpaid, reconcile-subscriptions moves the workspace to Free -- and the
-- workspace keeps access. Payment trouble no longer blocks a workspace.
--
-- Mirrors schemas/tables/27_platform_settings.sql and
-- schemas/functions/29_tenant_blocking.sql.

begin;

alter table public.platform_settings
    add column if not exists payment_grace_days integer
        not null
        default 14;

alter table public.platform_settings
    drop constraint if exists chk_platform_settings_payment_grace_days;

alter table public.platform_settings
    add constraint chk_platform_settings_payment_grace_days
        check (payment_grace_days between 1 and 30);

comment on column public.platform_settings.payment_grace_days is
    'Days a workspace keeps its paid plan after its first failed subscription '
    'payment. Afterwards, still unpaid, it moves to Free and keeps access.';

-- No longer read: a workspace is never blocked over payments now.
comment on column public.platform_settings.block_on_payment_failure is
    'Deprecated (20261117150000). Unused: failed payments end in the Free plan, never a block.';

-- Only lifts a block an earlier version of this trigger made (when the
-- workspace subscribes again); it no longer sets one.
create or replace function public.subscriptions_sync_tenant_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if old.cancellation_source is not null and new.cancellation_source is null then
        update public.tenants
        set status = 'active',
            block_source = null,
            block_reason = null,
            blocked_at = null
        where id = new.tenant_id
          and status = 'suspended'
          and block_source = 'payment'
          and deleted_at is null;
    end if;

    return null;
end;
$$;

-- Workspaces blocked over payments under the old rule get access back: they
-- are on Free already (the block came after the move), which is where the new
-- rule leaves them. A block a platform admin set is not touched.
update public.tenants
set status = 'active',
    block_source = null,
    block_reason = null,
    blocked_at = null
where status = 'suspended'
  and block_source = 'payment'
  and deleted_at is null;

commit;
