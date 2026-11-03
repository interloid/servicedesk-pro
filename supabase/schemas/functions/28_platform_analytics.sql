-- Cross-workspace usage figures for the /platform/analytics console page,
-- aggregated here so the app never pulls every ticket row. Read-only.
-- Execute is granted to service_role alone, so tenants can't call it.
create or replace function public.platform_analytics(p_from timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_csat jsonb := null;
begin
    if to_regclass('public.csat_ratings') is not null then
        execute $sql$
            select jsonb_build_object(
                'average', round(avg(score)::numeric, 2),
                'count', count(*)
            )
            from public.csat_ratings
            where created_at >= $1
        $sql$ into v_csat using p_from;
    end if;

    return jsonb_build_object(
        'tickets_by_month', (
            select coalesce(jsonb_agg(m order by m.month), '[]'::jsonb)
            from (
                select
                    to_char(series.month, 'YYYY-MM') as month,
                    (
                        select count(*) from public.tickets t
                        where t.created_at >= series.month
                          and t.created_at < series.month + interval '1 month'
                    ) as created,
                    (
                        select count(*) from public.tickets t
                        where t.resolved_at >= series.month
                          and t.resolved_at < series.month + interval '1 month'
                    ) as resolved
                from generate_series(
                    date_trunc('month', now() at time zone 'UTC') - interval '11 months',
                    date_trunc('month', now() at time zone 'UTC'),
                    interval '1 month'
                ) as series(month)
            ) m
        ),
        'tickets', (
            select jsonb_build_object(
                'created', count(*),
                'resolved', count(*) filter (where resolved_at is not null),
                'median_first_response_minutes', round((
                    percentile_cont(0.5) within group (
                        order by extract(epoch from first_response_at - created_at) / 60
                    ) filter (where first_response_at is not null)
                )::numeric, 1),
                'median_resolution_minutes', round((
                    percentile_cont(0.5) within group (
                        order by extract(epoch from resolved_at - created_at) / 60
                    ) filter (where resolved_at is not null)
                )::numeric, 1)
            )
            from public.tickets
            where created_at >= p_from
        ),
        'csat', v_csat,
        'workspaces', (
            select coalesce(jsonb_agg(w order by w.tickets desc, w.name), '[]'::jsonb)
            from (
                select
                    tenant.id,
                    tenant.name,
                    tenant.slug,
                    tenant.status,
                    (
                        select count(*) from public.tickets t
                        where t.tenant_id = tenant.id and t.created_at >= p_from
                    ) as tickets,
                    (
                        select count(*) from public.tickets t
                        where t.tenant_id = tenant.id
                          and t.status in ('new', 'open', 'pending', 'on_hold')
                    ) as open_tickets,
                    (
                        select count(*) from public.customers c
                        where c.tenant_id = tenant.id
                    ) as customers,
                    (
                        select max(t.created_at) from public.tickets t
                        where t.tenant_id = tenant.id
                    ) as last_ticket_at
                from public.tenants tenant
            ) w
        )
    );
end;
$$;

revoke all on function public.platform_analytics(timestamptz) from public, anon, authenticated;
grant execute on function public.platform_analytics(timestamptz) to service_role;
