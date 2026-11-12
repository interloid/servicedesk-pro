-- ==========================================================
-- File: 11_ticket_messages.sql
-- Description: Ticket Conversations
-- ==========================================================

create table if not exists public.ticket_messages
(
    id uuid
        primary key
        default gen_random_uuid(),

    tenant_id uuid
        not null
        references public.tenants(id)
        on delete cascade,

    ticket_id uuid
        not null,

    author_type author_type
        not null,

    author_id uuid
        not null,

    body text
        not null,

    visibility message_visibility
        not null
        default 'public',

    is_edited boolean
        not null
        default false,

    edited_at timestamptz,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    constraint chk_message_body
        check(length(trim(body)) > 0),

    -- Tenant-consistent keys (SEC-032, migration 20261112130000): a reference
    -- to another workspace-owned row must stay in the same workspace.
    constraint ticket_messages_tenant_id_id_key
        unique (tenant_id, id),

    constraint ticket_messages_ticket_id_fkey
        foreign key (tenant_id, ticket_id)
        references public.tickets (tenant_id, id)
        on delete cascade
);

comment on table public.ticket_messages is
'Conversation messages for a ticket';

comment on column public.ticket_messages.author_type is
'agent | customer | system';

comment on column public.ticket_messages.visibility is
'public or internal';

------------------------------------------------------------
-- Indexes
------------------------------------------------------------

create index if not exists idx_ticket_messages_ticket
on public.ticket_messages(ticket_id);

create index if not exists idx_ticket_messages_tenant
on public.ticket_messages(tenant_id);

create index if not exists idx_ticket_messages_author
on public.ticket_messages(author_id);

create index if not exists idx_ticket_messages_created
on public.ticket_messages(created_at desc);

create index if not exists idx_ticket_messages_visibility
on public.ticket_messages(visibility);

------------------------------------------------------------
-- Full Text Search
------------------------------------------------------------

create index if not exists idx_ticket_messages_search
on public.ticket_messages
using gin
(
    to_tsvector(
        'english',
        coalesce(body,'')
    )
);


-- Realtime (20260903090000_enable_realtime.sql): full rows on UPDATE/DELETE
-- so realtime can apply RLS, and the table on the supabase_realtime publication.
ALTER TABLE public.ticket_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
           SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime'
             AND schemaname = 'public'
             AND tablename = 'ticket_messages'
       )
    THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
    END IF;
END
$$;
