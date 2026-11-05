import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { trustedTenantLogoUrl } from "@/features/portal/avatar-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type {
  PlanDistributionSlice,
  PlatformOverview,
  PlatformTenant,
  PlatformUser,
  RevenuePoint,
  TenantStatus,
  UserStatus,
} from "../types";

// Every reader here uses the service-role client and so sees every workspace.
// Callers must have passed requirePlatformAdmin() first.

const PAGE_SIZE = 1000;

const OPEN_TICKET_STATUSES = ["new", "open", "pending", "on_hold"] as const;

// Indexed by plan rank (plans.sort_order order): Free, Pro, Business, ...
const PLAN_COLORS = ["#cbd5e1", "#0f766e", "#334155", "#0ea5e9", "#f59e0b"];

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  platform_admin: "Platform Admin",
  tenant_admin: "Tenant Admin",
  manager: "Manager",
  agent: "Agent",
  billing_admin: "Billing Admin",
};

type PlanRow = {
  id: string;
  name: string;
  price_month: number | string;
  seat_limit: number;
  sort_order: number;
};

type TenantRow = {
  logo_url: string | null;
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "cancelled";
  plan_id: string;
  created_at: string;
  block_reason?: string | null;
  block_source?: "admin" | "payment" | null;
  blocked_at?: string | null;
};

type SubscriptionRow = {
  tenant_id: string;
  status: string;
  seats: number;
  cancelled_at: string | null;
};

type MembershipRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  status: UserStatus;
  is_primary: boolean;
  created_at: string;
};

type UserRow = {
  id: string;
  email: string;
  full_name: string;
};

type InvoiceRow = {
  amount: number | string;
  amount_paid: number | string | null;
  paid_at: string | null;
  created_at: string | null;
};

/** Reads every row of a query, a page at a time (PostgREST caps a response). */
export async function fetchAll<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`[platform] query failed: ${error.message}`);
    }

    rows.push(...(data ?? []));

    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }
  }
}

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function dateOnly(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function displayStatus(
  tenant: TenantRow,
  subscription: SubscriptionRow | undefined,
): TenantStatus {
  if (tenant.status !== "active") {
    return tenant.status;
  }

  if (subscription?.status === "trialing") return "trialing";
  if (subscription?.status === "past_due") return "past_due";

  return "active";
}

const TENANT_COLUMNS =
  "id, name, slug, status, plan_id, created_at, logo_url:branding_json->>logo_url";

/** The block columns arrive with migration 20261103140000, which may be pending. */
async function loadTenants(admin: SupabaseClient): Promise<TenantRow[]> {
  const read = (columns: string) =>
    fetchAll<TenantRow>(
      (from, to) =>
        admin
          .from("tenants")
          .select(columns)
          .order("created_at", { ascending: false })
          .range(from, to) as unknown as PromiseLike<{
          data: TenantRow[] | null;
          error: { message: string } | null;
        }>,
    );

  try {
    return await read(
      `${TENANT_COLUMNS}, block_reason, block_source, blocked_at`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("block_")) {
      return read(TENANT_COLUMNS);
    }

    throw error;
  }
}

async function loadTenantRows(admin: SupabaseClient) {
  const [plans, tenants, subscriptions, memberships] = await Promise.all([
    fetchAll<PlanRow>((from, to) =>
      admin
        .from("plans")
        .select("id, name, price_month, seat_limit, sort_order")
        .order("sort_order")
        .order("price_month")
        .range(from, to),
    ),
    loadTenants(admin),
    fetchAll<SubscriptionRow>((from, to) =>
      admin
        .from("subscriptions")
        .select("tenant_id, status, seats, cancelled_at")
        .range(from, to),
    ),
    fetchAll<MembershipRow>((from, to) =>
      admin
        .from("memberships")
        .select("id, tenant_id, user_id, role, status, is_primary, created_at")
        .neq("role", "customer")
        .range(from, to),
    ),
  ]);

  return { plans, tenants, subscriptions, memberships };
}

export async function loadUsersById(
  admin: SupabaseClient,
  ids: string[],
): Promise<Map<string, UserRow>> {
  const users = new Map<string, UserRow>();
  const unique = [...new Set(ids)];

  // An `in` list travels in the URL, so keep each request's list short.
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await admin
      .from("users")
      .select("id, email, full_name")
      .in("id", unique.slice(i, i + 200));

    if (error) {
      throw new Error(`[platform] users query failed: ${error.message}`);
    }

    for (const row of (data ?? []) as UserRow[]) {
      users.set(row.id, row);
    }
  }

  return users;
}

