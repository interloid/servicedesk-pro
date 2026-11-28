"use server";

import { RegisterInput } from "../schemas/onboarding.schema";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import {
  registerTenant,
  getTimezones,
  checkEmailTenant,
  checkSlugAvailability,
} from "../services/onboarding.service";
import { getPlatformSettings } from "@/features/platform-admin/services/platform-settings.service";
import { userErrorMessage } from "@/lib/user-error";

export async function registerOnboardingAction(payload: RegisterInput) {
  try {
    // Checked here as well as on /setup: the wizard may have been open since
    // before the console closed sign-ups.
    const { settings } = await getPlatformSettings();

    if (settings.maintenanceMode || !settings.allowSignups) {
      return {
        success: false,
        error: settings.maintenanceMode
          ? `${settings.platformName} is down for maintenance. Try again shortly.`
          : `${settings.platformName} isn't accepting new workspaces right now.`,
      };
    }

    // Each sign-up creates an account and a workspace and mails every invitee.
    const { allowed } = await rateLimit(`signup:${await clientKey()}`, {
      limit: 3,
      windowMs: 60 * 60_000,
    });

    if (!allowed) {
      return {
        success: false,
        error: "Too many sign-ups from this network. Try again later.",
      };
    }

    const result = await registerTenant(payload);

    return {
      success: true,
      requiresEmailConfirmation: result.requiresEmailConfirmation,
      data: result.data,
    };
  } catch (error: unknown) {
    console.error("[Onboarding Action Error]:", error);

    return {
      success: false,
      error: userErrorMessage(
        error,
        "An unexpected error occurred during setup.",
      ),
    };
  }
}

export async function getTimezonesAction() {
  try {
    const data = await getTimezones();

    return {
      success: true,
      data,
    };
  } catch (error: unknown) {
    console.error("[Timezone Action Error]:", error);

    return {
      success: false,
      data: [],
      error: userErrorMessage(error, "Failed to load timezones."),
    };
  }
}

export async function checkEmailTenantAction(
  email: string,
): Promise<{ exists: boolean; rateLimited?: boolean }> {
  try {
    const { allowed } = await rateLimit(`check-email:${await clientKey()}`, {
      limit: 20,
      windowMs: 60 * 60_000,
    });

    if (!allowed) {
      return { exists: false, rateLimited: true };
    }

    return await checkEmailTenant(email);
  } catch (error: unknown) {
    console.error("[Email Check Action Error]:", error);

    return {
      exists: false,
    };
  }
}

export async function checkSlugAvailabilityAction(slug: string) {
  try {
    const { allowed } = await rateLimit(`check-slug:${await clientKey()}`, {
      limit: 20,
      windowMs: 60_000,
    });

    if (!allowed) {
      return {
        available: false,
        error: "Too many checks. Wait a moment and try again.",
      };
    }

    return await checkSlugAvailability(slug);
  } catch (error: unknown) {
    console.error("[Slug Check Action Error]:", error);

    return {
      available: false,
      error: userErrorMessage(error, "Failed to check portal address."),
    };
  }
}
