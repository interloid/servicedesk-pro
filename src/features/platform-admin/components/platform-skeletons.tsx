import type { ReactNode } from "react";
import { Database, FolderOpen, KeyRound, Network, Zap } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  PLATFORM_CARD,
  PLATFORM_SEARCH,
  PLATFORM_STAT_GRID,
  PLATFORM_TOOLBAR,
  PlatformFilterBar,
} from "./platform-ui";
import { ServicesCheckLoader, type CheckItem } from "./services-check-loader";

// Loading states for the platform console. Each mirrors its page -- same grids,
// breakpoints, card padding and row heights -- so nothing jumps when the data
// arrives. Change a screen's layout, change its skeleton here.

function repeat(count: number, render: (index: number) => ReactNode) {
  return Array.from({ length: count }, (_, index) => render(index));
}

function SkeletonPage({
  label,
  className,
  children,
  noPageScrollbar,
}: {
  label: string;
  className?: string;
  children: ReactNode;
  noPageScrollbar?: boolean;
}) {
  return (
    <div
      className={cn("flex flex-col gap-6", className)}
      aria-busy="true"
      aria-live="polite"
      data-no-page-scrollbar={noPageScrollbar || undefined}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function PageHeaderSkeleton({ action }: { action?: string }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-52 sm:h-10" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      {action && (
        <Skeleton className={cn("h-10 shrink-0 rounded-lg", action)} />
      )}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    // Mirrors StatCard: round icon, then the figure, label and hint.
    <div className={cn(PLATFORM_CARD, "flex items-center gap-4 p-5")}>
      <Skeleton className="size-12 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-4 w-28 max-w-full" />
        <Skeleton className="h-3 w-24 max-w-full" />
      </div>
    </div>
  );
}