function buildTenants(
  {
    plans,
    tenants,
    subscriptions,
    memberships,
  }: Awaited<ReturnType<typeof loadTenantRows>>,
  users: Map<string, UserRow>,
): PlatformTenant[] {
  const planById = new Map(
    plans.map((plan, index) => [plan.id, { plan, index }]),
  );
  const subscriptionByTenant = new Map(
    subscriptions.map((row) => [row.tenant_id, row]),
  );

  const seatsUsed = new Map<string, number>();
  const ownerByTenant = new Map<string, string>();

  for (const membership of memberships) {
    if (membership.status === "active") {
      seatsUsed.set(
        membership.tenant_id,
        (seatsUsed.get(membership.tenant_id) ?? 0) + 1,
      );
    }

    if (membership.is_primary) {
      ownerByTenant.set(membership.tenant_id, membership.user_id);
    }
  }

  return tenants.map((tenant) => {
    const planEntry = planById.get(tenant.plan_id);
    const subscription = subscriptionByTenant.get(tenant.id);
    const owner = users.get(ownerByTenant.get(tenant.id) ?? "");
    const price = Number(planEntry?.plan.price_month ?? 0);

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      initials: initialsOf(tenant.name),
      logoUrl: trustedTenantLogoUrl(tenant.logo_url?.trim() || null),
      plan: planEntry?.plan.name ?? "Unknown",
      planRank: planEntry?.index ?? 0,
      seatsUsed: seatsUsed.get(tenant.id) ?? 0,
      seatsLimit: subscription?.seats ?? planEntry?.plan.seat_limit ?? 0,
      // The plan's flat monthly rate, counted only while the workspace is live.
      mrr: tenant.status === "active" ? price : 0,
      status: displayStatus(tenant, subscription),
      createdAt: dateOnly(tenant.created_at),
      owner: owner?.full_name ?? "—",
      ownerEmail: owner?.email ?? "",
      blockReason: tenant.block_reason ?? null,
      blockSource: tenant.block_source ?? null,
      blockedAt: tenant.blocked_at ?? null,
    };
  });
}

export async function getPlatformTenants(): Promise<PlatformTenant[]> {
  const admin = createSupabaseAdminClient();
  const rows = await loadTenantRows(admin);
  const users = await loadUsersById(
    admin,
    rows.memberships.filter((m) => m.is_primary).map((m) => m.user_id),
  );

  return buildTenants(rows, users);
}

/** auth.users.last_sign_in_at, which public.users does not mirror. */
async function loadLastSignIns(
  admin: SupabaseClient,
): Promise<Map<string, string>> {
  const { data: summary, error: summaryError } = await admin.rpc(
    "platform_last_sign_ins",
  );

  if (!summaryError) {
    return new Map(Object.entries((summary ?? {}) as Record<string, string>));
  }

  // PGRST202: migration 20261103160000 isn't on this database yet.
  if (summaryError.code !== "PGRST202") {
    console.error("[platform] sign-in summary failed:", summaryError.message);
  }

  const lastSignIn = new Map<string, string>();

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });

    if (error) {
      throw new Error(`[platform] listUsers failed: ${error.message}`);
    }

    for (const user of data.users) {
      if (user.last_sign_in_at) {
        lastSignIn.set(user.id, user.last_sign_in_at);
      }
    }

    if (data.users.length < PAGE_SIZE) {
      return lastSignIn;
    }
  }
}

export async function getPlatformUsers(): Promise<PlatformUser[]> {
  const admin = createSupabaseAdminClient();

  const [memberships, tenants, lastSignIns] = await Promise.all([
    fetchAll<MembershipRow>((from, to) =>
      admin
        .from("memberships")
        .select("id, tenant_id, user_id, role, status, is_primary, created_at")
        .neq("role", "customer")
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    fetchAll<Pick<TenantRow, "id" | "name" | "slug">>((from, to) =>
      admin.from("tenants").select("id, name, slug").range(from, to),
    ),
    loadLastSignIns(admin),
  ]);

  const users = await loadUsersById(
    admin,
    memberships.map((m) => m.user_id),
  );
  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));

  return memberships.map((membership) => {
    const user = users.get(membership.user_id);
    const tenant = tenantById.get(membership.tenant_id);

    return {
      id: membership.id,
      name: user?.full_name || user?.email || "Unknown user",
      email: user?.email ?? "",
      tenant: tenant?.name ?? "Unknown workspace",
      tenantSlug: tenant?.slug ?? "",
      role: ROLE_DISPLAY_NAMES[membership.role] ?? membership.role,
      status: membership.status,
      lastActiveAt: lastSignIns.get(membership.user_id) ?? "",
      createdAt: dateOnly(membership.created_at),
    };
  });
}

