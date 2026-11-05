import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type {
  PlatformBillingData,
  PlatformSubscription,
  SubscriptionStage,
} from "../types";
import { fetchAll, initialsOf, loadUsersById } from "./platform-data.service";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT_INVOICES = 5;

type SubscriptionRow = {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string;
  seats: number;
  paypal_subscription_id: string | null;
  paypal_status: string | null;
  payment_status: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  cancellation_source: string | null;
  cancel_at_period_end: boolean;
  next_plan_id: string | null;
  next_plan_effective_at: string | null;
  payment_failure_count: number;
  last_payment_failure_at: string | null;
  grace_period_ends_at: string | null;
  billing_actor_id?: string | null;
  created_at: string | null;
};

const SUBSCRIPTION_COLUMNS =
  "id, tenant_id, plan_id, status, seats, paypal_subscription_id, paypal_status, payment_status, current_period_end, cancelled_at, cancellation_source, cancel_at_period_end, next_plan_id, next_plan_effective_at, payment_failure_count, last_payment_failure_at, grace_period_ends_at, created_at";

/** billing_actor_id arrives with migration 20261030140000, which may be pending. */
async function loadSubscriptions(
  admin: SupabaseClient,
): Promise<SubscriptionRow[]> {
  const read = (columns: string) =>
    fetchAll<SubscriptionRow>(
      (from, to) =>
        admin
          .from("subscriptions")
          .select(columns)
          .order("created_at", { ascending: false })
          .range(from, to) as unknown as PromiseLike<{
          data: SubscriptionRow[] | null;
          error: { message: string } | null;
        }>,
    );

  try {
    return await read(`${SUBSCRIPTION_COLUMNS}, billing_actor_id`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("billing_actor_id")) {
      return read(SUBSCRIPTION_COLUMNS);
    }

    throw error;
  }
}

type InvoiceSummary = Record<
  string,
  {
    lifetime_paid: number | string;
    recent: Array<{
      number: string | null;
      amount: number | string | null;
      status: string;
      date: string | null;
    }>;
  }
>;

/** Totals and the newest invoices per workspace, added up by the database. */
async function loadInvoiceSummary(
  admin: SupabaseClient,
): Promise<InvoiceSummary> {
  const { data, error } = await admin.rpc("platform_invoice_summary");

  if (!error) return (data ?? {}) as InvoiceSummary;

  // PGRST202: migration 20261103160000 isn't on this database yet.
  if (error.code !== "PGRST202") {
    throw new Error(`[platform] invoice summary failed: ${error.message}`);
  }

  const invoices = await fetchAll<{
    tenant_id: string;
    invoice_number: string | null;
    amount: number | string;
    amount_paid: number | string | null;
    status: string;
    paid_at: string | null;
    created_at: string | null;
  }>((from, to) =>
    admin
      .from("invoices")
      .select(
        "tenant_id, invoice_number, amount, amount_paid, status, paid_at, created_at",
      )
      .order("created_at", { ascending: false })
      .range(from, to),
  );
  const summary: InvoiceSummary = {};

  for (const invoice of invoices) {
    const entry = (summary[invoice.tenant_id] ??= {
      lifetime_paid: 0,
      recent: [],
    });
    const amount = Number(invoice.amount_paid ?? invoice.amount ?? 0);

    if (invoice.status === "paid") {
      entry.lifetime_paid = Number(entry.lifetime_paid) + amount;
    }

    if (entry.recent.length < RECENT_INVOICES) {
      entry.recent.push({
        number: invoice.invoice_number,
        amount,
        status: invoice.status,
        date: invoice.paid_at ?? invoice.created_at,
      });
    }
  }

  return summary;
}

function stageOf(row: SubscriptionRow): SubscriptionStage {
  if (row.status === "cancelled" || row.status === "expired") {
    return row.status;
  }

  if (row.cancel_at_period_end) return "cancelling";
  if (row.status === "trialing") return "trialing";
  if (row.status === "past_due") return "past_due";

  return "active";
}