function StatGridSkeleton({ count }: { count: number }) {
  return (
    <div className={PLATFORM_STAT_GRID}>
      {repeat(count, (index) => (
        <StatCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Mirrors PlatformPanel: an icon-led header row over a padded body. */
function PanelSkeleton({
  className,
  bodyClassName,
  action,
  children,
}: {
  className?: string;
  bodyClassName?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn(PLATFORM_CARD, "flex flex-col", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-5 w-40 max-w-full" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        </div>
        {action}
      </div>
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </div>
  );
}

function SectionHeadingSkeleton() {
  return <Skeleton className="h-6 w-44" />;
}

function ChartLegendSkeleton() {
  return (
    <div className="flex flex-wrap gap-3">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

function FilterPillsSkeleton({ count }: { count: number }) {
  return (
    // Mirrors FilterTabs: one segmented track.
    <div className="flex h-10 w-fit max-w-full shrink-0 items-center gap-1 overflow-hidden rounded-lg border border-border bg-slate-100/70 p-1">
      {repeat(count, (index) => (
        <Skeleton
          key={index}
          className="h-8 w-20 shrink-0 rounded-md bg-slate-200/70"
        />
      ))}
    </div>
  );
}

const SEARCH_SKELETON = <Skeleton className="h-10 w-full rounded-lg" />;

function ToolbarSkeleton({
  selects,
  children,
}: {
  selects: number;
  children?: ReactNode;
}) {
  return (
    <div className={PLATFORM_TOOLBAR}>
      <div className={PLATFORM_SEARCH}>{SEARCH_SKELETON}</div>
      {repeat(selects, (index) => (
        <Skeleton key={index} className="h-10 w-full rounded-lg xl:w-44" />
      ))}
      {children}
    </div>
  );
}

/** TablePaginationFooter: range on the left, pages and page size on the right. */
function TableFooterSkeleton() {
  return (
    <div className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
      <Skeleton className="h-5 w-44" />
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="flex items-center gap-1.5">
          {repeat(5, (index) => (
            <Skeleton key={index} className="size-9 rounded-lg" />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-10" />
          <Skeleton className="h-10 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

type ColumnSkeleton = {
  /** The cell's skeleton size and shape, such as "h-5 w-16 rounded-full". */
  cell: string;
  right?: boolean;
};

function LeadCellSkeleton({
  avatar,
  lines,
}: {
  avatar?: string;
  lines: 1 | 2;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {avatar && <Skeleton className={cn("size-9 shrink-0", avatar)} />}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-5 w-36 max-w-full" />
        {lines === 2 && <Skeleton className="h-4 w-48 max-w-full" />}
      </div>
    </div>
  );
}

/**
 * DataTable's shape: an optional summary strip and footer around a table that
 * scrolls sideways when the card is narrow, like the real one.
 * `columns` leaves out the first column, which is `avatar` and `leadLines`.
 */
function TableCardSkeleton({
  columns,
  rows = 10,
  avatar,
  leadLines = 2,
  summary = false,
  footer = true,
  fill = false,
}: {
  columns: ColumnSkeleton[];
  rows?: number;
  avatar?: string;
  leadLines?: 1 | 2;
  summary?: boolean;
  footer?: boolean;
  /** For a DataTable with `scrollLabel`: capped at the page, rows clipped inside. */
  fill?: boolean;
}) {
  const gridTemplate = {
    gridTemplateColumns: `minmax(12rem, 2fr) repeat(${columns.length}, minmax(0, 1fr))`,
  };

  return (
    <div
      className={cn(PLATFORM_CARD, "overflow-hidden", fill && "flex flex-col")}
    >
      {summary && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-28" />
        </div>
      )}

      <div
        className={cn(
          "overflow-x-auto scrollbar-none",
          fill && "min-h-60 overflow-y-hidden",
        )}
      >
        <div
          className="grid h-10 min-w-3xl items-center gap-4 bg-slate-50 px-4 shadow-[inset_0_-1px_0_var(--border)]"
          style={gridTemplate}
        >
          <Skeleton className="h-3 w-20" />
          {columns.map((column, index) => (
            <Skeleton
              key={index}
              className={cn("h-3 w-14", column.right && "ml-auto")}
            />
          ))}
        </div>

        {repeat(rows, (row) => (
          <div
            key={row}
            className="grid min-w-3xl items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0"
            style={gridTemplate}
          >
            <LeadCellSkeleton avatar={avatar} lines={leadLines} />
            {columns.map((column, index) => (
              <Skeleton
                key={index}
                className={cn(column.cell, column.right && "ml-auto")}
              />
            ))}
          </div>
        ))}
      </div>

      {footer && <TableFooterSkeleton />}
    </div>
  );
}

const ICON_ACTION: ColumnSkeleton = {
  cell: "size-9 rounded-lg",
  right: true,
};
const TEXT = "h-5 w-16";
const WIDE_TEXT = "h-5 w-24";
const BADGE = "h-6 w-20 rounded-md";

/** Overview-only panel: icon tile + title header, no divider (matches OverviewPanel). */
function OverviewPanelSkeleton({
  className,
  bodyClassName,
  children,
}: {
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(PLATFORM_CARD, "flex flex-col", className)}>
      <div className="flex items-start gap-3 px-5 pt-5">
        <Skeleton className="size-9 shrink-0 rounded-lg" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-40 max-w-full" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
      </div>
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </div>
  );
}

export function PlatformOverviewSkeleton() {
  return (
    <SkeletonPage label="Loading platform overview…">
      <div
        className={cn(
          PLATFORM_CARD,
          "flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6",
        )}
      >
        <div className="flex items-start gap-4">
          <Skeleton className="hidden size-12 shrink-0 rounded-xl sm:block" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-56 max-w-full" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-full rounded-lg sm:w-40" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {repeat(6, (index) => (
          <div
            key={index}
            className={cn(PLATFORM_CARD, "flex items-center gap-4 p-5")}
          >
            <Skeleton className="size-12 shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-4 w-28 max-w-full" />
              <Skeleton className="h-3.5 w-36 max-w-full" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <OverviewPanelSkeleton className="xl:col-span-2" bodyClassName="pt-4">
          <Skeleton className="h-60 w-full rounded-lg" />
        </OverviewPanelSkeleton>

        <OverviewPanelSkeleton bodyClassName="flex flex-col justify-center">
          <div className="flex flex-col items-center gap-6 sm:flex-row xl:flex-col 2xl:flex-row">
            <Skeleton className="size-44 shrink-0 rounded-full" />
            <div className="flex w-full flex-1 flex-col">
              {repeat(3, (index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2.5"
                >
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          </div>
        </OverviewPanelSkeleton>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <OverviewPanelSkeleton className="xl:col-span-2" bodyClassName="pt-4">
          <Skeleton className="h-56 w-full rounded-lg" />
          <Skeleton className="mt-3 h-3.5 w-52" />
        </OverviewPanelSkeleton>

        <OverviewPanelSkeleton bodyClassName="px-5 pt-2 pb-3">
          <div className="flex flex-col">
            {repeat(5, (index) => (
              <div key={index} className="flex items-center gap-3 py-3">
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Skeleton className="h-5 w-28 max-w-full" />
                  <Skeleton className="h-4 w-20 max-w-full" />
                </div>
                <Skeleton className="h-5 w-14" />
              </div>
            ))}
          </div>
        </OverviewPanelSkeleton>
      </div>
    </SkeletonPage>
  );
}

/** Mirrors StatFilterCard: round icon, then the figure and its label. */
function FilterCardsSkeleton({
  count,
  className,
}: {
  count: number;
  className: string;
}) {
  return (
    <div className={cn("grid shrink-0 gap-3", className)}>
      {repeat(count, (index) => (
        <div
          key={index}
          className={cn(PLATFORM_CARD, "flex items-center gap-3 p-4")}
        >
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-6 w-10" />
            <Skeleton className="h-4 w-20 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mirrors the Tenants and Users toolbar: tabs and Clear over search and filters. */
function TabbedToolbarSkeleton({
  tabs,
  filters,
  gridClassName,
}: {
  tabs: number;
  filters: number;
  gridClassName: string;
}) {
  return (
    <div className={cn(PLATFORM_CARD, "flex shrink-0 flex-col")}>
      <div className="flex items-center gap-3 border-b border-border p-3">
        <div className="min-w-0 flex-1">
          <FilterPillsSkeleton count={tabs} />
        </div>
        <Skeleton className="h-9 w-28 shrink-0 rounded-lg" />
      </div>
      <div className={cn("grid grid-cols-1 gap-3 p-3", gridClassName)}>
        {repeat(filters + 1, (index) => (
          <Skeleton key={index} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function PlatformTenantsSkeleton() {
  return (
    <SkeletonPage
      label="Loading tenants…"
      noPageScrollbar
      className="h-full min-h-0"
    >
      <PageHeaderSkeleton />

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <FilterCardsSkeleton
          count={6}
          className="grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
        />
        <TabbedToolbarSkeleton
          tabs={6}
          filters={4}
          gridClassName="sm:grid-cols-2 lg:grid-cols-4 [&>:first-child]:sm:col-span-2 [&>:first-child]:lg:col-span-4"
        />

        <TableCardSkeleton
          summary
          fill
          avatar="rounded-md"
          columns={[
            { cell: BADGE },
            { cell: TEXT },
            { cell: TEXT },
            { cell: BADGE },
            { cell: WIDE_TEXT, right: true },
            { cell: "h-9 w-20 rounded-lg", right: true },
          ]}
        />
      </div>
    </SkeletonPage>
  );
}

export function PlatformUsersSkeleton() {
  return (
    <SkeletonPage
      label="Loading users…"
      noPageScrollbar
      className="h-full min-h-0"
    >
      <PageHeaderSkeleton />

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <FilterCardsSkeleton count={4} className="grid-cols-2 xl:grid-cols-4" />
        <TabbedToolbarSkeleton
          tabs={4}
          filters={1}
          gridClassName="sm:grid-cols-[minmax(0,1fr)_14rem]"
        />

        <TableCardSkeleton
          summary
          fill
          avatar="rounded-full"
          columns={[
            { cell: WIDE_TEXT },
            { cell: WIDE_TEXT },
            { cell: BADGE },
            { cell: TEXT, right: true },
          ]}
        />
      </div>
    </SkeletonPage>
  );
}

export function PlatformBillingSkeleton() {
  return (
    <SkeletonPage
      label="Loading subscriptions…"
      noPageScrollbar
      className="h-full min-h-0"
    >
      <PageHeaderSkeleton />
      <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {repeat(4, (index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {/* Mirrors the toolbar card: status tabs left, search right. */}
        <div
          className={cn(
            PLATFORM_CARD,
            "flex shrink-0 flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between",
          )}
        >
          <FilterPillsSkeleton count={6} />
          <div className="w-full lg:max-w-72">{SEARCH_SKELETON}</div>
        </div>

        <TableCardSkeleton
          summary
          fill
          avatar="rounded-full"
          columns={[
            { cell: BADGE },
            { cell: BADGE },
            { cell: TEXT },
            { cell: WIDE_TEXT },
            { cell: WIDE_TEXT },
            ICON_ACTION,
          ]}
        />
      </div>
    </SkeletonPage>
  );
}

function PlanCardSkeleton() {
  return (
    // Mirrors the plan card: name, description and price; facts; action row.
    <div className={cn(PLATFORM_CARD, "flex flex-col")}>
      <div className="flex flex-col gap-1.5 p-5">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-5 w-48 max-w-full" />
        <Skeleton className="mt-2 h-7 w-32" />
      </div>

      <div className="flex flex-col gap-2 border-t border-border px-5 py-4">
        {repeat(5, (index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-border px-5 py-3">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
    </div>
  );
}

const COMPARISON_GRID =
  "grid grid-cols-[minmax(5.5rem,1fr)_repeat(3,4rem)] @lg:grid-cols-[34%_repeat(3,minmax(0,1fr))]";

function PlanComparisonSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>

      <div className={cn(PLATFORM_CARD, "@container overflow-hidden")}>
        <div className={cn(COMPARISON_GRID, "border-b border-border")}>
          <div className="flex items-end p-3 @3xl:px-4">
            <Skeleton className="h-4 w-16 @3xl:h-6" />
          </div>
          {repeat(3, (plan) => (
            <div
              key={plan}
              className="flex flex-col items-center gap-1 border-l border-border px-1 py-2 @3xl:p-4"
            >
              <Skeleton className="h-4 w-10 @3xl:h-6 @3xl:w-20" />
              <Skeleton className="hidden h-4 w-40 max-w-full @3xl:block" />
            </div>
          ))}
        </div>

        {/* Ten features and the SLA policy limit. */}
        {repeat(11, (row) => (
          <div
            key={row}
            className={cn(
              COMPARISON_GRID,
              "border-b border-border last:border-b-0",
            )}
          >
            <div className="p-3 @3xl:px-4">
              <Skeleton className="h-5 w-40 max-w-full" />
            </div>
            {repeat(3, (plan) => (
              <div
                key={plan}
                className="flex items-center justify-center border-l border-border px-1 py-2"
              >
                <Skeleton className="size-6 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function PlatformPlansSkeleton() {
  return (
    <SkeletonPage label="Loading plans…">
      <PageHeaderSkeleton />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {repeat(3, (index) => (
          <PlanCardSkeleton key={index} />
        ))}
      </div>

      <PlanComparisonSkeleton />
    </SkeletonPage>
  );
}

export function PlatformAnalyticsSkeleton() {
  return (
    <SkeletonPage label="Loading analytics…">
      <PageHeaderSkeleton action="w-full sm:w-44" />
      <StatGridSkeleton count={8} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PanelSkeleton>
          <Skeleton className="h-56 w-full rounded-lg" />
        </PanelSkeleton>
        <PanelSkeleton bodyClassName="flex flex-col gap-3">
          <ChartLegendSkeleton />
          <Skeleton className="h-56 w-full rounded-lg" />
        </PanelSkeleton>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeadingSkeleton />
        {/* Plan, live workspaces, price, MRR. */}
        <TableCardSkeleton
          rows={3}
          leadLines={1}
          columns={[
            { cell: TEXT },
            { cell: TEXT },
            { cell: TEXT, right: true },
          ]}
        />
      </section>
    </SkeletonPage>
  );
}

export function PlatformAuditSkeleton() {
  return (
    <SkeletonPage
      label="Loading audit logs…"
      noPageScrollbar
      className="h-full min-h-0"
    >
      <PageHeaderSkeleton />

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <ToolbarSkeleton selects={5} />

        <TableCardSkeleton
          fill
          columns={[
            { cell: WIDE_TEXT },
            { cell: BADGE },
            { cell: WIDE_TEXT },
            ICON_ACTION,
          ]}
        />
      </div>
    </SkeletonPage>
  );
}

/** What System Health checks, in the order the page shows them. */
const HEALTH_CHECKS: CheckItem[] = [
  { label: "Database & REST API", icon: Database },
  { label: "Auth", icon: KeyRound },
  { label: "Storage", icon: FolderOpen },
];

/** The log sources Application Logs reads from Supabase. */
const LOG_CHECKS: CheckItem[] = [
  { label: "API gateway", icon: Network },
  { label: "Postgres", icon: Database },
  { label: "Auth", icon: KeyRound },
  { label: "Edge Functions", icon: Zap },
  { label: "Storage", icon: FolderOpen },
];

export function PlatformLogsSkeleton() {
  return (
    <SkeletonPage
      label="Loading logs…"
      noPageScrollbar
      className="h-full min-h-0"
    >
      <PageHeaderSkeleton action="w-full sm:w-28" />

      <ToolbarSkeleton selects={2}>
        <div className="flex h-10 items-center gap-2 sm:col-span-2 xl:px-2">
          <Skeleton className="h-[1.15rem] w-8 rounded-full" />
          <Skeleton className="h-5 w-20" />
        </div>
      </ToolbarSkeleton>

      <ServicesCheckLoader
        caption="Fetching logs from Supabase…"
        items={LOG_CHECKS}
      />
    </SkeletonPage>
  );
}

export function PlatformHealthSkeleton() {
  return (
    <SkeletonPage label="Loading system health…" className="min-h-full">
      <PageHeaderSkeleton action="w-full sm:w-28" />
      <ServicesCheckLoader caption="Checking services…" items={HEALTH_CHECKS} />
    </SkeletonPage>
  );
}

function SettingsCardSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className={cn(PLATFORM_CARD, "p-4 sm:p-5")}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Skeleton className="h-6 w-44 max-w-full" />
          <Skeleton className="h-5 w-64 max-w-full" />
        </div>
      </div>
      {children}
    </div>
  );
}

function ToggleRowSkeleton() {
  return (
    <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-5 w-40 max-w-full" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <Skeleton className="h-[1.15rem] w-8 shrink-0 rounded-full" />
    </div>
  );
}

export function PlatformSettingsSkeleton() {
  return (
    <SkeletonPage
      label="Loading platform settings…"
      className="w-full max-w-5xl"
    >
      <PageHeaderSkeleton />

      <SettingsCardSkeleton>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
          {repeat(2, (index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </SettingsCardSkeleton>

      <SettingsCardSkeleton>
        <ToggleRowSkeleton />
        <ToggleRowSkeleton />
      </SettingsCardSkeleton>

      <SettingsCardSkeleton>
        <ToggleRowSkeleton />
      </SettingsCardSkeleton>

      <div className="flex justify-end border-t border-border pt-5">
        <Skeleton className="h-10 w-full rounded-lg sm:w-36" />
      </div>
    </SkeletonPage>
  );
}

export function PlatformRolesSkeleton() {
  return (
    <SkeletonPage label="Loading roles…">
      <PageHeaderSkeleton action="w-full sm:w-32" />
      <StatGridSkeleton count={4} />

      <div className="flex flex-col gap-4">
        <PlatformFilterBar
          tabs={<FilterPillsSkeleton count={4} />}
          search={SEARCH_SKELETON}
        />

        <TableCardSkeleton
          rows={6}
          footer={false}
          columns={[
            { cell: BADGE },
            { cell: WIDE_TEXT },
            { cell: BADGE },
            { cell: TEXT, right: true },
            ICON_ACTION,
          ]}
        />
      </div>
    </SkeletonPage>
  );
}
