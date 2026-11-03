import type { Metadata } from "next";

import { requirePlatformAdmin } from "@/features/platform-admin/services/platform-access";

import { OverviewDashboard } from "@/features/platform-admin/components/overview-dashboard";
import { getPlatformOverview } from "@/features/platform-admin/services/platform-data.service";

export const metadata: Metadata = {
  title: "Platform overview",
  description: "Platform-wide metrics, revenue, and tenant health.",
  robots: { index: false, follow: false },
};

export default async function PlatformOverviewPage() {
  // A layout doesn't re-run on client navigation, and this page reads every tenant.
  await requirePlatformAdmin();

  const overview = await getPlatformOverview();

  return <OverviewDashboard overview={overview} />;
}
