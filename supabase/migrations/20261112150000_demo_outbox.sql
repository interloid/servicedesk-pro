-- The Demo outbox: on a public demo (EMAIL_DEMO_OUTBOX on), the email Edge
-- Functions store mail for anyone outside EMAIL_ALLOWED_RECIPIENTS here
-- instead of sending it, and the workspace's Tenant Admins read it in the app
-- (Settings -> Demo outbox).
--
-- Mirrors supabase/schemas/tables/28_demo_outbox.sql and
-- supabase/schemas/policies/31_demo_outbox.sql; the workspace block policy is
-- the one supabase/schemas/policies/30_workspace_block.sql gives every table
-- with a tenant_id.

CREATE TABLE IF NOT EXISTS public.demo_outbox
(
    id uuid primary key
        default gen_random_uuid(),

    tenant_id uuid
        not null
        references public.tenants(id)
        on delete cascade,

    kind text
        not null,

    recipient text
        not null,

    subject text
        not null,

    html text
        not null,

    text text
        not null
        default '',

    link_withheld boolean
        not null
        default false,

    created_at timestamptz
        not null
        default now()
);

CREATE INDEX IF NOT EXISTS idx_demo_outbox_tenant_created
    ON public.demo_outbox (tenant_id, created_at DESC);

------------------------------------------------------------
-- Access: Tenant Admins of the workspace read; nobody writes but the
-- service role. A captured email can hold a working invite link for a new
-- Tenant Admin or Manager, so other roles must not read it.
------------------------------------------------------------

ALTER TABLE public.demo_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.demo_outbox FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.demo_outbox FROM authenticated;
GRANT SELECT ON public.demo_outbox TO authenticated;

DROP POLICY IF EXISTS "demo_outbox_select" ON public.demo_outbox;
CREATE POLICY "demo_outbox_select"
ON public.demo_outbox
FOR SELECT
TO authenticated
USING (
    tenant_id = public.current_tenant_id()
    AND public.is_active_membership()
    AND public.current_tenant_role() = 'tenant_admin'
);

DROP POLICY IF EXISTS workspace_not_blocked ON public.demo_outbox;
CREATE POLICY workspace_not_blocked ON public.demo_outbox
    AS RESTRICTIVE FOR ALL TO authenticated
    USING ((SELECT public.current_workspace_block()) IS NULL)
    WITH CHECK ((SELECT public.current_workspace_block()) IS NULL);
