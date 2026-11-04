import Image from "next/image";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  PLATFORM_CARD,
  PLATFORM_SEARCH,
  PLATFORM_STAT_GRID,
  PLATFORM_TOOLBAR,
  PlatformFilterBar,
} from "./platform-ui";

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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-7 w-48 sm:h-8" />
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
    <div className={cn(PLATFORM_CARD, "flex items-center gap-4 p-4 sm:p-5")}>
      <Skeleton className="size-12 shrink-0 rounded-xl" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-4 w-32 max-w-full" />
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

function CardHeadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Skeleton className="h-5 w-40 max-w-full" />
      <Skeleton className="h-4 w-56 max-w-full" />
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
    <div className="flex shrink-0 gap-2 overflow-hidden">
      {repeat(count, (index) => (
        <Skeleton key={index} className="h-10 w-24 shrink-0 rounded-full" />
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
          className="grid h-11 min-w-3xl items-center gap-4 bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] px-4 shadow-[inset_0_-1px_0_var(--border)]"
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
            className="grid min-w-3xl items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
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
const BADGE = "h-6 w-20 rounded-full";

export function PlatformOverviewSkeleton() {
  return (
    <SkeletonPage label="Loading platform overview…">
      <PageHeaderSkeleton action="w-full sm:w-40" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {repeat(6, (index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className={cn(PLATFORM_CARD, "p-4 sm:p-5 xl:col-span-2")}>
          <CardHeadingSkeleton className="mb-4" />
          <Skeleton className="h-60 w-full rounded-lg" />
        </div>

        <div className={cn(PLATFORM_CARD, "p-4 sm:p-5")}>
          <CardHeadingSkeleton className="mb-4" />
          <div className="flex h-48 items-center justify-center">
            <Skeleton className="size-36 rounded-full" />
          </div>
          <div className="mt-2 space-y-2.5">
            {repeat(3, (index) => (
              <div key={index} className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className={cn(PLATFORM_CARD, "p-4 sm:p-5 xl:col-span-2")}>
          <CardHeadingSkeleton className="mb-4" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>

        <div className={cn(PLATFORM_CARD, "p-4 sm:p-5")}>
          <Skeleton className="mb-2 h-5 w-36" />
          <div className="flex flex-col divide-y divide-muted">
            {repeat(5, (index) => (
              <div key={index} className="flex items-center gap-3 py-2.5">
                <Skeleton className="size-8 shrink-0 rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Skeleton className="h-5 w-28 max-w-full" />
                  <Skeleton className="h-4 w-20 max-w-full" />
                </div>
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonPage>
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
        <PlatformFilterBar
          tabs={<FilterPillsSkeleton count={6} />}
          search={SEARCH_SKELETON}
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
        <PlatformFilterBar
          tabs={<FilterPillsSkeleton count={4} />}
          search={SEARCH_SKELETON}
        >
          {SEARCH_SKELETON}
        </PlatformFilterBar>

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
      <StatGridSkeleton count={4} />

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <PlatformFilterBar
          tabs={<FilterPillsSkeleton count={6} />}
          search={SEARCH_SKELETON}
        />

        <TableCardSkeleton
          summary
          fill
          columns={[
            { cell: TEXT },
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
    <div className={cn(PLATFORM_CARD, "flex flex-col gap-4 p-4 sm:p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-5 w-48 max-w-full" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-10 w-20 shrink-0 rounded-lg" />
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        {repeat(5, (index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
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
        <div className={cn(PLATFORM_CARD, "flex flex-col gap-4 p-4 sm:p-5")}>
          <CardHeadingSkeleton />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
        <div className={cn(PLATFORM_CARD, "flex flex-col gap-4 p-4 sm:p-5")}>
          <CardHeadingSkeleton />
          <ChartLegendSkeleton />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeadingSkeleton />
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

/** For the screens that wait on Supabase's Management API, which can take a while. */
function SupabaseServicesLoader({ caption }: { caption: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 md:min-h-0">
      <Image
        src="/supabase-services-loader-light.gif"
        alt=""
        width={711}
        height={300}
        unoptimized
        loading="eager"
        className="h-auto w-full max-w-2xl"
      />
      <p aria-hidden className="text-sm text-muted-foreground">
        {caption}
      </p>
    </div>
  );
}

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

      <SupabaseServicesLoader caption="Fetching logs from Supabase…" />
    </SkeletonPage>
  );
}

export function PlatformHealthSkeleton() {
  return (
    <SkeletonPage label="Loading system health…" className="min-h-full">
      <PageHeaderSkeleton action="w-full sm:w-28" />
      <SupabaseServicesLoader caption="Checking services…" />
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
