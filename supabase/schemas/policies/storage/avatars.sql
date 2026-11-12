-- =====================================================
-- Avatars Bucket RLS Policies
-- =====================================================

-- 1. SELECT (Required so avatar images can be read/rendered in the UI)
DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
CREATE POLICY "avatars_select"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 2. INSERT, UPDATE, DELETE: no client policies.
-- Uploads go through signed upload URLs minted by the service role, and stale
-- photos are removed by the service role. The old policies also accepted
-- user_metadata.tenant_id, which any user can set on their own account.
-- SEC-004, migration 20261112120000.
