-- =====================================================
-- File: support_requests_updated_at.sql
-- =====================================================

DROP TRIGGER IF EXISTS set_support_requests_updated_at
ON public.support_requests;

CREATE TRIGGER set_support_requests_updated_at
BEFORE UPDATE ON public.support_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
