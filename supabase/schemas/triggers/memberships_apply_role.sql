-- =====================================================
-- File: memberships_apply_role.sql
-- Description: Keep memberships.role and memberships.role_id in step
-- (must sort before enforce_team_seat_limit / protect_primary_membership)
-- =====================================================

DROP TRIGGER IF EXISTS apply_membership_role
ON public.memberships;

CREATE TRIGGER apply_membership_role
BEFORE INSERT OR UPDATE OF role, role_id ON public.memberships
FOR EACH ROW
EXECUTE FUNCTION public.apply_membership_role();
