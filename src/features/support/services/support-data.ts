import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isSupportAccessActive,
  SUPPORT_STATUSES,
  supportNumber,
  type SupportMessage,
  type SupportRequest,
  type SupportRequestDetail,
  type SupportStatus,
} from "../support";

// Shared by the tenant and platform services, so both sides read a request
// the same way.

export const SUPPORT_REQUEST_SELECT = `
  id,
  number,
  tenant_id,
  subject,
  description,
  status,
  allow_workspace_access,
  access_expires_at,
  resolved_at,
  created_at,
  updated_at,
  creator:users!support_requests_created_by_fkey ( full_name, email ),
  messages:support_request_messages ( count )
` as const;

export type SupportRequestRow = {
  id: string;
  number: number;
  tenant_id: string;
  subject: string;
  description: string;
  status: string;
  allow_workspace_access: boolean;
  access_expires_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  creator: { full_name: string | null; email: string | null } | null;
  messages: Array<{ count: number }> | null;
};

function oneOf<T extends string>(
  values: readonly T[],
  value: string,
  fallback: T,
): T {
  return (values as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function toSupportRequest(
  row: SupportRequestRow,
  now: number,
): SupportRequest {
  const status = oneOf<SupportStatus>(SUPPORT_STATUSES, row.status, "open");
  const base = {
    allowWorkspaceAccess: row.allow_workspace_access,
    accessExpiresAt: row.access_expires_at,
    status,
  };

  return {
    id: row.id,
    number: supportNumber(row.number),
    tenantId: row.tenant_id,
    subject: row.subject,
    description: row.description,
    status,
    createdByName:
      row.creator?.full_name || row.creator?.email || "Former member",
    createdByEmail: row.creator?.email ?? "",
    allowWorkspaceAccess: row.allow_workspace_access,
    accessExpiresAt: row.access_expires_at,
    accessActive: isSupportAccessActive(base, now),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    messageCount: row.messages?.[0]?.count ?? 0,
  };
}

/** One request with its thread, oldest message first. Caller scopes `query`. */
export async function loadSupportMessages(
  admin: SupabaseClient,
  request: SupportRequest,
): Promise<SupportRequestDetail> {
  const { data, error } = await admin
    .from("support_request_messages")
    .select("id, author_type, author_name, body, created_at")
    .eq("request_id", request.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`[support] messages query failed: ${error.message}`);
  }

  const messages: SupportMessage[] = (data ?? []).map((m) => ({
    id: m.id,
    authorType: m.author_type === "platform" ? "platform" : "tenant",
    authorName: m.author_name,
    body: m.body,
    createdAt: m.created_at,
  }));

  return { ...request, messages };
}
