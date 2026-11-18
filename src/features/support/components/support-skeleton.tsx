import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading shapes for the Help & Support pages. Each one mirrors its page at
 * every breakpoint (same padding, card, pill tabs and row grid), so nothing
 * jumps when the data lands.
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

function ButtonShape({ className }: { className?: string }) {
  return (
    <Skeleton className={cn("h-11 w-full rounded-xl sm:w-56", className)} />
  );
}

/** The MySupportRequests card: pill tabs, column header and request rows. */
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
        "flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 flex gap-2 overflow-hidden px-4 sm:mx-0 sm:px-0">
          {TAB_WIDTHS.map((width, index) => (
            <div
              key={index}
              className={cn(
                "flex h-10 shrink-0 items-center rounded-full border px-5",
                index === 0 ? "border-primary/40 bg-primary/5" : "bg-card",
              )}
            >
              <Skeleton className={cn("h-4", width)} />
            </div>
          ))}
        </div>

        {searchable && (
          <div className="relative sm:w-64">
            <Skeleton className="absolute top-1/2 left-3 size-4 -translate-y-1/2 rounded bg-slate-200/80" />
            <div className="h-10 w-full rounded-md border bg-card" />
          </div>
        )}
      </div>

      <div
        className={cn(
          ROW_GRID,
          "mt-4 hidden rounded-lg bg-muted/60 px-3 py-2.5",
        )}
      >
        <Skeleton className="h-3.5 w-16 bg-slate-200/80" />
        <Skeleton className="h-3.5 w-14 bg-slate-200/80" />
        <Skeleton className="h-3.5 w-14 bg-slate-200/80" />
        <Skeleton className="h-3.5 w-12 bg-slate-200/80" />
        <span />
      </div>

      <ul className="divide-y divide-border">
        {Array.from({ length: rows }, (_, index) => (
          <li
            key={index}
            className={cn(ROW_GRID, "flex flex-col gap-2 px-3 py-3.5")}
          >
            <span className="flex items-center justify-between gap-2 sm:contents">
              <Skeleton className="h-6 w-20 rounded-full bg-primary/10" />
              <Skeleton className="h-6 w-20 rounded-full sm:hidden" />
            </span>
            <Skeleton
              className={cn(
                "h-4 max-w-full",
                SUBJECT_WIDTHS[index % SUBJECT_WIDTHS.length],
              )}
            />
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
            <Skeleton className="hidden size-4 rounded bg-slate-200/80 sm:block" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** /support — icon header, requests card and the Support details panel. */
export function SupportSkeleton() {
  return (
    <PageFrame label="Loading Help & Support">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 shrink-0 rounded-2xl bg-primary/10 sm:size-14" />
          <div className="flex min-w-0 flex-col gap-2">
            <Skeleton className="h-8 w-52 sm:h-9" />
            <Skeleton className="h-4 w-72 max-w-full sm:h-5" />
          </div>
        </div>
        <ButtonShape />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <SupportRequestsCardSkeleton className="min-h-80" />

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="border-b border-border pb-4">
            <Skeleton className="h-6 w-36" />
          </div>
          <ul className="divide-y divide-border">
            {["w-32", "w-36", "w-28"].map((width, index) => (
              <li key={index} className="flex gap-4 py-4 last:pb-0">
                <Skeleton className="size-11 shrink-0 rounded-xl bg-primary/10" />
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

/** /support/requests — back link, heading and the searchable requests card. */
export function SupportRequestsSkeleton() {
  return (
    <PageFrame label="Loading support requests">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-32" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <ButtonShape className="h-10 rounded-lg" />
        </div>
      </div>

      <SupportRequestsCardSkeleton searchable rows={8} />
    </PageFrame>
  );
}

/** /support/requests/[id] — heading, conversation card and details aside. */
export function SupportRequestDetailSkeleton() {
  return (
    <PageFrame label="Loading support request">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-[min(28rem,100%)]" />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs">
          {["w-3/4", "w-2/3", "w-1/2"].map((width, index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
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

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
            <Skeleton className="h-4 w-16" />
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex justify-between gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </div>
    </PageFrame>
  );
}
