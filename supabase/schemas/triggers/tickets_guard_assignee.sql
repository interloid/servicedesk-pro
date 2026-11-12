-- A ticket can only be assigned to an active agent, manager or tenant admin of
-- its own workspace. assignee_user_id points at the global users table, so a
-- foreign key alone can't say this. SEC-032, migration 20261112130000.

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
