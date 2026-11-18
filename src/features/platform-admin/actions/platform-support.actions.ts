"use server";

import { revalidatePath } from "next/cache";

import {
  supportReplySchema,
  supportRequestIdSchema,
  supportStatusSchema,
} from "@/features/support/schemas";

import { requirePlatformAdmin } from "../services/platform-access";
import {
  getPlatformSupportRequest,
  replyAsPlatform,
  setPlatformSupportStatus,
  type PlatformSupportDetail,
} from "../services/platform-support.service";

type ActionResult = { success: true } | { success: false; message: string };

function revalidate() {
  // The Tenants page's support counts, and the workspace's own Help & Support pages.
  revalidatePath("/", "layout");
}

/** One request with its conversation, for the Tenants page's support dialog. */
export async function getPlatformSupportRequestAction(
  input: unknown,
): Promise<
  | { success: true; request: PlatformSupportDetail }
  | { success: false; message: string }
> {
  await requirePlatformAdmin();
  const parsed = supportRequestIdSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "That support request doesn't exist." };
  }

  try {
    const request = await getPlatformSupportRequest(parsed.data.requestId);

    return request
      ? { success: true, request }
      : { success: false, message: "That support request doesn't exist." };
  } catch (error) {
    console.error("[platform] support read failed:", error);
    return { success: false, message: "Couldn't load the request." };
  }
}

export async function replyPlatformSupportAction(
  input: unknown,
): Promise<ActionResult> {
  const admin = await requirePlatformAdmin();
  const parsed = supportReplySchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "Write a reply first." };
  }

  try {
    await replyAsPlatform(admin, parsed.data.requestId, parsed.data.body);
  } catch (error) {
    console.error("[platform] support reply failed:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Couldn't send the reply.",
    };
  }

  console.info(
    `[platform] support ${parsed.data.requestId} answered by ${admin.email}`,
  );
  revalidate();

  return { success: true };
}

export async function setPlatformSupportStatusAction(
  input: unknown,
): Promise<ActionResult> {
  const admin = await requirePlatformAdmin();
  const parsed = supportStatusSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "That isn't a status." };
  }

  try {
    await setPlatformSupportStatus(
      admin,
      parsed.data.requestId,
      parsed.data.status,
    );
  } catch (error) {
    console.error("[platform] support status failed:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Couldn't update the status.",
    };
  }

  console.info(
    `[platform] support ${parsed.data.requestId} set to ${parsed.data.status} by ${admin.email}`,
  );
  revalidate();

  return { success: true };
}
