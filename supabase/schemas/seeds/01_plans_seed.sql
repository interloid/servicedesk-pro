-- =====================================================
-- Subscription plans
-- =====================================================
--
-- `code` is the PayPal BILLING PLAN id for a paid plan (Free has no PayPal
-- plan, so it carries a synthetic id).
--
-- EVERY PAID PLAN MUST SIT UNDER ONE PAYPAL PRODUCT.
-- A paid -> paid plan change revises the tenant's existing agreement, and
-- PayPal only revises between plans of the SAME product -- a cross-product
-- revise fails with PLAN_PRODUCT_NOT_COMPATIBLE and the upgrade cannot
-- complete. plans.paypal_product_id records that product.
--
-- Pro and Business start with PAYPAL-PENDING-* placeholder codes. No real
-- PayPal id is committed here:
--   * development: the bootstrap workflow creates the sandbox product and
--     plans once and writes their ids into `code` and `paypal_product_id`
--     (scripts/ci/bootstrap/paypal-sandbox.mjs);
--   * production: replace the placeholders with the live plan ids
--     (docs/deployment.md, section 3.D).
--
-- Keyed on `name`, not `code`, and DO NOTHING: re-running the seed never
-- overwrites an existing plan's price, limits or PayPal ids, and never inserts
-- a second row for a plan whose code has since been replaced. Change an
-- existing plan with a migration.

INSERT INTO plans (
    code,
    name,
    description,
    price_month,
    seat_limit,
    ticket_limit,
    storage_limit_mb,
    features_json,
    is_active,
    sort_order
)
VALUES
(
    'F-15e70eec-7094-403f-b70e-8126fd7c062a',
    'Free',
    'For small teams getting started with help desk essentials.',
    0.00,
    2,
    50,
    1024,
    '{
        "core_ticketing": true,
        "customer_portal": true,
        "email_notifications": true,
        "sla_policies": 1
    }'::jsonb,
    true,
    1
),
(
    'PAYPAL-PENDING-PRO',
    'Pro',
    'For growing teams that need SLA policies, shared views, and reporting.',
    29.00,
    15,
    999999,
    10240,
    '{
        "core_ticketing": true,
        "customer_portal": true,
        "email_notifications": true,
        "sla_policies": -1,
        "business_hours": true,
        "saved_shared_views": true,
        "branding": true,
        "priority_support": true
    }'::jsonb,
    true,
    2
),
(
    'PAYPAL-PENDING-BUSINESS',
    'Business',
    'Advanced governance, AI automation, and scale for larger teams.',
    59.00,
    100,
    999999,
    51200,
    '{
        "core_ticketing": true,
        "customer_portal": true,
        "email_notifications": true,
        "sla_policies": -1,
        "business_hours": true,
        "saved_shared_views": true,
        "branding": true,
        "priority_support": true,
        "audit_logs": true,
        "advanced_roles": true,
        "ai_automation": true
    }'::jsonb,
    true,
    3
)
on conflict (name) do nothing;
