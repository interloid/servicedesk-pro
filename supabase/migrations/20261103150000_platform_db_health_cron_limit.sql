-- Stops platform_db_health timing out on a long cron.job_run_details history
-- (2026-11-03). Mirrors supabase/schemas/functions/27_platform_db_health.sql.

-- One snapshot of database health for the /platform/health console page.
-- Read-only. Security definer because pg_stat_* and cron.* are not readable by
-- service_role; execute is granted to service_role alone, so tenants can't call
-- it. Optional sources are guarded, so a project without one still gets the rest.
create or replace function public.platform_db_health()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_result jsonb;
    v_statements regclass;
    v_slow jsonb := '[]'::jsonb;
    v_cron jsonb := '[]'::jsonb;
    v_email jsonb := null;
    v_alerts jsonb := null;
begin
    select jsonb_build_object(
        'connections', jsonb_build_object(
            'total', count(*),
            'active', count(*) filter (where state = 'active'),
            'idle_in_transaction', count(*) filter (where state like 'idle in transaction%'),
            'waiting', count(*) filter (where wait_event_type = 'Lock'),
            'max', current_setting('max_connections')::int
        ),
        'longest_query_seconds', coalesce(
            extract(epoch from max(now() - query_start)
                filter (where state = 'active' and pid <> pg_backend_pid())),
            0
        )
    )
    into v_result
    from pg_stat_activity
    where datname = current_database();

    v_result := v_result || jsonb_build_object(
        'database_bytes', pg_database_size(current_database()),
        'cache_hit_percent', (
            select round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2)
            from pg_stat_database
            where datname = current_database()
        ),
        'largest_tables', coalesce((
            select jsonb_agg(t)
            from (
                select
                    relname as name,
                    pg_total_relation_size(relid) as bytes,
                    n_live_tup as rows
                from pg_stat_user_tables
                where schemaname = 'public'
                order by pg_total_relation_size(relid) desc
                limit 10
            ) t
        ), '[]'::jsonb)
    );

    v_statements := coalesce(
        to_regclass('extensions.pg_stat_statements'),
        to_regclass('public.pg_stat_statements')
    );

    if v_statements is not null then
        begin
            execute format(
                $sql$
                select coalesce(jsonb_agg(s), '[]'::jsonb)
                from (
                    select
                        calls,
                        round(mean_exec_time::numeric, 2) as mean_ms,
                        round(total_exec_time::numeric, 2) as total_ms,
                        left(query, 200) as query
                    from %s
                    where query not ilike '%%platform_db_health%%'
                    order by total_exec_time desc
                    limit 10
                ) s
                $sql$,
                v_statements
            ) into v_slow;
        exception when others then
            v_slow := '[]'::jsonb;
        end;
    end if;

    -- cron.job_run_details gains a row per run and is never trimmed, and it has
    -- no index on jobid or start_time, so reading it per job timed the whole
    -- function out. Only the newest rows are read, through its primary key.
    if to_regclass('cron.job_run_details') is not null then
        begin
            execute $sql$
                with recent as materialized (
                    select runid, jobid, status, start_time, return_message
                    from cron.job_run_details
                    order by runid desc
                    limit 20000
                )
                select coalesce(jsonb_agg(j order by j.name), '[]'::jsonb)
                from (
                    select
                        job.jobname as name,
                        job.schedule,
                        job.active,
                        last_run.status as last_status,
                        last_run.start_time as last_run_at,
                        left(last_run.return_message, 200) as last_message,
                        (
                            select count(*)
                            from recent d
                            where d.jobid = job.jobid
                              and d.status = 'failed'
                              and d.start_time > now() - interval '24 hours'
                        ) as failures_24h
                    from cron.job job
                    left join lateral (
                        select d.status, d.start_time, d.return_message
                        from recent d
                        where d.jobid = job.jobid
                        order by d.runid desc
                        limit 1
                    ) last_run on true
                ) j
            $sql$ into v_cron;
        exception when others then
            v_cron := '[]'::jsonb;
        end;
    end if;

    if to_regclass('public.email_jobs') is not null then
        execute $sql$
            select jsonb_build_object(
                'pending', count(*) filter (where status in ('pending', 'sending')),
                'failed', count(*) filter (where status = 'failed'),
                'oldest_pending_at', min(created_at) filter (where status = 'pending')
            )
            from public.email_jobs
        $sql$ into v_email;
    end if;

    if to_regclass('public.sla_alert_jobs') is not null then
        execute $sql$
            select jsonb_build_object(
                'pending', count(*) filter (where status = 'pending'),
                'failed', count(*) filter (where status = 'failed'),
                'oldest_pending_at', min(created_at) filter (where status = 'pending')
            )
            from public.sla_alert_jobs
        $sql$ into v_alerts;
    end if;

    return v_result || jsonb_build_object(
        'slow_queries', v_slow,
        'cron_jobs', v_cron,
        'email_queue', v_email,
        'sla_alert_queue', v_alerts
    );
end;
$$;

revoke all on function public.platform_db_health() from public, anon, authenticated;
grant execute on function public.platform_db_health() to service_role;
