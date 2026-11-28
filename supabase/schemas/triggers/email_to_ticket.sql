-- ==========================================================
-- File: email_to_ticket.sql
-- Description: Email-to-ticket triggers: the source guard and updated_at stamps
-- Canonical copy; the change ships in migration 20261127120000_email_to_ticket.sql.
-- ==========================================================

DROP TRIGGER IF EXISTS tickets_guard_source ON public.tickets;
CREATE TRIGGER tickets_guard_source
BEFORE INSERT OR UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.email_guard_client_source();

DROP TRIGGER IF EXISTS ticket_messages_guard_source ON public.ticket_messages;
CREATE TRIGGER ticket_messages_guard_source
BEFORE INSERT OR UPDATE ON public.ticket_messages
FOR EACH ROW
EXECUTE FUNCTION public.email_guard_client_source();

DROP TRIGGER IF EXISTS set_tenant_email_integrations_updated_at
    ON public.tenant_email_integrations;

CREATE TRIGGER set_tenant_email_integrations_updated_at
BEFORE UPDATE ON public.tenant_email_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_email_inbound_events_updated_at
    ON public.email_inbound_events;

CREATE TRIGGER set_email_inbound_events_updated_at
BEFORE UPDATE ON public.email_inbound_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
