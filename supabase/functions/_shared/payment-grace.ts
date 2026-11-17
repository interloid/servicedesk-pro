// The grace period for a failing subscription payment.
//
// It opens at the FIRST failed recurring charge and gives the workspace a
// fixed deadline to fix its payment method. During it nothing is taken away:
// the plan, seats and features all stay, PayPal keeps retrying, and any
// successful charge closes the window (clearPaymentTrouble in the webhook).
// Only reconcile-subscriptions ends it, once the deadline has passed with
// PayPal still not billing -- and then the workspace moves to Free, never
// blocked. Nothing else -- a decline, a suspension, a cancellation by PayPal --
// may close a subscription over non-payment before the deadline.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Used when platform_settings has no value (or the column isn't there yet). */
export const DEFAULT_PAYMENT_GRACE_DAYS = 14;

const MIN_DAYS = 1;
const MAX_DAYS = 30;

/** platform_settings.payment_grace_days, set by a platform admin. */
export async function loadPaymentGraceDays(
  admin: SupabaseClient,
): Promise<number> {
  const { data, error } = await admin
    .from("platform_settings")
    .select("payment_grace_days")
    .eq("id", true)
    .maybeSingle();

  const days = Number(
    (data as { payment_grace_days?: number } | null)?.payment_grace_days,
  );

  if (error || !Number.isInteger(days) || days < MIN_DAYS || days > MAX_DAYS) {
    if (error) {
      console.error(
        "[billing] grace setting unreadable, using default:",
        error,
      );
    }

    return DEFAULT_PAYMENT_GRACE_DAYS;
  }

  return days;
}

/**
 * The deadline for a subscription in payment trouble. A window already open is
 * kept, so retries and redelivered webhooks can never push it outwards.
 */
export async function graceDeadline(
  admin: SupabaseClient,
  existing: string | null | undefined,
  now = new Date(),
): Promise<string> {
  if (existing) return existing;

  const days = await loadPaymentGraceDays(admin);

  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}
