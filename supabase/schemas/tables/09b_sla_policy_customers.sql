-- ==========================================================
-- File: 09b_sla_policy_customers.sql
--
-- The customers a policy is limited to when its applies_to is
-- 'Selected customers'. Empty for 'All customers' policies.
-- ==========================================================

create table if not exists public.sla_policy_customers
(
    -- Denormalised for RLS, like sla_policy_targets. Always equal to the
    -- policy's and the customer's tenant_id; RLS checks both.
    tenant_id uuid
        not null
        references public.tenants(id)
        on delete cascade,

    policy_id uuid
        not null,

    customer_id uuid
        not null,

    created_at timestamptz
        not null
        default now(),

    primary key (policy_id, customer_id),

    -- Tenant-consistent keys (SEC-032, migration 20261112130000): a reference
    -- to another workspace-owned row must stay in the same workspace.
    constraint sla_policy_customers_policy_id_fkey
        foreign key (tenant_id, policy_id)
        references public.sla_policies (tenant_id, id)
        on delete cascade,

    constraint sla_policy_customers_customer_id_fkey
        foreign key (tenant_id, customer_id)
        references public.customers (tenant_id, id)
        on delete cascade
);

comment on table public.sla_policy_customers is
'Customers an SLA policy is limited to when applies_to = ''Selected customers''.';

------------------------------------------------------------
-- Indexes
------------------------------------------------------------

create index if not exists idx_sla_policy_customers_tenant
on public.sla_policy_customers(tenant_id);

create index if not exists idx_sla_policy_customers_customer
on public.sla_policy_customers(customer_id);
