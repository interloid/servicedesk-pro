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

export class PlatformPlanError extends Error {}

/**
 * A new paid plan. It starts hidden: nobody can pick it until a platform admin
 * sets its features and shows it. `code` is the PayPal billing plan id, and
 * every paid plan must sit under one PayPal product, so the product is copied
 * from the existing paid plans.
 */
export async function createPlatformPlan(input: {
  name: string;
  code: string;
  price: number;
  description: string;
  seatLimit: number;
}): Promise<{ id: string }> {
  const admin = createSupabaseAdminClient();
  const { data: existing, error: readError } = await admin
    .from("plans")
    .select("name, code, sort_order, price_month, paypal_product_id");

  if (readError) {
    throw new Error(`Couldn't read the plans: ${readError.message}`);
  }

  const rows = existing ?? [];
  const name = input.name.trim();

  if (rows.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
    throw new PlatformPlanError(`A plan named ${name} already exists.`);
  }

  if (rows.some((row) => row.code === input.code)) {
    throw new PlatformPlanError(
      "Another plan already uses that PayPal plan ID.",
    );
  }

  const product =
    rows.find((row) => Number(row.price_month) > 0 && row.paypal_product_id)
      ?.paypal_product_id ?? null;
  const sortOrder =
    rows.reduce((max, row) => Math.max(max, row.sort_order ?? 0), 0) + 1;

  const { data, error } = await admin
    .from("plans")
    .insert({
      name,
      code: input.code,
      price_month: input.price,
      description: input.description || null,
      seat_limit: input.seatLimit,
      is_active: false,
      sort_order: sortOrder,
      paypal_product_id: product,
      features_json: { sla_policies: 1 },
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new PlatformPlanError("That plan name or PayPal plan ID is taken.");
    }

    throw new Error(`Couldn't create the plan: ${error.message}`);
  }

  return { id: data.id };
}

/**
 * Deprecate (hide) or show a plan. Plans are never deleted: workspaces on a
 * deprecated plan keep it and keep being billed for it; only new choices of it
 * stop. The Free plan can't be hidden -- cancellations and failed payments move
 * workspaces onto it.
 */
export async function setPlatformPlanActive(
  id: string,
  isActive: boolean,
): Promise<{ name: string }> {
  const admin = createSupabaseAdminClient();
  const { data: plan, error: readError } = await admin
    .from("plans")
    .select("name, price_month")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    throw new Error(`Couldn't read the plan: ${readError.message}`);
  }

  if (!plan) {
    throw new PlatformPlanError("That plan no longer exists.");
  }

  if (!isActive && Number(plan.price_month) === 0) {
    throw new PlatformPlanError(
      "The Free plan can't be deprecated: cancelled workspaces move onto it.",
    );
  }

  const { error } = await admin
    .from("plans")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(`Couldn't update the plan: ${error.message}`);
  }

  return { name: plan.name };
}
