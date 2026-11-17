-- =====================================================
-- File: roles_guard.sql
-- Description: Protect built-in roles and tiers of roles in use
-- =====================================================

DROP TRIGGER IF EXISTS guard_roles
ON public.roles;

CREATE TRIGGER guard_roles
BEFORE UPDATE OR DELETE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION public.guard_roles();
