import "server-only";

import {
  createAuditedAdminClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Platform admin writes to a workspace's metadata, status and trial. The
 * permission rules (migration 20261117140000):
 *   - status: suspend/activate (platform-tenants.actions.ts) and soft-delete
 *     here, never a hard delete;
 *   - subscriptions: a trial with no PayPal agreement may be extended.
 * Every change is written to that workspace's audit log, which is append-only.
 */

type PlatformActor = { id: string; email: string };

export class PlatformTenantError extends Error {}

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  deleted_at: string | null;
};

async function loadTenant(tenantId: string): Promise<TenantRow> {
  const { data, error } = await createSupabaseAdminClient()
    .from("tenants")
    .select("id, name, slug, status, deleted_at")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) {
    throw new Error(`[platform] tenant lookup failed: ${error.message}`);
  }

  if (!data) {
    throw new PlatformTenantError("That workspace wasn't found.");
  }

  return data as TenantRow;
}

/**
 * One row in the workspace's own audit log. actor_id must be a users row,
 * which a platform operator may not have; the email in meta names them.
 */
async function recordPlatformAudit(
  actor: PlatformActor,
  entry: {
    tenantId: string;
    action: "delete" | "update";
    summary: string;
    meta?: Record<string, Json>;
  },
): Promise<void> {
  const db = createSupabaseAdminClient();
  const { data: actorRow } = await db
    .from("users")
    .select("id")
    .eq("id", actor.id)
    .maybeSingle();

  const { error } = await db.from("audit_logs").insert({
    tenant_id: entry.tenantId,
    actor_id: actorRow?.id ?? null,
    action: entry.action,
    entity: "workspace",
    entity_id: entry.tenantId,
    // Done from the platform console: filed under Platform admin.
    module: "platform",
    meta_json: {
      summary: entry.summary,
      platform_admin_email: actor.email,
      ...entry.meta,
    },
  });

  // The change itself has happened; a missing record must still be visible.
  if (error) {
    console.error("[platform] audit entry failed:", error.message, entry);
  }
}

/** Cancels the workspace's PayPal agreement and drops it to Free. */
async function closeWorkspaceBilling(tenant: TenantRow): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: sub, error } = await admin
    .from("subscriptions")
    .select("paypal_subscription_id")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (error) {
    throw new Error(`[platform] subscription lookup failed: ${error.message}`);
  }

  // No agreement, nothing PayPal can charge: a trial or the Free plan.
  if (!sub?.paypal_subscription_id) return;

  const { data, error: invokeError } = await admin.functions.invoke(
    "subscription",
    { body: { action: "platform-close", tenantSlug: tenant.slug } },
  );

  if (invokeError || !data?.success) {
    console.error("[platform] billing close failed:", invokeError ?? data);
    throw new PlatformTenantError(
      "PayPal couldn't cancel this workspace's subscription, so it wasn't deleted. Try again in a moment.",
    );
  }
}

/**
 * Soft-delete: billing stops, the workspace is locked like an admin block and
 * stamped deleted. No row or file is removed, and it can be restored.
 */
export async function softDeleteWorkspace(
  actor: PlatformActor,
  input: { tenantId: string; confirmName: string; reason: string },
): Promise<{ name: string }> {
  const tenant = await loadTenant(input.tenantId);

  if (tenant.deleted_at) {
    throw new PlatformTenantError("That workspace is already deleted.");
  }

  if (input.confirmName.trim() !== tenant.name.trim()) {
    throw new PlatformTenantError(
      "The name you typed doesn't match the workspace name.",
    );
  }

  await closeWorkspaceBilling(tenant);

  const now = new Date().toISOString();
  const client = await createAuditedAdminClient(actor.id);
  const { data, error } = await client
    .from("tenants")
    .update({
      status: "suspended",
      block_source: "admin",
      block_reason: `Deleted: ${input.reason}`,
      blocked_at: now,
      deleted_at: now,
      deleted_by: actor.id,
      delete_reason: input.reason,
    })
    .eq("id", tenant.id)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    throw new Error(`[platform] soft delete failed: ${error.message}`);
  }

  if (!data?.length) {
    throw new PlatformTenantError("That workspace is already deleted.");
  }

  await recordPlatformAudit(actor, {
    tenantId: tenant.id,
    action: "delete",
    summary: `Platform admin (${actor.email}) deleted the workspace`,
    meta: { reason: input.reason, soft_delete: true },
  });

  return { name: tenant.name };
}

/**
 * Restore clears the deletion only. The workspace stays blocked until a
 * platform admin activates it, so nobody is let back in by accident.
 */
export async function restoreWorkspace(
  actor: PlatformActor,
  tenantId: string,
): Promise<{ name: string }> {
  const tenant = await loadTenant(tenantId);
  const client = await createAuditedAdminClient(actor.id);
  const { data, error } = await client
    .from("tenants")
    .update({
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      block_reason: "Restored after deletion. Activate it to reopen.",
    })
    .eq("id", tenant.id)
    .not("deleted_at", "is", null)
    .select("id");

  if (error) {
    throw new Error(`[platform] restore failed: ${error.message}`);
  }

  if (!data?.length) {
    throw new PlatformTenantError("That workspace isn't deleted.");
  }

  await recordPlatformAudit(actor, {
    tenantId: tenant.id,
    action: "update",
    summary: `Platform admin (${actor.email}) restored the deleted workspace; it stays blocked until activated`,
  });

  return { name: tenant.name };
}

export async function extendWorkspaceTrial(
  actor: PlatformActor,
  input: { tenantId: string; days: number },
): Promise<{ name: string; endsAt: string }> {
  const tenant = await loadTenant(input.tenantId);
  const client = await createAuditedAdminClient(actor.id);
  const { data, error } = await client.rpc("platform_extend_trial", {
    p_tenant_id: tenant.id,
    p_days: input.days,
  });

  if (error) {
    if (error.code === "P0002" || error.code === "22023") {
      throw new PlatformTenantError(error.message);
    }

    throw new Error(`[platform] trial extension failed: ${error.message}`);
  }

  const endsAt = String(data);

  await recordPlatformAudit(actor, {
    tenantId: tenant.id,
    action: "update",
    summary: `Platform admin (${actor.email}) extended the trial by ${input.days} day${input.days === 1 ? "" : "s"}`,
    meta: { days: input.days, trial_ends_at: endsAt },
  });

  return { name: tenant.name, endsAt };
}
