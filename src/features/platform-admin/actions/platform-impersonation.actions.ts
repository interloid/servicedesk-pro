"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePlatformAdmin } from "../services/platform-access";
import {
  ImpersonationError,
  startImpersonation,
} from "../services/platform-impersonation.service";

const inputSchema = z.object({ requestId: z.uuid() });

/**
 * Signs this browser in as the admin who granted access on the request, then
 * opens their workspace. Ended from the banner in the workspace.
 */
export async function startImpersonationAction(
  input: unknown,
): Promise<{ success: false; message: string }> {
  const admin = await requirePlatformAdmin();
  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "That support request wasn't found." };
  }

  let destination: string;

  try {
    destination = await startImpersonation(admin, parsed.data.requestId);
  } catch (error) {
    if (error instanceof ImpersonationError) {
      return { success: false, message: error.message };
    }

    console.error("[platform] impersonation start failed:", error);
    return { success: false, message: "Couldn't sign in as the admin." };
  }

  console.info(
    `[platform] ${admin.email} signed in as the admin on ${parsed.data.requestId}`,
  );

  // Outside the try: redirect() works by throwing.
  redirect(destination);
}
