-- =====================================================
-- File: 35_platform_admin.sql
-- Description: Platform console writes that need the database (trial extension)
-- =====================================================

create or replace function public.platform_extend_trial(
    p_tenant_id uuid,
    p_days integer
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
    v_end timestamptz;
begin
    if p_days is null or p_days < 1 or p_days > 90 then
        raise exception 'Extend a trial by 1 to 90 days.'
            using errcode = '22023';
    end if;

    update public.subscriptions
    set current_period_end = greatest(coalesce(current_period_end, now()), now())
                             + make_interval(days => p_days),
        updated_at = now()
    where tenant_id = p_tenant_id
      and status = 'trialing'
      and paypal_subscription_id is null
      and exists (
          select 1 from public.tenants t
          where t.id = p_tenant_id and t.deleted_at is null
      )
    returning current_period_end into v_end;

    if v_end is null then
        raise exception 'This workspace isn''t on a trial that can be extended.'
            using errcode = 'P0002';
    end if;

    return v_end;
end;
$$;

-- Service role only: the platform console calls it after requirePlatformAdmin.
revoke all on function public.platform_extend_trial(uuid, integer) from public, anon, authenticated;
grant execute on function public.platform_extend_trial(uuid, integer) to service_role;
