import type { Metadata } from "next";

import { AnalyticsDashboard } from "@/features/platform-admin/components/analytics-dashboard";
import { requirePlatformAdmin } from "@/features/platform-admin/services/platform-access";
import { getPlatformAnalytics } from "@/features/platform-admin/services/platform-analytics.service";
import { getPlatformOverview } from "@/features/platform-admin/services/platform-data.service";
import { getPlatformPlans } from "@/features/platform-admin/services/platform-plans.service";
import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
} from "@/features/platform-admin/types";

export const metadata: Metadata = {
  title: "Analytics & Reports",
  description: "Revenue, growth and usage across every workspace.",
  robots: { index: false, follow: false },
};

export default async function PlatformAnalyticsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // A layout doesn't re-run on client navigation, and this page reads every tenant.
  await requirePlatformAdmin();

  const { range: rawRange } = await props.searchParams;
  const range: AnalyticsRange =
    typeof rawRange === "string" && rawRange in ANALYTICS_RANGES
      ? (rawRange as AnalyticsRange)
      : "30d";

  const [overview, plans, analytics] = await Promise.all([
    getPlatformOverview(),
    getPlatformPlans(),
    getPlatformAnalytics(range),
  ]);

  return (
    <AnalyticsDashboard
      overview={overview}
      plans={plans}
      analytics={analytics}
      range={range}
    />
  );
}
