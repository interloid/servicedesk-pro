-- Final read-only check of everything the bootstrap writes to the database.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v tz=UTC -f verify.sql
select set_config('bootstrap.tz', :'tz', false) is not null as ok \gset

do $$
declare
    v_products integer;
begin
    if (select count(*) from public.plans where name in ('Free', 'Pro', 'Business')) <> 3 then
        raise exception 'Expected one Free, one Pro and one Business plan.';
    end if;

    if exists (select 1 from public.plans where code like 'PAYPAL-PENDING-%') then
        raise exception 'A paid plan still has a placeholder PayPal code.';
    end if;

    select count(distinct paypal_product_id)
    into v_products
    from public.plans
    where name in ('Pro', 'Business');
    if v_products <> 1 or exists (
        select 1 from public.plans
        where name in ('Pro', 'Business') and paypal_product_id is null
    ) then
        raise exception 'Pro and Business must share one PayPal product.';
    end if;

    if (select count(*) from public.timezones) < 25
       or not exists (select 1 from public.timezones where code = 'UTC') then
        raise exception 'Time zones are not seeded.';
    end if;

    if (select count(*) from vault.secrets
        where name in ('service_role_key', 'email_jobs_url',
                       'reconcile_subscriptions_url', 'portal_storage_sweep_url')) <> 4 then
        raise exception 'A Vault secret is missing.';
    end if;

    -- A new session (this one) picks up ALTER DATABASE ... SET timezone.
    if current_setting('TimeZone') <> current_setting('bootstrap.tz') then
        raise exception 'Database time zone is %, expected %.',
            current_setting('TimeZone'), current_setting('bootstrap.tz');
    end if;

    raise notice 'database: plans, PayPal ids, time zones and Vault secrets OK';
end;
$$;