export async function getPlatformBilling(): Promise<PlatformBillingData> {
  const admin = createSupabaseAdminClient();

  const [subscriptions, plans, tenants, owners, invoiceSummary] =
    await Promise.all([
      loadSubscriptions(admin),
      fetchAll<{
        id: string;
        name: string;
        price_month: number | string;
        sort_order: number;
      }>((from, to) =>
        admin
          .from("plans")
          .select("id, name, price_month, sort_order")
          .order("sort_order")
          .order("price_month")
          .range(from, to),
      ),
      fetchAll<{
        id: string;
        name: string;
        slug: string;
        status: string;
        plan_id: string;
      }>((from, to) =>
        admin
          .from("tenants")
          .select("id, name, slug, status, plan_id")
          .range(from, to),
      ),
      fetchAll<{ tenant_id: string; user_id: string }>((from, to) =>
        admin
          .from("memberships")
          .select("tenant_id, user_id")
          .eq("is_primary", true)
          .range(from, to),
      ),
      loadInvoiceSummary(admin),
    ]);

  const planById = new Map(
    plans.map((plan, rank) => [plan.id, { plan, rank }]),
  );
  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  const ownerByTenant = new Map(owners.map((o) => [o.tenant_id, o.user_id]));
  const users = await loadUsersById(admin, [
    ...owners.map((owner) => owner.user_id),
    ...subscriptions.flatMap((row) =>
      row.billing_actor_id ? [row.billing_actor_id] : [],
    ),
  ]);

  const rows: PlatformSubscription[] = subscriptions.map((row) => {
    const tenant = tenantById.get(row.tenant_id);
    const planEntry = planById.get(row.plan_id);
    const owner = users.get(ownerByTenant.get(row.tenant_id) ?? "");
    const actor = users.get(row.billing_actor_id ?? "");
    const stage = stageOf(row);
    const ended = stage === "cancelled" || stage === "expired";
    // Same rule as the overview: the tenant's current plan, while it is live.
    const tenantPlan = planById.get(tenant?.plan_id ?? "");
    const mrr =
      tenant?.status === "active" && !ended
        ? Number(tenantPlan?.plan.price_month ?? 0)
        : 0;

    let cancelledBy: string | null = null;
    let cancelledByEmail: string | null = null;

    if (row.cancellation_source === "paypal") {
      cancelledBy = "PayPal";
    } else if (row.cancellation_source === "system") {
      cancelledBy = "System";
    } else if (ended || stage === "cancelling") {
      cancelledBy = actor?.full_name || actor?.email || null;
      cancelledByEmail = actor?.email ?? null;
    }

    return {
      id: row.id,
      tenantName: tenant?.name ?? "Deleted workspace",
      tenantSlug: tenant?.slug ?? "",
      initials: initialsOf(tenant?.name ?? "?"),
      plan: planEntry?.plan.name ?? "Unknown",
      planRank: planEntry?.rank ?? 0,
      mrr,
      stage,
      seats: row.seats,
      paypalId: row.paypal_subscription_id,
      paypalStatus: row.paypal_status,
      paymentStatus: row.payment_status,
      startedAt: row.created_at,
      periodEnd: row.current_period_end,
      cancelledAt: row.cancelled_at,
      cancelledBy,
      cancelledByEmail,
      nextPlan: planById.get(row.next_plan_id ?? "")?.plan.name ?? null,
      nextPlanAt: row.next_plan_effective_at,
      paymentFailures: row.payment_failure_count,
      lastPaymentFailureAt: row.last_payment_failure_at,
      graceEndsAt: row.grace_period_ends_at,
      owner: owner?.full_name || owner?.email || "—",
      ownerEmail: owner?.email ?? "",
      lifetimePaid:
        Math.round(
          Number(invoiceSummary[row.tenant_id]?.lifetime_paid ?? 0) * 100,
        ) / 100,
      invoices: (invoiceSummary[row.tenant_id]?.recent ?? []).map(
        (invoice) => ({
          number: invoice.number ?? "—",
          amount: Number(invoice.amount ?? 0),
          status: invoice.status,
          date: invoice.date ?? "",
        }),
      ),
    };
  });

  const since = Date.now() - THIRTY_DAYS_MS;

  return {
    subscriptions: rows,
    metrics: {
      mrr: rows.reduce((sum, row) => sum + row.mrr, 0),
      paying: rows.filter((row) => row.mrr > 0).length,
      pastDue: rows.filter((row) => row.stage === "past_due").length,
      cancelling: rows.filter((row) => row.stage === "cancelling").length,
      mrrAtRisk: rows
        .filter((row) => row.stage === "cancelling")
        .reduce((sum, row) => sum + row.mrr, 0),
      // Ended only: one still running to its period end counts as cancelling.
      cancelledLast30Days: rows.filter(
        (row) =>
          (row.stage === "cancelled" || row.stage === "expired") &&
          row.cancelledAt &&
          Date.parse(row.cancelledAt) >= since,
      ).length,
    },
  };
}