/** The last 12 calendar months (UTC), oldest first, as YYYY-MM keys. */
function lastTwelveMonths(now: Date): string[] {
  const months: string[] = [];

  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1),
    );
    months.push(date.toISOString().slice(0, 7));
  }

  return months;
}

function monthLabel(key: string): string {
  return new Date(`${key}-01T00:00:00Z`).toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const months = lastTwelveMonths(now);
  const windowStart = `${months[0]}-01T00:00:00Z`;

  const [rows, invoices, openTickets] = await Promise.all([
    loadTenantRows(admin),
    fetchAll<InvoiceRow>((from, to) =>
      admin
        .from("invoices")
        .select("amount, amount_paid, paid_at, created_at")
        .eq("status", "paid")
        .gte("created_at", windowStart)
        .range(from, to),
    ),
    admin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .in("status", OPEN_TICKET_STATUSES),
  ]);

  if (openTickets.error) {
    throw new Error(
      `[platform] tickets count failed: ${openTickets.error.message}`,
    );
  }

  const users = await loadUsersById(
    admin,
    rows.memberships.filter((m) => m.is_primary).map((m) => m.user_id),
  );
  const tenants = buildTenants(rows, users);

  const series = new Map<string, RevenuePoint>(
    months.map((key) => [
      key,
      { month: monthLabel(key), revenue: 0, newTenants: 0, churned: 0 },
    ]),
  );

  for (const invoice of invoices) {
    const at = invoice.paid_at ?? invoice.created_at;
    const point = at ? series.get(monthKey(at)) : undefined;

    if (point) {
      point.revenue += Number(invoice.amount_paid ?? invoice.amount ?? 0);
    }
  }

  for (const tenant of rows.tenants) {
    const point = series.get(monthKey(tenant.created_at));
    if (point) point.newTenants += 1;
  }

  for (const subscription of rows.subscriptions) {
    if (!subscription.cancelled_at) continue;
    const point = series.get(monthKey(subscription.cancelled_at));
    if (point) point.churned += 1;
  }

  const revenueSeries = [...series.values()].map((point) => ({
    ...point,
    revenue: Math.round(point.revenue * 100) / 100,
  }));
  const thisMonth = revenueSeries[revenueSeries.length - 1];

  const planCounts = new Map<string, { value: number; rank: number }>();

  for (const tenant of tenants) {
    if (tenant.status === "cancelled" || tenant.status === "suspended")
      continue;
    const entry = planCounts.get(tenant.plan) ?? {
      value: 0,
      rank: tenant.planRank,
    };
    entry.value += 1;
    planCounts.set(tenant.plan, entry);
  }

  const planDistribution: PlanDistributionSlice[] = [...planCounts.entries()]
    .sort((a, b) => a[1].rank - b[1].rank)
    .map(([name, { value, rank }]) => ({
      name,
      value,
      color: PLAN_COLORS[rank % PLAN_COLORS.length],
    }));

  const activeUsers = new Set(
    rows.memberships.filter((m) => m.status === "active").map((m) => m.user_id),
  ).size;

  return {
    metrics: {
      totalTenants: tenants.length,
      activeTenants: tenants.filter(
        (t) => t.status !== "cancelled" && t.status !== "suspended",
      ).length,
      mrr: tenants.reduce((sum, tenant) => sum + tenant.mrr, 0),
      payingTenants: tenants.filter((tenant) => tenant.mrr > 0).length,
      activeUsers,
      openTickets: openTickets.count ?? 0,
      signupsThisMonth: thisMonth.newTenants,
      churnedThisMonth: thisMonth.churned,
    },
    tenants,
    revenueSeries,
    planDistribution,
  };
}
