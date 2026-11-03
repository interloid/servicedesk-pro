import type { Metadata } from "next";

import { requirePlatformAdmin } from "@/features/platform-admin/services/platform-access";

import { PlatformSettingsForm } from "@/features/platform-admin/components/platform-settings-form";
import { getPlatformSettings } from "@/features/platform-admin/services/platform-settings.service";

export const metadata: Metadata = {
  title: "Platform settings",
  description: "Global platform configuration.",
  robots: { index: false, follow: false },
};

export default async function PlatformSettingsPage() {
  // A layout doesn't re-run on client navigation, and this page reads every tenant.
  await requirePlatformAdmin();

  const { settings, available } = await getPlatformSettings();

  return <PlatformSettingsForm initial={settings} available={available} />;
}
