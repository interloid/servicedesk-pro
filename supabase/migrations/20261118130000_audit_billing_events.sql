-- =====================================================
-- Audit log: payment status changes and generated invoices
--
-- * Subscriptions: a change of status (trialing, active, past due,
--   cancelled, expired) or of PayPal's payment status is recorded.
-- * Invoices: every invoice is recorded when it is generated, and again when
--   it is paid, fails or is refunded. An invoice created already paid is one
--   row ("Paid ..."), as before.
-- =====================================================

create or replace function public.audit_billing_status_label(p_status text)
returns text
language sql
immutable
as $$
    select initcap(replace(coalesce(p_status, 'none'), '_', ' '));
$$;

-- Subscriptions -----------------------------------------------------------

create or replace function public.audit_subscriptions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_old_plan public.plans;
    v_new_plan public.plans;
    v_next_plan public.plans;
    v_related jsonb;
begin
    v_related := jsonb_strip_nulls(jsonb_build_object(
        'paypal_subscription_id', new.paypal_subscription_id
    ));

    -- A webhook or cron applying a change has no user: attribute it to the
    -- Tenant Admin or Billing Admin who last changed billing.
    perform set_config(
        'app.audit_fallback_actor',
        coalesce(new.billing_actor_id::text, ''),
        true
    );

    if tg_op = 'INSERT' then
        select * into v_new_plan from public.plans where id = new.plan_id;
        perform public.audit_record(
            new.tenant_id,
            'create',
            'subscription',
            new.id,
            jsonb_build_object(
                'summary', format('Started the %s plan', coalesce(v_new_plan.name, 'new')),
                'related', v_related
            )
        );
        perform set_config('app.audit_fallback_actor', '', true);
        return null;
    end if;

    if new.plan_id is distinct from old.plan_id then
        select * into v_old_plan from public.plans where id = old.plan_id;
        select * into v_new_plan from public.plans where id = new.plan_id;

        perform public.audit_record(
            new.tenant_id,
            'update',
            'subscription',
            new.id,
            jsonb_build_object(
                'summary', format(
                    'Changed plan from %s to %s',
                    coalesce(v_old_plan.name, 'unknown'),
                    coalesce(v_new_plan.name, 'unknown')
                ),
                'changes', jsonb_build_object(
                    'plan', jsonb_build_object('from', v_old_plan.name, 'to', v_new_plan.name),
                    'seat_limit', jsonb_build_object('from', v_old_plan.seat_limit, 'to', v_new_plan.seat_limit),
                    'price_month', jsonb_build_object('from', v_old_plan.price_month, 'to', v_new_plan.price_month)
                ),
                'related', v_related
            )
        );
    end if;

    if new.cancel_at_period_end is distinct from old.cancel_at_period_end then
        perform public.audit_record(
            new.tenant_id,
            'update',
            'subscription',
            new.id,
            jsonb_build_object(
                'summary',
                case when new.cancel_at_period_end
                    then 'Cancelled the subscription at the end of the billing period'
                    else 'Resumed the subscription'
                end,
                'related', v_related
            )
        );
    end if;

    if new.next_plan_id is distinct from old.next_plan_id
       and new.next_plan_id is not null
       and not new.cancel_at_period_end then
        select * into v_next_plan from public.plans where id = new.next_plan_id;
        perform public.audit_record(
            new.tenant_id,
            'update',
            'subscription',
            new.id,
            jsonb_build_object(
                'summary', format(
                    'Scheduled a change to the %s plan',
                    coalesce(v_next_plan.name, 'new')
                ),
                'effective_at', new.next_plan_effective_at,
                'related', v_related
            )
        );
    end if;

    if new.seats is distinct from old.seats then
        perform public.audit_record(
            new.tenant_id,
            'update',
            'subscription',
            new.id,
            jsonb_build_object(
                'summary', format('Changed seats from %s to %s', old.seats, new.seats),
                'changes', jsonb_build_object(
                    'seats', jsonb_build_object('from', old.seats, 'to', new.seats)
                ),
                'related', v_related
            )
        );
    end if;

    -- Subscription status: the payment outcome a workspace sees.
    if new.status is distinct from old.status then
        perform public.audit_record(
            new.tenant_id,
            'update',
            'subscription',
            new.id,
            jsonb_strip_nulls(jsonb_build_object(
                'summary',
                case
                    when old.status = 'past_due' and new.status = 'active'
                        then 'Payment recovered: the subscription is active again'
                    when new.status = 'past_due'
                        then 'Payment failed: the subscription is past due'
                    when old.status = 'trialing' and new.status = 'active'
                        then 'Trial ended: the subscription is now paid'
                    when new.status = 'cancelled'
                        then 'Subscription cancelled'
                    when new.status = 'expired'
                        then 'Subscription expired'
                    else format(
                        'Subscription status changed from %s to %s',
                        public.audit_billing_status_label(old.status::text),
                        public.audit_billing_status_label(new.status::text)
                    )
                end,
                'changes', jsonb_build_object('status', jsonb_build_object(
                    'from', public.audit_billing_status_label(old.status::text),
                    'to', public.audit_billing_status_label(new.status::text)
                )),
                'grace_period_ends_at', new.grace_period_ends_at,
                'related', v_related
            ))
        );
    -- PayPal's collection state on its own (the status row above covers it
    -- when both move together).
    elsif new.payment_status is distinct from old.payment_status
          and new.payment_status is not null then
        perform public.audit_record(
            new.tenant_id,
            'update',
            'subscription',
            new.id,
            jsonb_build_object(
                'summary',
                case new.payment_status
                    when 'paid' then 'Payment received'
                    when 'failed' then 'Payment failed'
                    else format(
                        'Payment status changed to %s',
                        public.audit_billing_status_label(new.payment_status)
                    )
                end,
                'changes', jsonb_build_object('payment_status', jsonb_build_object(
                    'from', public.audit_billing_status_label(old.payment_status),
                    'to', public.audit_billing_status_label(new.payment_status)
                )),
                'related', v_related
            )
        );
    end if;

    perform set_config('app.audit_fallback_actor', '', true);
    return null;
