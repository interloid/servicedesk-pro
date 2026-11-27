import { Building2 } from "lucide-react";
import type { Metadata } from "next";

import { requirePlatformAdmin } from "@/features/platform-admin/services/platform-access";

import { PlatformPageHeader } from "@/features/platform-admin/components/platform-ui";
import { TenantsTable } from "@/features/platform-admin/components/tenants-table";
import { getPlatformTenants } from "@/features/platform-admin/services/platform-data.service";
import { listPlatformSupportRequests } from "@/features/platform-admin/services/platform-support.service";

export const metadata: Metadata = {
  title: "Tenants",
  description: "Manage every workspace on the platform.",
  robots: { index: false, follow: false },
};

export default async function PlatformTenantsPage() {
  // A layout doesn't re-run on client navigation, and this page reads every tenant.
  await requirePlatformAdmin();

  const [tenants, supportRequests] = await Promise.all([
    getPlatformTenants(),
    listPlatformSupportRequests(),
  ]);

  return (
    // Exactly the height the shell leaves, so only the table's rows scroll.
    <div data-no-page-scrollbar className="flex h-full min-h-0 flex-col gap-6">
      <PlatformPageHeader
        eyebrow="Manage platform"
        icon={Building2}
        title="Tenants"
        description="All workspaces on the platform, with plan, seats, status and support requests."
      />

      <TenantsTable tenants={tenants} supportRequests={supportRequests} />
    </div>
  );
}
