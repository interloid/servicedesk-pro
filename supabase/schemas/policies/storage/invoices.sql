-- =====================================================
-- Invoices
-- =====================================================

CREATE POLICY "invoices_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'invoices'
    AND public.is_active_membership()
    AND public.current_tenant_role() IN (
        'tenant_admin',
        'billing_admin'
    )
    AND (storage.foldername(name))[1] =
        (auth.jwt() ->> 'tenant_id')
);


-- No client insert, update or delete: invoice PDFs are written only by the
-- paypal-webhook function with the service role. SEC-008, migration
-- 20261112120000.
