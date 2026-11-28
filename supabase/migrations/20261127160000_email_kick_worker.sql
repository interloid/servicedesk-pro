-- ==========================================================
-- File: 20261127160000_email_kick_worker.sql
-- Description: "Sync now" runs the email-ingest worker straight away instead
--              of waiting for the next minute's cron.
--
-- Same call the email-ingest-every-minute cron makes (Vault URL + service
-- role key as a bearer token), so the app needs no credential of its own for
-- the function gateway. pg_net sends it when the calling transaction
-- commits. A missing secret returns null instead of raising: the queued job
-- still runs on the cron, which reports the missing secret itself.
--
-- Canonical copy: schemas/functions/37_email_ingest.sql.
-- ==========================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.email_kick_worker()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_url text;
    v_key text;
BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name = 'email_ingest_url';

    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key';

    IF coalesce(v_url, '') = '' OR coalesce(v_key, '') = '' THEN
        RETURN NULL;
    END IF;

    RETURN net.http_post(
        url := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_key
        ),
        body := '{}'::jsonb
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.email_kick_worker() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_kick_worker() TO service_role;

COMMIT;
