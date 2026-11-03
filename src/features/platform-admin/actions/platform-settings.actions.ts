"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { requirePlatformAdmin } from "../services/platform-access";
import {
  PLATFORM_SETTINGS_TAG,
  updatePlatformSettings,
} from "../services/platform-settings.service";
import type { PlatformSettings } from "../types";

const settingsSchema = z.object({
  platformName: z
    .string()
    .trim()
    .min(1, "Enter a platform name.")
    .max(80, "Keep the name under 80 characters."),
  supportEmail: z.string().trim().toLowerCase().email("Enter a valid email."),
  allowSignups: z.boolean(),
  maintenanceMode: z.boolean(),
  blockOnPaymentFailure: z.boolean(),
});

export async function savePlatformSettingsAction(input: unknown): Promise<
  | { success: true; settings: PlatformSettings }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    }
> {
  const admin = await requirePlatformAdmin();
  const parsed = settingsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updatePlatformSettings(parsed.data, admin.id);
  } catch (error) {
    console.error("[platform] settings save failed:", error);

    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Couldn't save the settings.",
    };
  }

  // The name and support email show on every page, tenant and public alike.
  updateTag(PLATFORM_SETTINGS_TAG);
  revalidatePath("/", "layout");

  return { success: true, settings: parsed.data };
}
