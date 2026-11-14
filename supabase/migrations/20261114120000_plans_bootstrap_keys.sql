-- =====================================================
-- Plans: a stable seed key and the PayPal product
-- =====================================================
--
-- `plans.code` is the PayPal billing plan id, and the development bootstrap
-- (.github/workflows/bootstrap-development.yml) creates the sandbox plans and
-- writes their ids into `code`. Seeding on `code` is therefore not idempotent:
-- once a code is replaced, re-running the seed has nothing to conflict with and
-- inserts a second Pro. The seed keys on `name` instead, which needs it unique.
-- The three plans already have distinct names, so this adds no data change.
--
-- `paypal_product_id` records the PayPal catalog product the paid plans belong
-- to. All paid plans must share one product, or /revise between them fails with
-- PLAN_PRODUCT_NOT_COMPATIBLE. Null for Free, which has no PayPal plan.

alter table public.plans
    add column if not exists paypal_product_id text;

comment on column public.plans.paypal_product_id is
'PayPal catalog product of this plan''s billing plan (code). Null for Free. Every paid plan must share one product.';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.plans'::regclass
          and conname = 'plans_name_key'
    ) then
        alter table public.plans
            add constraint plans_name_key unique (name);
    end if;
end;
$$;
