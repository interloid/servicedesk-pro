-- Workspace blocking (2026-11-03). Mirrors supabase/schemas/tables/03_tenants.sql,
-- 27_platform_settings.sql and functions/29_tenant_blocking.sql.

alter table public.tenants
    add column if not exists block_reason text,
    add column if not exists block_source text,
    add column if not exists blocked_at timestamptz;

alter table public.tenants
    drop constraint if exists chk_tenants_block_source;

alter table public.tenants
    add constraint chk_tenants_block_source
    check (block_source is null or block_source in ('admin', 'payment'));

alter table public.platform_settings
    add column if not exists block_on_payment_failure boolean not null default true;

-- /blocked is an app route now, so no new workspace may take it as its address.
-- NOT VALID like the original: existing rows are untouched.
alter table public.tenants
    drop constraint if exists tenants_slug_not_reserved;

alter table public.tenants
    add constraint tenants_slug_not_reserved
    check (
        slug <> all (array[
            'www', 'app', 'api', 'admin', 'auth', 'static', 'assets', 'cdn', 'mail',
            'login', 'signup', 'setup', 'contact-sales', 'forgot-password',
            'reset-password', 'tickets', 'views', 'customers', 'reports', 'settings',
            'account', 'billing', 'plans', 'payment', 'sla', 'kb', 'macros',
            'unauthorized', 'portal', 'platform', 'maintenance', 'blocked'
        ])
    ) not valid;

-- Workspace blocking (tenants.status = 'suspended'), set from the /platform
-- console or automatically below. The proxy enforces it; see workspaceGate.

-- A Tenant Admin may update their own tenants row (name, branding), so without
-- this they could lift a block with one request. Only a direct write from a
-- signed-in or anonymous caller is held back: the console and the billing
-- functions use the service role, and the trigger below runs nested.
create or replace function public.tenants_guard_block()
returns trigger
language plpgsql
as $$
declare
    v_role text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
begin
    if pg_trigger_depth() = 1 and v_role in ('authenticated', 'anon') then
        new.status := old.status;
        new.block_reason := old.block_reason;
        new.block_source := old.block_source;
        new.blocked_at := old.blocked_at;
    end if;

    return new;
end;
$$;

drop trigger if exists tenants_guard_block on public.tenants;

create trigger tenants_guard_block
before update on public.tenants
for each row
execute function public.tenants_guard_block();

-- Blocks a workspace when billing gives up on it, and lifts that block when it
-- subscribes again. Not on the failure count: PayPal retries on its own schedule
-- and a customer with an expiring card is still a paying customer meanwhile. The
-- moment that counts is the subscription being cancelled over it:
--   * 'system': reconcile-subscriptions, once the grace period ran out unpaid;
--   * 'paypal' during payment trouble: PayPal cancelled it itself.
-- A new subscription clears cancellation_source. Only a block this trigger made
-- is ever lifted here, never one a platform admin set.
create or replace function public.subscriptions_sync_tenant_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_gave_up boolean :=
        new.cancellation_source is distinct from old.cancellation_source
        and (
            new.cancellation_source = 'system'
            or (
                new.cancellation_source = 'paypal'
                and (
                    coalesce(old.payment_failure_count, 0) > 0
                    or old.grace_period_ends_at is not null
                )
            )
        );
begin
    if v_gave_up then
        if coalesce(
            (select block_on_payment_failure from public.platform_settings where id),
            true
        ) then
            update public.tenants
            set status = 'suspended',
                block_source = 'payment',
                block_reason = 'Subscription cancelled after failed payments.',
                blocked_at = now()
            where id = new.tenant_id
              and status = 'active';
        end if;
    elsif old.cancellation_source is not null and new.cancellation_source is null then
        update public.tenants
        set status = 'active',
            block_source = null,
            block_reason = null,
            blocked_at = null
        where id = new.tenant_id
          and status = 'suspended'
          and block_source = 'payment';
    end if;

    return null;
end;
$$;

drop trigger if exists subscriptions_sync_tenant_block on public.subscriptions;

create trigger subscriptions_sync_tenant_block
after update of cancellation_source on public.subscriptions
for each row
execute function public.subscriptions_sync_tenant_block();
