import "server-only";

import { unstable_cache } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type { PlatformSettings } from "../types";

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platformName: "ServiceDeskPro",
  supportEmail: "support@servicedeskpro.com",
  allowSignups: true,
  maintenanceMode: false,
  paymentGraceDays: 14,
};

type SettingsRow = {
  platform_name: string;
  support_email: string;
  allow_signups: boolean;
  maintenance_mode: boolean;
  // Absent until migration 20261117150000 is applied.
  payment_grace_days?: number;
};

/**
 * The single platform_settings row. `available` is false while the migration
 * (20261031130000_platform_settings) is not on this project yet -- PGRST205,
 * "no such table" -- and the defaults stand in, so signups stay open and no
 * workspace is locked out by a missing table.
 */
export async function getPlatformSettings(): Promise<{
  settings: PlatformSettings;
  available: boolean;
}> {
  const { data, error } = await createSupabaseAdminClient()
    .from("platform_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle<SettingsRow>();

  if (error) {
    if (error.code !== "PGRST205") {
      console.error(
        "[platform] settings read failed:",
        error.code,
        error.message,
      );
    }

    return { settings: DEFAULT_PLATFORM_SETTINGS, available: false };
  }

  if (!data) {
    return { settings: DEFAULT_PLATFORM_SETTINGS, available: true };
  }

  return {
    settings: {
      platformName: data.platform_name,
      supportEmail: data.support_email,
      allowSignups: data.allow_signups,
      maintenanceMode: data.maintenance_mode,
      paymentGraceDays:
        data.payment_grace_days ?? DEFAULT_PLATFORM_SETTINGS.paymentGraceDays,
    },
    available: true,
  };
}

export const PLATFORM_SETTINGS_TAG = "platform-settings";

const readCachedSettings = unstable_cache(
  async () => (await getPlatformSettings()).settings,
  [PLATFORM_SETTINGS_TAG],
  { tags: [PLATFORM_SETTINGS_TAG], revalidate: 60 },
);

/**
 * For display on every page (name, support email). Enforcement -- the sign-up
 * gate -- reads getPlatformSettings directly so it never acts on a stale value.
 */
export async function getCachedPlatformSettings(): Promise<PlatformSettings> {
  try {
    return await readCachedSettings();
  } catch (error) {
    console.error("[platform] cached settings read failed:", error);

    return DEFAULT_PLATFORM_SETTINGS;
  }
}

export async function updatePlatformSettings(
  settings: PlatformSettings,
  actorId: string,
): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("platform_settings")
    .upsert({
      id: true,
      platform_name: settings.platformName,
      support_email: settings.supportEmail,
      allow_signups: settings.allowSignups,
      maintenance_mode: settings.maintenanceMode,
      payment_grace_days: settings.paymentGraceDays,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(
      error.code === "PGRST204"
        ? "The grace period isn't set up on this database yet. Apply migration 20261117150000_payment_grace_period."
        : error.code === "PGRST205"
          ? "Platform settings aren't set up on this database yet. Apply migration 20261031130000_platform_settings."
          : `Couldn't save platform settings: ${error.message}`,
    );
  }
}
