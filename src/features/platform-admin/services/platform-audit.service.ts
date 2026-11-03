import "server-only";

import {
  AUDIT_ROW_SELECT,
  auditRowsToEvents,
  type AuditRow,
} from "@/features/audit/services/audit.service";
import {
  AUDIT_PAGE_SIZES,
  DEFAULT_AUDIT_PAGE_SIZE,
  isAuditAction,
  isAuditModule,
  isAuditResult,
  type AuditAction,
  type AuditEvent,
  type AuditModule,
  type AuditResult,
} from "@/features/audit/types/audit";
import { ilikeOrValue } from "@/lib/postgrest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { fetchAll } from "./platform-data.service";
import { PLATFORM_AUDIT_RANGES, type PlatformAuditRange } from "../types";

export type PlatformAuditFilters = {
  tenant: string | null;
  module: AuditModule | null;
  action: AuditAction | null;
  result: AuditResult | null;
  q: string;
  range: PlatformAuditRange;
  page: number;
  pageSize: number;
};

export type PlatformAuditEvent = AuditEvent & {
  tenantName: string;
  tenantSlug: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { [key: string]: string | string[] | undefined };

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export function parsePlatformAuditFilters(
  params: Params,
): PlatformAuditFilters {
  const tenant = single(params.tenant);
  const moduleValue = single(params.module);
  const action = single(params.action);
  const result = single(params.result);
  const range = single(params.range);
  const page = Number.parseInt(single(params.page), 10);
  const pageSize = Number.parseInt(single(params.pageSize), 10);

  return {
    tenant: UUID.test(tenant) ? tenant : null,
    module: isAuditModule(moduleValue) ? moduleValue : null,
    action: isAuditAction(action) ? action : null,
    result: isAuditResult(result) ? result : null,
    q: single(params.q).trim().slice(0, 100),
    range:
      range in PLATFORM_AUDIT_RANGES ? (range as PlatformAuditRange) : "7d",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: (AUDIT_PAGE_SIZES as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_AUDIT_PAGE_SIZE,
  };
}

/** Every workspace's audit events, newest first. Service role: admin gate first. */
export async function getPlatformAuditPage(filters: PlatformAuditFilters) {
  const admin = createSupabaseAdminClient();
  const from = new Date(
    Date.now() -
      PLATFORM_AUDIT_RANGES[filters.range].days * 24 * 60 * 60 * 1000,
  ).toISOString();

  let query = admin
    .from("audit_logs")
    .select(`tenant_id, ${AUDIT_ROW_SELECT}`, { count: "exact" })
    .gte("created_at", from)
    .order("created_at", { ascending: false });

  if (filters.tenant) query = query.eq("tenant_id", filters.tenant);
  if (filters.module) query = query.eq("module", filters.module);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.result) query = query.eq("result", filters.result);

  if (filters.q) {
    const value = ilikeOrValue(filters.q);
    const clauses = [
      `meta_json->>summary.ilike.${value}`,
      `meta_json->>target_email.ilike.${value}`,
      `meta_json->>email.ilike.${value}`,
      `entity.ilike.${value}`,
    ];
    const { data: people } = await admin
      .from("users")
      .select("id")
      .or(`full_name.ilike.${value},email.ilike.${value}`)
      .limit(50);

    if (people?.length) {
      clauses.push(`actor_id.in.(${people.map((p) => p.id).join(",")})`);
    }

    query = query.or(clauses.join(","));
  }

  const offset = (filters.page - 1) * filters.pageSize;
  const tenants = await fetchAll<{ id: string; name: string; slug: string }>(
    (from, to) =>
      admin
        .from("tenants")
        .select("id, name, slug")
        .order("name")
        .range(from, to),
  );

  let page = filters.page;
  let events = await query.range(offset, offset + filters.pageSize - 1);

  // PGRST103: past the last row, from an old link or fewer matches than before.
  if (events.error?.code === "PGRST103") {
    page = 1;
    events = await query.range(0, filters.pageSize - 1);
  }

  if (events.error) {
    throw new Error(`[platform] audit query failed: ${events.error.message}`);
  }

  const rows = (events.data ?? []) as unknown as Array<
    AuditRow & { tenant_id: string }
  >;
  const mapped = await auditRowsToEvents(rows);
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const tenantOf = new Map(rows.map((row) => [row.id, row.tenant_id]));
  const total = events.count ?? 0;

  return {
    now: Date.now(),
    events: mapped.map((event): PlatformAuditEvent => {
      const tenant = tenantById.get(tenantOf.get(event.id) ?? "");

      return {
        ...event,
        tenantName: tenant?.name ?? "Deleted workspace",
        tenantSlug: tenant?.slug ?? "",
      };
    }),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
    tenants: tenants.map((t) => ({ id: t.id, name: t.name })),
  };
}
