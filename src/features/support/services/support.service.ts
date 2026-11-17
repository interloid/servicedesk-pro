import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { serverNow } from "@/lib/server-now";

import { getActorOrNull } from "@/features/team/services/team.service";

import type { CreateSupportRequestValues } from "../schemas";
import {
  isOpenSupportStatus,
  SUPPORT_ACCESS_HOURS,
  type SupportRequest,
  type SupportRequestDetail,
} from "../support";
import {
  loadSupportMessages,
  SUPPORT_REQUEST_SELECT,
  toSupportRequest,
  type SupportRequestRow,
} from "./support-data";

export class SupportError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "SupportError";
  }
}

/**
 * Help & Support is the Tenant Admin's. The role is read from the live
 * membership row (getActorOrNull), not the JWT claim, so a demoted admin loses
 * it at once. Every query below is then pinned to the actor's tenant.
 */
export async function getSupportActor() {
  const actor = await getActorOrNull();

  return actor?.role === "Tenant Admin" ? actor : null;
}

async function requireSupportActor() {
  const actor = await getSupportActor();

  if (!actor) {
    throw new SupportError("Only a Tenant Admin can contact support.", 403);
  }

  return actor;
}

async function authorName(userId: string): Promise<string> {
  const { data } = await createSupabaseAdminClient()
    .from("users")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  return data?.full_name || data?.email || "Workspace admin";
}

function accessUntil(now: number): string {
  return new Date(now + SUPPORT_ACCESS_HOURS * 60 * 60 * 1000).toISOString();
}

export async function listMySupportRequests(): Promise<SupportRequest[]> {
  const actor = await requireSupportActor();
  const now = await serverNow();
  const { data, error } = await createSupabaseAdminClient()
    .from("support_requests")
    .select(SUPPORT_REQUEST_SELECT)
    .eq("tenant_id", actor.tenantId)
    .order("updated_at", { ascending: false })
    .limit(500)
    .returns<SupportRequestRow[]>();

  if (error) {
    throw new Error(`[support] list failed: ${error.message}`);
  }

  return (data ?? []).map((row) => toSupportRequest(row, now));
}

async function readOwnRequest(requestId: string): Promise<SupportRequest> {
  const actor = await requireSupportActor();
  const now = await serverNow();
  const { data, error } = await createSupabaseAdminClient()
    .from("support_requests")
    .select(SUPPORT_REQUEST_SELECT)
    .eq("id", requestId)
    .eq("tenant_id", actor.tenantId)
    .maybeSingle<SupportRequestRow>();

  if (error) {
    throw new Error(`[support] read failed: ${error.message}`);
  }

  if (!data) {
    throw new SupportError("That support request doesn't exist.", 404);
  }

  return toSupportRequest(data, now);
}

/** null when it isn't this workspace's request. */
export async function getMySupportRequest(
  requestId: string,
): Promise<SupportRequestDetail | null> {
  try {
    const request = await readOwnRequest(requestId);
    return loadSupportMessages(createSupabaseAdminClient(), request);
  } catch (error) {
    if (error instanceof SupportError && error.status === 404) return null;
    throw error;
  }
}

export async function createSupportRequest(
  values: CreateSupportRequestValues,
): Promise<{ id: string; number: string }> {
  const actor = await requireSupportActor();
  const now = await serverNow();
  const { data, error } = await createSupabaseAdminClient()
    .from("support_requests")
    .insert({
      tenant_id: actor.tenantId,
      created_by: actor.userId,
      subject: values.subject,
      description: values.description,
      allow_workspace_access: values.allowWorkspaceAccess,
      access_granted_at: values.allowWorkspaceAccess
        ? new Date(now).toISOString()
        : null,
      access_expires_at: values.allowWorkspaceAccess ? accessUntil(now) : null,
      // The admin support may sign in as while the grant lasts.
      access_granted_by: values.allowWorkspaceAccess ? actor.userId : null,
    })
    .select("id, number")
    .single();

  if (error || !data) {
    throw new Error(`[support] create failed: ${error?.message}`);
  }

  return { id: data.id, number: `SR-${data.number}` };
}

export async function replyAsTenant(
  requestId: string,
  body: string,
): Promise<void> {
  const actor = await requireSupportActor();
  const request = await readOwnRequest(requestId);

  if (request.status === "closed") {
    throw new SupportError(
      "This request is closed. Create a new one if you still need help.",
      409,
    );
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("support_request_messages").insert({
    request_id: request.id,
    author_type: "tenant",
    author_id: actor.userId,
    author_name: await authorName(actor.userId),
    body,
  });

  if (error) {
    throw new Error(`[support] reply failed: ${error.message}`);
  }

  // A reply puts the request back in the support team's queue.
  const { error: statusError } = await admin
    .from("support_requests")
    .update({
      status: request.status === "in_progress" ? "in_progress" : "open",
      resolved_at: null,
    })
    .eq("id", request.id);

  if (statusError) {
    throw new Error(`[support] status update failed: ${statusError.message}`);
  }
}

/** Grants a fresh SUPPORT_ACCESS_HOURS window, or withdraws access at once. */
export async function setWorkspaceAccess(
  requestId: string,
  allow: boolean,
): Promise<void> {
  const actor = await requireSupportActor();
  const request = await readOwnRequest(requestId);

  if (allow && !isOpenSupportStatus(request.status)) {
    throw new SupportError(
      "Access can only be granted on an open request.",
      409,
    );
  }

  const now = await serverNow();
  const { error } = await createSupabaseAdminClient()
    .from("support_requests")
    .update(
      allow
        ? {
            allow_workspace_access: true,
            access_granted_at: new Date(now).toISOString(),
            access_expires_at: accessUntil(now),
            // Support may sign in as this admin, and only this one.
            access_granted_by: actor.userId,
          }
        : { allow_workspace_access: false, access_expires_at: null },
    )
    .eq("id", request.id);

  if (error) {
    throw new Error(`[support] access update failed: ${error.message}`);
  }
}

/** The tenant closes their own request; closing also ends workspace access. */
export async function closeMySupportRequest(requestId: string): Promise<void> {
  const request = await readOwnRequest(requestId);

  if (request.status === "closed") return;

  const { error } = await createSupabaseAdminClient()
    .from("support_requests")
    .update({
      status: "closed",
      allow_workspace_access: false,
      access_expires_at: null,
      resolved_at:
        request.resolvedAt ?? new Date(await serverNow()).toISOString(),
    })
    .eq("id", request.id);

  if (error) {
    throw new Error(`[support] close failed: ${error.message}`);
  }
}
