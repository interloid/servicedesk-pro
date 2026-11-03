-- Totals for the /platform console, worked out here so the app doesn't load every
-- row. One jsonb value each, so PostgREST's row cap can't cut them short.
-- Execute is granted to service_role alone.

-- { tenant_id: { lifetime_paid, recent: [up to 5 newest invoices] } }
create or replace function public.platform_invoice_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(jsonb_object_agg(s.tenant_id, jsonb_build_object(
        'lifetime_paid', s.lifetime_paid,
        'recent', s.recent
    )), '{}'::jsonb)
    from (
        select
            r.tenant_id,
            coalesce(
                sum(coalesce(r.amount_paid, r.amount)) filter (where r.status = 'paid'),
                0
            ) as lifetime_paid,
            coalesce(
                jsonb_agg(jsonb_build_object(
                    'number', r.invoice_number,
                    'amount', coalesce(r.amount_paid, r.amount),
                    'status', r.status,
                    'date', coalesce(r.paid_at, r.created_at)
                ) order by r.position) filter (where r.position <= 5),
                '[]'::jsonb
            ) as recent
        from (
            select
                i.*,
                row_number() over (
                    partition by i.tenant_id order by i.created_at desc
                ) as position
            from public.invoices i
        ) r
        group by r.tenant_id
    ) s;
$$;

revoke all on function public.platform_invoice_summary() from public, anon, authenticated;
grant execute on function public.platform_invoice_summary() to service_role;

-- { user_id: last_sign_in_at }, instead of paging through the Auth admin API.
create or replace function public.platform_last_sign_ins()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
    select coalesce(jsonb_object_agg(u.id, u.last_sign_in_at), '{}'::jsonb)
    from auth.users u
    where u.last_sign_in_at is not null;
$$;

revoke all on function public.platform_last_sign_ins() from public, anon, authenticated;
grant execute on function public.platform_last_sign_ins() to service_role;
