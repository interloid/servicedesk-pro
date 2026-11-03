import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Loading states for the platform console. Each mirrors its page's layout --
// same grid, card padding and row heights -- so nothing jumps when the data
// streams in.

function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {action && <Skeleton className="h-10 w-36 rounded-lg" />}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="rounded-xl border-border bg-card p-5 ring-0 shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-7 w-16" />
        </div>
        <Skeleton className="size-9 shrink-0 rounded-lg" />
      </div>
      <Skeleton className="mt-3 h-3 w-24" />
    </Card>
  );
}

function ChartCardSkeleton({
  className,
  chartClassName,
}: {
  className?: string;
  chartClassName: string;
}) {
  return (
    <Card
      className={cn(
        "rounded-xl border-border bg-card p-5 ring-0 shadow-none",
        className,
      )}
    >
      <div className="mb-4 flex flex-col gap-1.5">
        <Skeleton className="h-2.5 w-36" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className={cn("w-full rounded-lg", chartClassName)} />
    </Card>
  );
}

function EntityCellSkeleton({ rounded = "rounded-md" }: { rounded?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Skeleton className={cn("size-9 shrink-0", rounded)} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-44" />
      </div>
    </div>
  );
}

/**
 * A table card: the summary strip, the header row, then `rows` body rows.
 * `columns` lists each non-first column's skeleton width; the last one is
 * right-aligned like the real tables.
 */
function TableCardSkeleton({
  columns,
  rows = 8,
  avatarRounded,
}: {
  columns: string[];
  rows?: number;
  avatarRounded?: string;
}) {
  const gridTemplate = {
    gridTemplateColumns: `minmax(220px, 2fr) repeat(${columns.length}, minmax(90px, 1fr))`,
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-28" />
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div
            className="grid items-center gap-4 border-b border-muted bg-muted/40 px-5 py-3"
            style={gridTemplate}
          >
            <Skeleton className="h-3 w-20" />
            {columns.map((_, index) => (
              <Skeleton
                key={index}
                className={cn(
                  "h-3 w-14",
                  index === columns.length - 1 && "ml-auto",
                )}
              />
            ))}
          </div>

          {Array.from({ length: rows }, (_, row) => (
            <div
              key={row}
              className="grid items-center gap-4 border-b border-muted px-5 py-3.5 last:border-b-0"
              style={gridTemplate}
            >
              <EntityCellSkeleton rounded={avatarRounded} />
              {columns.map((width, index) => (
                <Skeleton
                  key={index}
                  className={cn(
                    "h-4",
                    width,
                    index === columns.length - 1 && "ml-auto",
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterPillsSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-10 w-24 rounded-full" />
      ))}
    </div>
  );
}

export function PlatformOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading platform overview…</span>
      <PageHeaderSkeleton action />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCardSkeleton className="lg:col-span-2" chartClassName="h-60" />

        <Card className="rounded-xl border-border bg-card p-5 ring-0 shadow-none">
          <div className="mb-4 flex flex-col gap-1.5">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
          <div className="flex h-48 items-center justify-center">
            <Skeleton className="size-36 rounded-full" />
          </div>
          <div className="mt-2 space-y-2.5">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCardSkeleton className="lg:col-span-2" chartClassName="h-56" />

        <Card className="rounded-xl border-border bg-card p-5 ring-0 shadow-none">
          <Skeleton className="mb-2 h-2.5 w-32" />
          <div className="flex flex-col divide-y divide-muted">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 py-2.5">
                <Skeleton className="size-8 shrink-0 rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-xl border-border bg-card ring-0 shadow-none">
        <div className="border-b border-border px-5 py-4">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex flex-col divide-y divide-muted">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Skeleton className="size-8 shrink-0 rounded-md" />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="hidden h-4 w-16 sm:block" />
              <Skeleton className="hidden h-4 w-36 md:block" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function PlatformTenantsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading tenants…</span>
      <PageHeaderSkeleton />

      <div className="flex h-full flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-10 w-full max-w-xs" />
          <FilterPillsSkeleton count={6} />
        </div>

        {/* Plan, Seats, MRR, Status, Created */}
        <TableCardSkeleton
          columns={[
            "w-16 rounded-full",
            "w-14",
            "w-14",
            "w-16 rounded-full",
            "w-20",
          ]}
        />
      </div>
    </div>
  );
}

export function PlatformUsersSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading users…</span>
      <PageHeaderSkeleton />

      <div className="flex h-full flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 w-full max-w-xs" />
          <Skeleton className="h-8 w-52" />
          <div className="ml-auto">
            <FilterPillsSkeleton count={4} />
          </div>
        </div>

        {/* Workspace, Role, Status, Last active */}
        <TableCardSkeleton
          avatarRounded="rounded-full"
          columns={["w-28", "w-20", "w-16 rounded-full", "w-14"]}
        />
      </div>
    </div>
  );
}

function SettingsCardSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <Card className="rounded-[14px]">
      <div className="flex flex-col gap-1.5 border-b border-border px-4 py-4 sm:px-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
      <div className="px-5">{children}</div>
    </Card>
  );
}

function ToggleRowSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-3 w-60 max-w-full" />
      </div>
      <Skeleton className="h-[1.15rem] w-8 shrink-0 rounded-full" />
    </div>
  );
}

function ToggleRowsSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-col divide-y divide-muted">
      {Array.from({ length: count }, (_, index) => (
        <ToggleRowSkeleton key={index} />
      ))}
    </div>
  );
}

export function PlatformSettingsSkeleton() {
  return (
    <div
      className="flex w-full max-w-5xl flex-col gap-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading platform settings…</span>
      <PageHeaderSkeleton />

      <SettingsCardSkeleton>
        <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2 sm:gap-6">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </SettingsCardSkeleton>

      <SettingsCardSkeleton>
        <ToggleRowsSkeleton count={1} />
      </SettingsCardSkeleton>

      <SettingsCardSkeleton>
        <ToggleRowsSkeleton count={1} />
      </SettingsCardSkeleton>

      <div className="flex justify-end border-t border-border pt-5">
        <Skeleton className="h-10 w-36" />
      </div>
    </div>
  );
}

/** A filter row and a table card, for the console's list pages. */
export function PlatformListSkeleton({
  label,
  stats = 0,
}: {
  label: string;
  stats?: number;
}) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <PageHeaderSkeleton />

      {stats > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {Array.from({ length: stats }, (_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-10 w-full max-w-xs" />
        <FilterPillsSkeleton count={4} />
      </div>

      <TableCardSkeleton columns={["w-16", "w-20", "w-24", "w-20", "w-16"]} />
    </div>
  );
}

export function PlatformHealthSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading system health…</span>
      <PageHeaderSkeleton action />
      <Skeleton className="h-16 w-full rounded-[14px]" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>

      <Skeleton className="h-72 w-full rounded-[14px]" />
    </div>
  );
}
