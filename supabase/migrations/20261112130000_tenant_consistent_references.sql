-- Make every reference between two workspace-owned rows stay inside one
-- workspace, in the database, whoever writes the row.
-- Tracker: SEC-032 (docs/security/security-remediation-tracker.md).
--
-- The insert policies check the new row's own tenant_id, but not the tenant of
-- the ticket, customer, tag or policy it points at. A staff member of workspace
-- A could therefore post a message on workspace B's ticket (B's customer was
-- emailed the text and B's first-response SLA was marked met), tag B's ticket,
-- attach a file to it, or open a ticket for B's customer.
--
-- Each such foreign key now includes tenant_id: (tenant_id, x) references the
-- parent's (tenant_id, id). A cross-workspace reference fails with 23503 for
-- every role, including the service role, so no policy has to remember the rule.
-- Constraint names are kept, so PostgREST embeds and generated types still
-- resolve. ON DELETE behaviour is unchanged; SET NULL clears only the reference
-- column, never tenant_id.
--
-- tickets.assignee_user_id points at the global users table, so it gets a
-- trigger instead: the assignee must be an active staff member of the ticket's
-- workspace.
--
-- Mirrors supabase/schemas/tables/* and
-- supabase/schemas/triggers/tickets_guard_assignee.sql.

------------------------------------------------------------
-- 1. Parent keys
------------------------------------------------------------

ALTER TABLE public.business_hours
    ADD CONSTRAINT business_hours_tenant_id_id_key UNIQUE (tenant_id, id);

ALTER TABLE public.customers
    ADD CONSTRAINT customers_tenant_id_id_key UNIQUE (tenant_id, id);

ALTER TABLE public.payment_methods
    ADD CONSTRAINT payment_methods_tenant_id_id_key UNIQUE (tenant_id, id);

ALTER TABLE public.sla_events
    ADD CONSTRAINT sla_events_tenant_id_id_key UNIQUE (tenant_id, id);

ALTER TABLE public.sla_policies
    ADD CONSTRAINT sla_policies_tenant_id_id_key UNIQUE (tenant_id, id);

ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_tenant_id_id_key UNIQUE (tenant_id, id);

ALTER TABLE public.tags
    ADD CONSTRAINT tags_tenant_id_id_key UNIQUE (tenant_id, id);

ALTER TABLE public.ticket_messages
    ADD CONSTRAINT ticket_messages_tenant_id_id_key UNIQUE (tenant_id, id);

ALTER TABLE public.tickets
    ADD CONSTRAINT tickets_tenant_id_id_key UNIQUE (tenant_id, id);

------------------------------------------------------------
-- 2. Tenant-consistent foreign keys
------------------------------------------------------------
-- Added NOT VALID so new and updated rows are checked at once, then validated
-- below.

ALTER TABLE public.sla_events
    DROP CONSTRAINT sla_events_business_hours_id_fkey,
    ADD CONSTRAINT sla_events_business_hours_id_fkey
        FOREIGN KEY (tenant_id, business_hours_id)
        REFERENCES public.business_hours (tenant_id, id)
        ON DELETE SET NULL (business_hours_id)
        NOT VALID;

ALTER TABLE public.sla_policies
    DROP CONSTRAINT sla_policies_business_hours_id_fkey,
    ADD CONSTRAINT sla_policies_business_hours_id_fkey
        FOREIGN KEY (tenant_id, business_hours_id)
        REFERENCES public.business_hours (tenant_id, id)
        NOT VALID;

ALTER TABLE public.csat_ratings
    DROP CONSTRAINT csat_ratings_customer_id_fkey,
    ADD CONSTRAINT csat_ratings_customer_id_fkey
        FOREIGN KEY (tenant_id, customer_id)
        REFERENCES public.customers (tenant_id, id)
        ON DELETE CASCADE
        NOT VALID;

ALTER TABLE public.sla_policy_customers
    DROP CONSTRAINT sla_policy_customers_customer_id_fkey,
    ADD CONSTRAINT sla_policy_customers_customer_id_fkey
        FOREIGN KEY (tenant_id, customer_id)
        REFERENCES public.customers (tenant_id, id)
        ON DELETE CASCADE
        NOT VALID;

ALTER TABLE public.tickets
    DROP CONSTRAINT tickets_requester_customer_id_fkey,
    ADD CONSTRAINT tickets_requester_customer_id_fkey
        FOREIGN KEY (tenant_id, requester_customer_id)
        REFERENCES public.customers (tenant_id, id)
        NOT VALID;

ALTER TABLE public.subscriptions
    DROP CONSTRAINT subscriptions_payment_method_id_fkey,
    ADD CONSTRAINT subscriptions_payment_method_id_fkey
        FOREIGN KEY (tenant_id, payment_method_id)
        REFERENCES public.payment_methods (tenant_id, id)
        ON DELETE SET NULL (payment_method_id)
        NOT VALID;

ALTER TABLE public.sla_alert_jobs
    DROP CONSTRAINT sla_alert_jobs_sla_event_id_fkey,
    ADD CONSTRAINT sla_alert_jobs_sla_event_id_fkey
        FOREIGN KEY (tenant_id, sla_event_id)
        REFERENCES public.sla_events (tenant_id, id)
        ON DELETE CASCADE
        NOT VALID;

ALTER TABLE public.sla_policy_customers
    DROP CONSTRAINT sla_policy_customers_policy_id_fkey,
    ADD CONSTRAINT sla_policy_customers_policy_id_fkey
        FOREIGN KEY (tenant_id, policy_id)
        REFERENCES public.sla_policies (tenant_id, id)
        ON DELETE CASCADE
        NOT VALID;

ALTER TABLE public.sla_policy_targets
    DROP CONSTRAINT sla_policy_targets_policy_id_fkey,
    ADD CONSTRAINT sla_policy_targets_policy_id_fkey
        FOREIGN KEY (tenant_id, policy_id)
        REFERENCES public.sla_policies (tenant_id, id)
        ON DELETE CASCADE
        NOT VALID;

ALTER TABLE public.tickets
    DROP CONSTRAINT tickets_sla_policy_id_fkey,
    ADD CONSTRAINT tickets_sla_policy_id_fkey
        FOREIGN KEY (tenant_id, sla_policy_id)
        REFERENCES public.sla_policies (tenant_id, id)
        NOT VALID;

ALTER TABLE public.invoices
    DROP CONSTRAINT invoices_subscription_id_fkey,
    ADD CONSTRAINT invoices_subscription_id_fkey
        FOREIGN KEY (tenant_id, subscription_id)
        REFERENCES public.subscriptions (tenant_id, id)
        ON DELETE SET NULL (subscription_id)
        NOT VALID;

ALTER TABLE public.payment_methods
    DROP CONSTRAINT payment_methods_subscription_id_fkey,
    ADD CONSTRAINT payment_methods_subscription_id_fkey
        FOREIGN KEY (tenant_id, subscription_id)
        REFERENCES public.subscriptions (tenant_id, id)
        ON DELETE SET NULL (subscription_id)
        NOT VALID;

ALTER TABLE public.subscription_cancellation_reasons
    DROP CONSTRAINT subscription_cancellation_reasons_subscription_id_fkey,
    ADD CONSTRAINT subscription_cancellation_reasons_subscription_id_fkey
        FOREIGN KEY (tenant_id, subscription_id)
        REFERENCES public.subscriptions (tenant_id, id)
        ON DELETE SET NULL (subscription_id)
        NOT VALID;

ALTER TABLE public.ticket_tags
    DROP CONSTRAINT ticket_tags_tag_id_fkey,
    ADD CONSTRAINT ticket_tags_tag_id_fkey
        FOREIGN KEY (tenant_id, tag_id)
        REFERENCES public.tags (tenant_id, id)
        ON DELETE CASCADE
        NOT VALID;

ALTER TABLE public.attachments
    DROP CONSTRAINT attachments_message_id_fkey,
    ADD CONSTRAINT attachments_message_id_fkey
        FOREIGN KEY (tenant_id, message_id)
        REFERENCES public.ticket_messages (tenant_id, id)
        ON DELETE CASCADE
        NOT VALID;

ALTER TABLE public.attachments
    DROP CONSTRAINT attachments_ticket_id_fkey,
    ADD CONSTRAINT attachments_ticket_id_fkey
        FOREIGN KEY (tenant_id, ticket_id)
        REFERENCES public.tickets (tenant_id, id)
        ON DELETE CASCADE
        NOT VALID;

ALTER TABLE public.csat_ratings
    DROP CONSTRAINT csat_ratings_ticket_id_fkey,
    ADD CONSTRAINT csat_ratings_ticket_id_fkey
        FOREIGN KEY (tenant_id, ticket_id)
        REFERENCES public.tickets (tenant_id, id)
        ON DELETE CASCADE
        NOT VALID;

ALTER TABLE public.sla_events
    DROP CONSTRAINT sla_events_ticket_id_fkey,
    ADD CONSTRAINT sla_events_ticket_id_fkey
        FOREIGN KEY (tenant_id, ticket_id)
        REFERENCES public.tickets (tenant_id, id)
        ON DELETE CASCADE
        NOT VALID;

ALTER TABLE public.ticket_messages
    DROP CONSTRAINT ticket_messages_ticket_id_fkey,
    ADD CONSTRAINT ticket_messages_ticket_id_fkey
        FOREIGN KEY (tenant_id, ticket_id)
        REFERENCES public.tickets (tenant_id, id)
        ON DELETE CASCADE
        NOT VALID;

ALTER TABLE public.ticket_tags
    DROP CONSTRAINT ticket_tags_ticket_id_fkey,
    ADD CONSTRAINT ticket_tags_ticket_id_fkey
        FOREIGN KEY (tenant_id, ticket_id)
        REFERENCES public.tickets (tenant_id, id)
        ON DELETE CASCADE
        NOT VALID;

------------------------------------------------------------
-- 3. Validate existing rows
------------------------------------------------------------
-- A row that already crosses workspaces would be evidence of the attack, not a
-- reason to fail the deploy. Each key is validated on its own; one that fails
-- stays NOT VALID (still enforced for new writes) and is named in a WARNING.
-- Find them afterwards with:
--   select conrelid::regclass, conname from pg_constraint
--   where contype = 'f' and not convalidated;

DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT conrelid::regclass AS tbl, conname
        FROM pg_constraint
        WHERE contype = 'f'
          AND NOT convalidated
          AND connamespace = 'public'::regnamespace
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', c.tbl, c.conname);
        EXCEPTION WHEN foreign_key_violation THEN
            RAISE WARNING 'Existing rows cross workspaces: % on %. Review them before validating.',
                c.conname, c.tbl;
        END;
    END LOOP;
END
$$;

------------------------------------------------------------
-- 4. Assignee must be staff of the ticket's workspace
------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tickets_guard_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.assignee_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND NEW.assignee_user_id IS NOT DISTINCT FROM OLD.assignee_user_id
       AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.memberships AS m
        WHERE m.user_id = NEW.assignee_user_id
          AND m.tenant_id = NEW.tenant_id
          AND m.status = 'active'
          AND m.role IN ('tenant_admin', 'manager', 'agent')
    ) THEN
        RAISE EXCEPTION 'The assignee is not an active agent of this workspace.'
            USING ERRCODE = 'TA001';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tickets_guard_assignee() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tickets_guard_assignee ON public.tickets;

CREATE TRIGGER tickets_guard_assignee
BEFORE INSERT OR UPDATE OF assignee_user_id, tenant_id
ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.tickets_guard_assignee();
