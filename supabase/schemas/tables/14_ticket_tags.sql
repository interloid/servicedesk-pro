-- =====================================================
-- Ticket Tags
-- =====================================================

create table if not exists public.ticket_tags
(
    id uuid primary key
        default gen_random_uuid(),

    tenant_id uuid
        not null
        references public.tenants(id)
        on delete cascade,

    ticket_id uuid
        not null,

    tag_id uuid
        not null,

    created_at timestamptz
        not null
        default now(),

    constraint uq_ticket_tag
        unique(ticket_id, tag_id),

    -- Tenant-consistent keys (SEC-032, migration 20261112130000): a reference
    -- to another workspace-owned row must stay in the same workspace.
    constraint ticket_tags_ticket_id_fkey
        foreign key (tenant_id, ticket_id)
        references public.tickets (tenant_id, id)
        on delete cascade,

    constraint ticket_tags_tag_id_fkey
        foreign key (tenant_id, tag_id)
        references public.tags (tenant_id, id)
        on delete cascade
);

----------------------------------------------------
-- Indexes
----------------------------------------------------

create index idx_ticket_tags_ticket
on public.ticket_tags(ticket_id);

create index idx_ticket_tags_tag
on public.ticket_tags(tag_id);

create index idx_ticket_tags_tenant
on public.ticket_tags(tenant_id);