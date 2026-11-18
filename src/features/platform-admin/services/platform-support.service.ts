import "server-only";

import {
  createAuditedAdminClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";
import { serverNow } from "@/lib/server-now";

import {
  loadSupportMessages,
  SUPPORT_REQUEST_SELECT,
  toSupportRequest,
  type SupportRequestRow,
} from "@/features/support/services/support-data";
import {
  isOpenSupportStatus,
  type SupportRequest,
  type SupportRequestDetail,
  type SupportStatus,
} from "@/features/support/support";

export type PlatformSupportRequest = SupportRequest & {
  tenantName: string;
  tenantSlug: string;
  planName: string;
};

export type PlatformSupportDetail = SupportRequestDetail & {
  tenantName: string;
  tenantSlug: string;
  planName: string;
};

type Admin = { id: string; email: string; name: string };

type TenantInfo = { id: string; name: string; slug: string; planName: string };

async function tenantsById(ids: string[]): Promise<Map<string, TenantInfo>> {
  if (ids.length === 0) return new Map();

  const { data, error } = await createSupabaseAdminClient()
    .from("tenants")
    .select("id, name, slug, plan:plans!tenants_plan_id_fkey ( name )")
    .in("id", [...new Set(ids)])
    .returns<
      Array<{
        id: string;
        name: string;
        slug: string;
        plan: { name: string } | null;
      }>
    >();

  if (error) {
    throw new Error(`[platform] tenants lookup failed: ${error.message}`);
  }

  return new Map(
    (data ?? []).map((t) => [
      t.id,
      { id: t.id, name: t.name, slug: t.slug, planName: t.plan?.name ?? "—" },
    ]),
  );
}

function withTenant<T extends SupportRequest>(
  request: T,
  tenants: Map<string, TenantInfo>,
) {
  const tenant = tenants.get(request.tenantId);

  return {
    ...request,
    tenantName: tenant?.name ?? "Deleted workspace",
    tenantSlug: tenant?.slug ?? "",
    planName: tenant?.planName ?? "—",
  };
}

export async function listPlatformSupportRequests(): Promise<
  PlatformSupportRequest[]
> {
  const now = await serverNow();
  const { data, error } = await createSupabaseAdminClient()
    .from("support_requests")
    .select(SUPPORT_REQUEST_SELECT)
    .order("updated_at", { ascending: false })
    .limit(1000)
    .returns<SupportRequestRow[]>();

  if (error) {
    throw new Error(`[platform] support list failed: ${error.message}`);
  }

  const requests = (data ?? []).map((row) => toSupportRequest(row, now));
  const tenants = await tenantsById(requests.map((r) => r.tenantId));

  return requests.map((request) => withTenant(request, tenants));
}

/** The newest request of this workspace whose access grant is active, if any. */
export async function activeAccessRequestId(
  tenantId: string,
): Promise<string | null> {
  const requests = await listPlatformSupportRequests();

  return (
    requests.find((r) => r.tenantId === tenantId && r.accessActive)?.id ?? null
  );
}

async function readRequest(requestId: string): Promise<SupportRequest | null> {
  const { data, error } = await createSupabaseAdminClient()
    .from("support_requests")
    .select(SUPPORT_REQUEST_SELECT)
    .eq("id", requestId)
    .maybeSingle<SupportRequestRow>();

  if (error) {
    throw new Error(`[platform] support read failed: ${error.message}`);
  }

  return data ? toSupportRequest(data, await serverNow()) : null;
}

export async function getPlatformSupportRequest(
  requestId: string,
): Promise<PlatformSupportDetail | null> {
  const request = await readRequest(requestId);

  if (!request) return null;

  const detail = await loadSupportMessages(
    createSupabaseAdminClient(),
    request,
  );

  return withTenant(detail, await tenantsById([request.tenantId]));
}

export async function replyAsPlatform(
  admin: Admin,
  requestId: string,
  body: string,
): Promise<void> {
  const request = await readRequest(requestId);

  if (!request) throw new Error("That support request no longer exists.");
  if (request.status === "closed") {
    throw new Error(
      "This request is closed; the workspace can open a new one.",
    );
  }

  // Audited: the status change below names this operator, not "System".
  const db = await createAuditedAdminClient(admin.id);
  const { error } = await db.from("support_request_messages").insert({
    request_id: request.id,
    author_type: "platform",
    author_id: admin.id,
    author_name: `${admin.name} (Support)`,
    body,
  });

  if (error) throw new Error(`Couldn't send the reply: ${error.message}`);

  // Answered: the ball is in the customer's court, unless already resolved.
  if (request.status === "open" || request.status === "in_progress") {
    const { error: statusError } = await db
      .from("support_requests")
      .update({ status: "waiting_on_customer" })
      .eq("id", request.id);

    if (statusError) {
      throw new Error(`Couldn't update the status: ${statusError.message}`);
    }
  }
}

export async function setPlatformSupportStatus(
  admin: Admin,
  requestId: string,
  status: SupportStatus,
): Promise<void> {
  const request = await readRequest(requestId);

  if (!request) throw new Error("That support request no longer exists.");

  const open = isOpenSupportStatus(status);
  const { error } = await (
    await createAuditedAdminClient(admin.id)
  )
    .from("support_requests")
    .update({
      status,
      resolved_at: open
        ? null
        : (request.resolvedAt ?? new Date(await serverNow()).toISOString()),
      // Resolving or closing ends any workspace access the tenant granted.
      ...(open
        ? {}
        : { allow_workspace_access: false, access_expires_at: null }),
    })
    .eq("id", request.id);

  if (error) throw new Error(`Couldn't update the status: ${error.message}`);
}

// ---------------------------------------------------------------------------
// In-Person View: a read-only snapshot of the workspace, for troubleshooting.
// ---------------------------------------------------------------------------

export type WorkspaceSnapshot = {
  request: PlatformSupportRequest;
  tenant: {
    name: string;
    slug: string;
    status: string;
    planName: string;
    createdAt: string;
    blockedAt: string | null;
    blockReason: string | null;
  };
  subscription: {
    status: string;
    seats: number;
    periodEnd: string | null;
    paymentFailures: number;
  } | null;
  ticketCounts: Record<string, number>;
  tickets: Array<{
    number: number;
    subject: string;
    status: string;
    priority: string;
    assignee: string;
    requester: string;
    updatedAt: string;
  }>;
  team: Array<{
    name: string;
    email: string;
    role: string;
    status: string;
    isOwner: boolean;
  }>;
  customers: number;
  slaPolicies: Array<{
    name: string;
    status: string;
    isDefault: boolean;
    appliesTo: string;
  }>;
  businessHours: Array<{ name: string; timezone: string }>;
};

const TICKET_STATUSES = [
  "new",
  "open",
  "pending",
  "on_hold",
  "resolved",
  "closed",
] as const;

/**
 * Loads the snapshot only while the tenant's grant is active, and records the
 * view in the workspace's own audit log before returning anything. Returns
 * null when access isn't (or is no longer) granted.
 */
export async function openWorkspaceView(
  admin: Admin,
  requestId: string,
): Promise<WorkspaceSnapshot | "no-access" | null> {
  const request = await readRequest(requestId);

  if (!request) return null;
  if (!request.accessActive) return "no-access";

  const db = createSupabaseAdminClient();
  const tenantId = request.tenantId;

  // Audit first: no record, no view. actor_id must be a users row, which a
  // platform operator may not have; the email in meta names them either way.
  const { data: actorRow } = await db
    .from("users")
    .select("id")
    .eq("id", admin.id)
    .maybeSingle();
  const { error: auditError } = await db.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_id: actorRow?.id ?? null,
    action: "support_access",
    entity: "support_request",
    entity_id: request.id,
    module: "platform",
    meta_json: {
      summary: `Platform support (${admin.email}) viewed the workspace for ${request.number}`,
      request_number: request.number,
      platform_admin_email: admin.email,
      access_expires_at: request.accessExpiresAt,
    },
  });

  if (auditError) {
    throw new Error(
      `[platform] support view not audited: ${auditError.message}`,
    );
  }

  const [
    tenantRes,
    subscriptionRes,
    ticketsRes,
    teamRes,
    customersRes,
    slaRes,
    hoursRes,
    ...countRes
  ] = await Promise.all([
    db
      .from("tenants")
      .select(
        "name, slug, status, created_at, blocked_at, block_reason, plan:plans!tenants_plan_id_fkey ( name )",
      )
      .eq("id", tenantId)
      .maybeSingle<{
        name: string;
        slug: string;
        status: string;
        created_at: string;
        blocked_at: string | null;
        block_reason: string | null;
        plan: { name: string } | null;
      }>(),
    db
      .from("subscriptions")
      .select("status, seats, current_period_end, payment_failure_count")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("tickets")
      .select(
        "number, subject, status, priority, updated_at, assignee:users!tickets_assignee_user_id_fkey ( full_name, email ), requester:customers!tickets_requester_customer_id_fkey ( full_name, email )",
      )
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(25)
      .returns<
        Array<{
          number: number;
          subject: string;
          status: string;
          priority: string;
          updated_at: string;
          assignee: { full_name: string | null; email: string | null } | null;
          requester: { full_name: string | null; email: string | null } | null;
        }>
      >(),
    db
      .from("memberships")
      .select(
        "status, is_primary, role_def:roles!memberships_role_id_fkey ( name ), user:users!memberships_user_id_fkey ( full_name, email )",
      )
      .eq("tenant_id", tenantId)
      .neq("role", "customer")
      .order("created_at")
      .returns<
        Array<{
          status: string;
          is_primary: boolean;
          role_def: { name: string } | null;
          user: { full_name: string | null; email: string | null } | null;
        }>
      >(),
    db
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    db
      .from("sla_policies")
      .select("name, status, is_default, applies_to")
      .eq("tenant_id", tenantId)
      .order("name"),
    db
      .from("business_hours")
      .select("name, timezone:timezones ( code )")
      .eq("tenant_id", tenantId)
      .returns<Array<{ name: string; timezone: { code: string } | null }>>(),
    ...TICKET_STATUSES.map((status) =>
      db
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", status),
    ),
  ]);

  const failed = [
    tenantRes,
    subscriptionRes,
    ticketsRes,
    teamRes,
    customersRes,
    slaRes,
    hoursRes,
    ...countRes,
  ].find((res) => res.error);

  if (failed?.error) {
    throw new Error(
      `[platform] workspace view failed: ${failed.error.message}`,
    );
  }

  const tenant = tenantRes.data;
  const tenants = await tenantsById([tenantId]);

  return {
    request: withTenant(request, tenants),
    tenant: {
      name: tenant?.name ?? "Deleted workspace",
      slug: tenant?.slug ?? "",
      status: tenant?.status ?? "—",
      planName: tenant?.plan?.name ?? "—",
      createdAt: tenant?.created_at ?? "",
      blockedAt: tenant?.blocked_at ?? null,
      blockReason: tenant?.block_reason ?? null,
    },
    subscription: subscriptionRes.data
      ? {
          status: subscriptionRes.data.status,
          seats: subscriptionRes.data.seats,
          periodEnd: subscriptionRes.data.current_period_end,
          paymentFailures: subscriptionRes.data.payment_failure_count,
        }
      : null,
    ticketCounts: Object.fromEntries(
      TICKET_STATUSES.map((status, index) => [
        status,
        countRes[index]?.count ?? 0,
      ]),
    ),
    tickets: (ticketsRes.data ?? []).map((t) => ({
      number: t.number,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      assignee: t.assignee?.full_name || t.assignee?.email || "Unassigned",
      requester: t.requester?.full_name || t.requester?.email || "—",
      updatedAt: t.updated_at,
    })),
    team: (teamRes.data ?? []).map((m) => ({
      name: m.user?.full_name || m.user?.email || "—",
      email: m.user?.email ?? "",
      role: m.role_def?.name ?? "—",
      status: m.status,
      isOwner: m.is_primary,
    })),
    customers: customersRes.count ?? 0,
    slaPolicies: (slaRes.data ?? []).map((p) => ({
      name: p.name,
      status: p.status,
      isDefault: p.is_default,
      appliesTo: p.applies_to,
    })),
    businessHours: (hoursRes.data ?? []).map((h) => ({
      name: h.name,
      timezone: h.timezone?.code ?? "—",
    })),
  };
}
