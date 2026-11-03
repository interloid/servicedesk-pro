import type { Metadata } from "next";

import { PlatformPageHeader } from "@/features/platform-admin/components/platform-ui";
import { HealthDashboard } from "@/features/platform-admin/components/health-dashboard";
import { RefreshButton } from "@/features/platform-admin/components/refresh-button";
import { requirePlatformAdmin } from "@/features/platform-admin/services/platform-access";
import {
  getApiTraffic,
  getDbHealth,
  getInfraMetrics,
  getServiceHealth,
} from "@/features/platform-admin/services/platform-observability.service";

export const metadata: Metadata = {
  title: "System Health",
  description: "Service status, database and API health.",
  robots: { index: false, follow: false },
};

export default async function PlatformHealthPage() {
  // A layout doesn't re-run on client navigation, and this page spends the token.
  await requirePlatformAdmin();

  const [services, infra, db, traffic] = await Promise.all([
    getServiceHealth(),
    getInfraMetrics(),
    getDbHealth(),
    getApiTraffic(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PlatformPageHeader
        title="System Health"
        description="Services, database, API traffic and background jobs."
        action={<RefreshButton />}
      />

      <HealthDashboard
        services={services}
        infra={infra}
        db={db}
        traffic={traffic}
      />
    </div>
  );
}
