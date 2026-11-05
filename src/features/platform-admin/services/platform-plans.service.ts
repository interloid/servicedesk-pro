import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

import {
  PLAN_FEATURES,
  type PlanFeatureKey,
  type PlatformPlan,
} from "../types";

type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_month: number | string;
  seat_limit: number;
  ticket_limit: number | null;
  storage_limit_mb: number | null;
  is_active: boolean;
  features_json: Record<string, unknown> | string | null;
};

function featuresOf(row: PlanRow): Record<string, unknown> {
  const raw = row.features_json;

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  return raw ?? {};
}

export async function getPlatformPlans(): Promise<PlatformPlan[]> {
  const admin = createSupabaseAdminClient();
  const plans = await admin
    .from("plans")
    .select(
      "id, code, name, description, price_month, seat_limit, ticket_limit, storage_limit_mb, is_active, features_json",
    )
    .order("sort_order")
    // Price breaks ties: rows with equal sort_order come back in whatever order
    // Postgres finds them, and saving a plan moves it to the end of that.
    .order("price_month");

  if (plans.error) {
    throw new Error(`[platform] plans query failed: ${plans.error.message}`);
  }

  const rows = (plans.data ?? []) as PlanRow[];
  // Counted by the database: the API returns at most 1,000 rows, so counting a
  // fetched list comes out too low with no warning once there are more.
  const counts = await Promise.all(
    rows.map((row) =>
      admin
        .from("tenants")
        .select("id", { count: "exact", head: true })
        .eq("plan_id", row.id)
        .eq("status", "active"),
    ),
  );
  const failed = counts.find((count) => count.error);

  if (failed?.error) {
    throw new Error(`[platform] tenants count failed: ${failed.error.message}`);
  }

  return rows.map((row, index) => {
    const raw = featuresOf(row);
    const workspaces = counts[index].count ?? 0;
    const price = Number(row.price_month);

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description ?? "",
      price,
      seatLimit: row.seat_limit,
      ticketLimit: row.ticket_limit,
      storageLimitMb: row.storage_limit_mb,
      isActive: row.is_active,
      features: Object.fromEntries(
        PLAN_FEATURES.map(({ key }) => [key, raw[key] === true]),
      ) as Record<PlanFeatureKey, boolean>,
      slaPolicies: typeof raw.sla_policies === "number" ? raw.sla_policies : 1,
      workspaces,
      mrr: workspaces * price,
    };
  });
}

/**
 * Only what is safe to change from here. Not the price: PayPal charges what its
 * own billing plan says, so an edit here would show one price and bill another.
 * Not the code: it is the PayPal plan id. Not the name: reports and branding
 * access are decided by it. Flags this page doesn't know about are kept.
 */
export async function updatePlatformPlan(input: {
  id: string;
  description: string;
  seatLimit: number;
  slaPolicies: number;
  features: Record<PlanFeatureKey, boolean>;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: current, error: readError } = await admin
    .from("plans")
    .select("features_json")
    .eq("id", input.id)
    .maybeSingle<Pick<PlanRow, "features_json">>();

  if (readError) {
    throw new Error(`Couldn't read the plan: ${readError.message}`);
  }

  if (!current) {
    throw new Error("That plan no longer exists.");
  }

  const merged: Record<string, unknown> = {
    ...featuresOf(current as PlanRow),
    sla_policies: input.slaPolicies,
  };

  // Absent rather than false, the way the plans were seeded: the pricing page
  // lists a key with a number or `true`, and drops one that is missing.
  for (const { key } of PLAN_FEATURES) {
    if (input.features[key]) {
      merged[key] = true;
    } else {
      delete merged[key];
    }
  }

  const { error } = await admin
    .from("plans")
    .update({
      description: input.description,
      seat_limit: input.seatLimit,
      features_json: merged as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(`Couldn't save the plan: ${error.message}`);
  }
}
