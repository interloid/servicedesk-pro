"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedAdminClient } from "@/lib/supabase/admin";

import { requirePlatformAdmin } from "../services/platform-access";

type Result = { success: true } | { success: false; message: string };

const MISSING_MIGRATION =
  "Blocking isn't set up on this database yet. Apply migration 20261103140000_tenant_blocking.";

const blockSchema = z.object({
  tenantId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(3, "Enter a reason.")
    .max(300, "Keep the reason under 300 characters."),
});

export async function blockWorkspaceAction(input: unknown): Promise<Result> {
  const admin = await requirePlatformAdmin();
  const parsed = blockSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the reason.",
    };
  }

  const client = await createAuditedAdminClient(admin.id);
  const { data, error } = await client
    .from("tenants")
    .update({
      status: "suspended",
      block_source: "admin",
      block_reason: parsed.data.reason,
      blocked_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.tenantId)
    .eq("status", "active")
    .select("id");

  if (error) {
    console.error("[platform] block failed:", error.message);

    return {
      success: false,
      message:
        error.code === "PGRST204"
          ? MISSING_MIGRATION
          : "Couldn't block the workspace.",
    };
  }

  if (!data?.length) {
    return { success: false, message: "That workspace isn't active any more." };
  }

  console.info(`[platform] ${parsed.data.tenantId} blocked by ${admin.email}`);
  revalidatePath("/platform", "layout");

  return { success: true };
}

export async function unblockWorkspaceAction(input: unknown): Promise<Result> {
  const admin = await requirePlatformAdmin();
  const tenantId = z.string().uuid().safeParse(input);

  if (!tenantId.success) {
    return { success: false, message: "That workspace wasn't found." };
  }

  const client = await createAuditedAdminClient(admin.id);
  const { data, error } = await client
    .from("tenants")
    .update({
      status: "active",
      block_source: null,
      block_reason: null,
      blocked_at: null,
    })
    .eq("id", tenantId.data)
    .eq("status", "suspended")
    .select("id");

  if (error) {
    console.error("[platform] unblock failed:", error.message);

    return {
      success: false,
      message:
        error.code === "PGRST204"
          ? MISSING_MIGRATION
          : "Couldn't unblock the workspace.",
    };
  }

  if (!data?.length) {
    return {
      success: false,
      message: "That workspace isn't blocked any more.",
    };
  }

  console.info(`[platform] ${tenantId.data} unblocked by ${admin.email}`);
  revalidatePath("/platform", "layout");

  return { success: true };
}
