-- Keep 7 days of pg_cron run history (2026-11-09). Mirrors
-- supabase/schemas/functions/33_purge_cron_run_history.sql.
--
-- cron.job_run_details gains one row per run and is never trimmed: by
-- 2026-11-09 it held ~152k rows / 452 MB, almost all from the every-minute
-- jobs. 7 days is more than /platform/health reads (its newest 20,000 rows,
-- see 20261103150000_platform_db_health_cron_limit.sql).
--
-- Runs at 01:45 IST (20:15 UTC), just before nightly-vacuum-analyze at 02:00
-- IST, so the vacuum makes the freed space reusable straight away.
create extension if not exists pg_cron;

do $$
begin
    if exists (select 1 from cron.job where jobname = 'purge-cron-run-history') then
        perform cron.unschedule('purge-cron-run-history');
    end if;
end
$$;

select cron.schedule(
    'purge-cron-run-history',
    '15 20 * * *',
    $$ delete from cron.job_run_details where end_time < now() - interval '7 days' $$
);
