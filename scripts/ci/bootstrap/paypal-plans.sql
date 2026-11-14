-- Writes the sandbox PayPal ids from paypal-sandbox.mjs into public.plans.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction \
--     -v product_id=... -v pro=... -v business=... -f paypal-plans.sql
--
-- A plan's code is only replaced while no PayPal agreement depends on it:
-- an agreement on the old plan can't be revised onto a plan of another
-- product, so swapping the code under a live subscriber would break their
-- upgrades and downgrades. That case stops the run for a person to decide.

-- psql variables don't reach inside DO blocks; transaction-local settings do.
select set_config('bootstrap.product_id', :'product_id', true) as product,
       set_config('bootstrap.pro', :'pro', true) as pro,
       set_config('bootstrap.business', :'business', true) as business \gset bootstrap_

-- One writer at a time; app reads continue.
lock table public.plans in share row exclusive mode;

do $$
declare
    v_product text := current_setting('bootstrap.product_id');
    v_plan record;
    v_new_code text;
    v_live integer;
begin
    if v_product !~ '^[A-Za-z0-9_-]{6,50}$' then
        raise exception 'Invalid PayPal product id %', v_product;
    end if;

    for v_plan in
        select id, name, code
        from public.plans
        where name in ('Pro', 'Business')
        for update
    loop
        v_new_code := case v_plan.name
            when 'Pro' then current_setting('bootstrap.pro')
            else current_setting('bootstrap.business')
        end;

        if v_new_code !~ '^P-[A-Z0-9]{10,}$' then
            raise exception 'Invalid PayPal plan id % for %', v_new_code, v_plan.name;
        end if;

        if v_plan.code <> v_new_code then
            select count(*)
            into v_live
            from public.subscriptions s
            where (s.plan_id = v_plan.id
                   or s.next_plan_id = v_plan.id
                   or s.pending_plan_id = v_plan.id)
              and (s.paypal_subscription_id is not null
                   or s.pending_paypal_subscription_id is not null)
              and s.status not in ('cancelled', 'expired');

            if v_live > 0 then
                raise exception
                    '% has % PayPal subscription(s) on plan %; not replacing it with %. Resolve them first.',
                    v_plan.name, v_live, v_plan.code, v_new_code;
            end if;

            raise notice 'plans.%: code % -> %', v_plan.name, v_plan.code, v_new_code;
        end if;

        update public.plans
        set code = v_new_code,
            paypal_product_id = v_product,
            updated_at = now()
        where id = v_plan.id
          and (code is distinct from v_new_code
               or paypal_product_id is distinct from v_product);
    end loop;

    if (select count(*) from public.plans where name in ('Pro', 'Business')) <> 2 then
        raise exception 'public.plans must have exactly one Pro and one Business row';
    end if;
end;
$$;
