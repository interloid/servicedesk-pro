"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedAdminClient } from "@/lib/supabase/admin";

import { requirePlatformAdmin } from "../services/platform-access";
import {
  extendWorkspaceTrial,
  PlatformTenantError,
  restoreWorkspace,
  softDeleteWorkspace,
} from "../services/platform-tenants.service";
import { TRIAL_EXTENSION_DAYS } from "../types";

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
    // A deleted workspace is restored first, then activated.
    .is("deleted_at", null)
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
      message:
        "That workspace isn't blocked any more, or it's deleted. Restore it first.",
    };
  }

  console.info(`[platform] ${tenantId.data} unblocked by ${admin.email}`);
  revalidatePath("/platform", "layout");

  return { success: true };
}

function failure(error: unknown, fallback: string): Result {
  if (error instanceof PlatformTenantError) {
    return { success: false, message: error.message };
  }

  console.error(`[platform] ${fallback}`, error);
  return { success: false, message: fallback };
}

const deleteSchema = z.object({
  tenantId: z.string().uuid(),
  confirmName: z.string().trim().min(1, "Type the workspace name."),
  reason: z
    .string()
    .trim()
    .min(3, "Enter a reason.")
    .max(300, "Keep the reason under 300 characters."),
});

/** Soft-delete only: no workspace data is ever removed from the console. */
export async function softDeleteWorkspaceAction(
  input: unknown,
): Promise<Result> {
  const admin = await requirePlatformAdmin();
  const parsed = deleteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the form.",
    };
  }

  try {
    await softDeleteWorkspace(admin, parsed.data);
  } catch (error) {
    return failure(error, "Couldn't delete the workspace.");
  }

  console.info(`[platform] ${parsed.data.tenantId} deleted by ${admin.email}`);
  revalidatePath("/platform", "layout");

  return { success: true };
}

export async function restoreWorkspaceAction(input: unknown): Promise<Result> {
  const admin = await requirePlatformAdmin();
  const tenantId = z.string().uuid().safeParse(input);

  if (!tenantId.success) {
    return { success: false, message: "That workspace wasn't found." };
  }

  try {
    await restoreWorkspace(admin, tenantId.data);
  } catch (error) {
    return failure(error, "Couldn't restore the workspace.");
  }

  console.info(`[platform] ${tenantId.data} restored by ${admin.email}`);
  revalidatePath("/platform", "layout");

  return { success: true };
}

const trialSchema = z.object({
  tenantId: z.string().uuid(),
  days: z
    .number()
    .int()
    .refine(
      (days) => (TRIAL_EXTENSION_DAYS as readonly number[]).includes(days),
      "Pick 7, 14 or 30 days.",
    ),
});

export async function extendTrialAction(
  input: unknown,
): Promise<
  { success: true; endsAt: string } | { success: false; message: string }
> {
  const admin = await requirePlatformAdmin();
  const parsed = trialSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Pick how many days.",
    };
  }

  try {
    const { endsAt } = await extendWorkspaceTrial(admin, parsed.data);
    revalidatePath("/platform", "layout");
    return { success: true, endsAt };
  } catch (error) {
    const result = failure(error, "Couldn't extend the trial.");
    return result.success
      ? { success: false, message: "Couldn't extend the trial." }
      : result;
  }
}