end;
$$;

-- Invoices ----------------------------------------------------------------

-- The person is whoever is acting (an upgrade paid in the app), else the
-- subscription's billing_actor_id: the Tenant Admin or Billing Admin whose
-- agreement a renewal is charged to.
create or replace function public.audit_invoices()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor uuid;
    v_ref text;
    v_amount text;
    v_summary text;
    v_action public.audit_action;
begin
    if tg_op = 'UPDATE' and new.status is not distinct from old.status then
        return null;
    end if;

    v_ref := case
        when nullif(new.invoice_number, '') is not null
            then format('invoice %s', new.invoice_number)
        else 'an invoice'
    end;
    v_amount := format(
        '%s %s',
        new.currency,
        to_char(coalesce(new.amount_paid, new.amount), 'FM999999990.00')
    );

    if new.status = 'paid' then
        v_action := 'create';
        v_summary := format(
            'Paid %s for the %s plan%s',
            v_amount,
            coalesce(nullif(new.plan_name, ''), 'current'),
            case
                when nullif(new.invoice_number, '') is not null
                then format(' (%s)', new.invoice_number)
                else ''
            end
        );
    elsif tg_op = 'INSERT' then
        v_action := 'create';
        v_summary := format(
            'Generated %s for %s (%s plan)',
            v_ref,
            v_amount,
            coalesce(nullif(new.plan_name, ''), 'current')
        );
    else
        v_action := 'update';
        v_summary := case new.status
            when 'failed' then format('Payment failed for %s (%s)', v_ref, v_amount)
            when 'refunded' then format('Refunded %s (%s)', v_ref, v_amount)
            else format(
                'Changed %s from %s to %s',
                v_ref,
                public.audit_billing_status_label(old.status::text),
                public.audit_billing_status_label(new.status::text)
            )
        end;
    end if;

    select s.billing_actor_id into v_actor
    from public.subscriptions s
    where s.tenant_id = new.tenant_id
      and (new.subscription_id is null or s.id = new.subscription_id)
    limit 1;

    perform set_config(
        'app.audit_fallback_actor',
        coalesce(v_actor::text, ''),
        true
    );

    perform public.audit_record(
        new.tenant_id,
        v_action,
        'invoice',
        new.id,
        jsonb_strip_nulls(jsonb_build_object(
            'summary', v_summary,
            'amount', coalesce(new.amount_paid, new.amount),
            'currency', new.currency,
            'invoice_number', new.invoice_number,
            'invoice_type', new.invoice_type,
            'payment_method', new.payment_method,
            'status', new.status,
            'changes', case when tg_op = 'UPDATE' then jsonb_build_object(
                'status', jsonb_build_object(
                    'from', public.audit_billing_status_label(old.status::text),
                    'to', public.audit_billing_status_label(new.status::text)
                )
            ) end,
            'related', jsonb_strip_nulls(jsonb_build_object(
                'paypal_subscription_id', new.paypal_subscription_id
            ))
        ))
    );

    perform set_config('app.audit_fallback_actor', '', true);
    return null;
end;
$$;

revoke execute on function public.audit_invoices() from public, anon, authenticated;
