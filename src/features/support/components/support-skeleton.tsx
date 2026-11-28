import { DASHBOARD_CARD } from "@/components/shared/dashboard-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading shapes for the Help & Support pages. Each one mirrors its page at
 * every breakpoint (same padding, page header, cards, segmented tabs and row
 * grid), so nothing jumps when the data lands.
 */

/** Same grid as MySupportRequests' ROW_GRID. */
const ROW_GRID =
  "sm:grid sm:grid-cols-[6.5rem_minmax(0,1fr)_9.5rem_auto_1rem] md:grid-cols-[7rem_minmax(0,1fr)_11rem_9rem_1rem] sm:items-center sm:gap-4";

/** Varied widths stop the placeholder rows reading as one grey block. */
const SUBJECT_WIDTHS = ["w-64", "w-52", "w-72", "w-48", "w-60", "w-56"];
const TAB_WIDTHS = ["w-12", "w-16", "w-20", "w-16"];

function PageFrame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8"
      aria-busy="true"
      aria-label={label}
    >
      <div className="mx-auto flex w-full flex-col gap-6">{children}</div>
    </div>
  );
}

/** The dashboard page header: eyebrow, title, description, optional action. */
function PageHeaderSkeleton({
  titleWidth = "w-52",
  action = true,
}: {
  titleWidth?: string;
  action?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className={cn("h-9 max-w-full sm:h-10", titleWidth)} />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      {action && (
        <Skeleton className="h-10 w-full shrink-0 rounded-lg sm:w-56" />
      )}
    </div>
  );
}

/** A panel heading: round icon, title and one line. */
function PanelHeadingSkeleton({
  titleWidth = "w-32",
}: {
  titleWidth?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className={cn("h-5", titleWidth)} />
        <Skeleton className="h-3 w-48 max-w-full" />
      </div>
    </div>
  );
}

/** The MySupportRequests card: segmented tabs, column header and rows. */
export function SupportRequestsCardSkeleton({
  searchable = false,
  rows = 5,
  className,
}: {
  searchable?: boolean;
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        DASHBOARD_CARD,
        "flex min-w-0 flex-col overflow-hidden",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-10 w-fit max-w-full items-center gap-1 overflow-hidden rounded-lg border border-border bg-slate-100/70 p-1 dark:bg-muted/50">
          {TAB_WIDTHS.map((width, index) => (
            <div
              key={index}
              className={cn(
                "flex h-8 shrink-0 items-center rounded-md px-3",
                index === 0 && "bg-white ring-1 ring-slate-200 dark:bg-card",
              )}
            >
              <Skeleton className={cn("h-4", width)} />
            </div>
          ))}
        </div>

        {searchable && (
          <div className="relative sm:w-64">
            <Skeleton className="absolute top-1/2 left-3 size-4 -translate-y-1/2 rounded" />
            <div className="h-10 w-full rounded-lg border bg-card" />
          </div>
        )}
      </div>

      <div
        className={cn(
          ROW_GRID,
          "hidden h-10 bg-slate-50/80 px-4 shadow-[inset_0_-1px_0_var(--border)] dark:bg-muted/40",
        )}
      >
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-12" />
        <span />
      </div>

      <ul className="divide-y divide-border">
        {Array.from({ length: rows }, (_, index) => (
          <li
            key={index}
            className={cn(ROW_GRID, "flex flex-col gap-2 px-4 py-3.5")}
          >
            <span className="flex items-center justify-between gap-2 sm:contents">
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-6 w-20 rounded-md sm:hidden" />
            </span>
            <Skeleton
              className={cn(
                "h-4 max-w-full",
                SUBJECT_WIDTHS[index % SUBJECT_WIDTHS.length],
              )}
            />
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="hidden h-6 w-20 rounded-md sm:block" />
            <Skeleton className="hidden size-4 rounded sm:block" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** /support — page header, requests card and the Support details panel. */
export function SupportSkeleton() {
  return (
    <PageFrame label="Loading Help & Support">
      <PageHeaderSkeleton />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <SupportRequestsCardSkeleton className="min-h-80" />

        <div className={cn(DASHBOARD_CARD, "flex flex-col")}>
          <div className="border-b border-border px-5 py-4">
            <PanelHeadingSkeleton titleWidth="w-36" />
          </div>
          <ul className="divide-y divide-border px-5">
            {["w-32", "w-36", "w-28"].map((width, index) => (
              <li key={index} className="flex gap-3.5 py-4">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className={cn("h-4", width)} />
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PageFrame>
  );
}

/** /support/requests — back link, page header and the searchable card. */
export function SupportRequestsSkeleton() {
  return (
    <PageFrame label="Loading support requests">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-32" />
        <PageHeaderSkeleton titleWidth="w-64" />
      </div>

      <SupportRequestsCardSkeleton searchable rows={8} />
    </PageFrame>
  );
}

/** /support/requests/[id] — heading, conversation card and details aside. */
export function SupportRequestDetailSkeleton() {
  return (
    <PageFrame label="Loading support request">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-40" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-[min(28rem,100%)] sm:h-10" />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className={cn(DASHBOARD_CARD, "flex min-w-0 flex-col")}>
          <div className="border-b border-border px-4 py-3.5 sm:px-5">
            <PanelHeadingSkeleton />
          </div>
          <div className="flex flex-col gap-5 p-4 sm:p-5">
            {["w-3/4", "w-2/3", "w-1/2"].map((width, index) => (
              <div key={index} className="flex gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className={cn("h-3.5", width)} />
                </div>
              </div>
            ))}
            <div className="border-t border-border pt-5">
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className={cn(DASHBOARD_CARD, "flex flex-col gap-3 p-4 sm:p-5")}>
            <PanelHeadingSkeleton titleWidth="w-16" />
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex justify-between gap-3 py-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      </div>
    </PageFrame>
  );
}
