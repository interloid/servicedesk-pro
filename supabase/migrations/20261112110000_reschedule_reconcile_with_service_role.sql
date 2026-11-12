-- Schedule reconcile-subscriptions with the service role key as a bearer token.
--
-- The only migration that scheduled this job (20260905130000) sent an
-- x-cron-secret header. That header arrived empty and every run returned 401, so
-- the job was rescheduled by hand on production with bearer auth, and that
-- change was never recorded (README "Known gaps"). A new environment built from
-- the migrations therefore got a job that could never succeed.
--
-- This records the working schedule, in the same shape as email-jobs
-- (20260925130000): both secrets are read from Vault, and a missing one RAISEs
-- so it shows in cron.job_run_details instead of failing silently.
--
-- Vault secrets (already present on production, used by the old job and by
-- email-jobs):
--   reconcile_subscriptions_url  https://<ref>.supabase.co/functions/v1/reconcile-subscriptions
--   service_role_key             the project's service role key

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-subscriptions-hourly') THEN
        PERFORM cron.unschedule('reconcile-subscriptions-hourly');
    END IF;
END
$$;

SELECT cron.schedule(
    'reconcile-subscriptions-hourly',
    '0 * * * *',
    $$
    DO $reconcile$
    DECLARE
        v_url text;
        v_key text;
    BEGIN
        SELECT decrypted_secret INTO v_url
        FROM vault.decrypted_secrets
        WHERE name = 'reconcile_subscriptions_url';

        SELECT decrypted_secret INTO v_key
        FROM vault.decrypted_secrets
        WHERE name = 'service_role_key';

        IF v_url IS NULL OR v_url = '' THEN
            RAISE EXCEPTION 'reconcile cron: Vault secret "reconcile_subscriptions_url" is missing';
        END IF;

        IF v_key IS NULL OR v_key = '' THEN
            RAISE EXCEPTION 'reconcile cron: Vault secret "service_role_key" is missing';
        END IF;

        PERFORM net.http_post(
            url := v_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_key
            ),
            body := '{}'::jsonb
        );
    END
    $reconcile$;
    $$
);

-- The old header-based job read this secret; nothing reads it any more.
-- It is left in Vault rather than deleted, so this migration never fails on an
-- environment that doesn't have it. Remove it by hand once the job above runs:
--   delete from vault.secrets where name = 'cron_secret';
