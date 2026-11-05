import type { Metadata } from "next";

import { PlatformPageHeader } from "@/features/platform-admin/components/platform-ui";
import {
  LogFiltersBar,
  LogsTable,
  type LogFilters,
} from "@/features/platform-admin/components/logs-viewer";
import { ManagementNotice } from "@/features/platform-admin/components/management-notice";
import { RefreshButton } from "@/features/platform-admin/components/refresh-button";
import { requirePlatformAdmin } from "@/features/platform-admin/services/platform-access";
import { getPlatformLogs } from "@/features/platform-admin/services/platform-observability.service";
import {
  DEFAULT_LOG_PAGE_SIZE,
  LOG_PAGE_SIZES,
  LOG_RANGES,
  LOG_SOURCES,
  type LogRangeKey,
  type LogSourceKey,
} from "@/features/platform-admin/types";

export const metadata: Metadata = {
  title: "Application Logs",
  description: "Logs from every Supabase service.",
  robots: { index: false, follow: false },
};

export default async function PlatformLogsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // A layout doesn't re-run on client navigation, and this page spends the token.
  await requirePlatformAdmin();

  const params = await props.searchParams;
  const source = typeof params.source === "string" ? params.source : "";
  const range = typeof params.range === "string" ? params.range : "";

  const page =
    typeof params.page === "string" ? Number.parseInt(params.page, 10) : 1;
  const pageSize =
    typeof params.pageSize === "string"
      ? Number.parseInt(params.pageSize, 10)
      : DEFAULT_LOG_PAGE_SIZE;

  const filters: LogFilters = {
    source: source in LOG_SOURCES ? (source as LogSourceKey) : "all",
    range: range in LOG_RANGES ? (range as LogRangeKey) : "1h",
    errorsOnly: params.errors === "1",
    q: typeof params.q === "string" ? params.q.trim().slice(0, 200) : "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: (LOG_PAGE_SIZES as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_LOG_PAGE_SIZE,
    at: typeof params.at === "string" ? params.at : null,
  };

  const result = await getPlatformLogs(filters);

  return (
    // Exactly the height the shell leaves, so the page has nothing to scroll.
    <div data-no-page-scrollbar className="flex h-full min-h-0 flex-col gap-6">
      <PlatformPageHeader
        title="Application Logs"
        description="API, database, auth, Edge Function and storage logs from Supabase. Times are in UTC. Passwords and tokens are hidden."
        action={<RefreshButton />}
      />

      <LogFiltersBar filters={filters} />

      {result.ok ? (
        <LogsTable
          entries={result.data.entries}
          total={result.data.total}
          filters={{ ...filters, page: result.data.page, at: result.data.at }}
        />
      ) : (
        <ManagementNotice failure={result} />
      )}
    </div>
  );
}
