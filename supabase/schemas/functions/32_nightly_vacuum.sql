-- Nightly VACUUM (ANALYZE) at 02:00 IST (20:30 UTC; pg_cron runs in UTC).
-- Applied by supabase/migrations/20261109120000_nightly_vacuum_cron.sql.
--
-- Autovacuum still runs as usual; this is a quiet-hours sweep on top of it
-- that reclaims dead rows from the busy queue tables (email_jobs,
-- sla_alert_jobs, rate-limit counters) and refreshes planner statistics.
-- Plain VACUUM, not VACUUM FULL: it takes no exclusive locks, so the app keeps
-- working while it runs. pg_cron sends the single statement outside a
-- transaction block, which VACUUM requires. Tables the job's role doesn't own
-- (Supabase-managed schemas) are skipped with a warning, not an error.
create extension if not exists pg_cron;

do $$
begin
    if exists (select 1 from cron.job where jobname = 'nightly-vacuum-analyze') then
        perform cron.unschedule('nightly-vacuum-analyze');
    end if;
end
$$;

select cron.schedule(
    'nightly-vacuum-analyze',
    '30 20 * * *',
    $$ vacuum (analyze) $$
);
