import type { Metadata } from "next";

import { PlatformPageHeader } from "@/features/platform-admin/components/platform-ui";
import { PlatformAuditTable } from "@/features/platform-admin/components/platform-audit-table";
import {
  getPlatformAuditPage,
  parsePlatformAuditFilters,
} from "@/features/platform-admin/services/platform-audit.service";
import { requirePlatformAdmin } from "@/features/platform-admin/services/platform-access";

export const metadata: Metadata = {
  title: "Audit Logs",
  description: "Audit events across every workspace.",
  robots: { index: false, follow: false },
};

export default async function PlatformAuditLogsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // A layout doesn't re-run on client navigation, and this page reads every tenant.
  await requirePlatformAdmin();

  const filters = parsePlatformAuditFilters(await props.searchParams);
  const data = await getPlatformAuditPage(filters);

  return (
    // Exactly the height the shell leaves, so only the table's rows scroll.
    <div data-no-page-scrollbar className="flex h-full min-h-0 flex-col gap-6">
      <PlatformPageHeader
        title="Audit Logs"
        description="What happened in every workspace, whatever its plan."
      />

      <PlatformAuditTable {...data} filters={filters} />
    </div>
  );
}
