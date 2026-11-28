import { DASHBOARD_CARD } from "@/components/shared/dashboard-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Without this file Next.js has no fallback for the async page beside it, so a
 * click leaves the previous screen up until every query has finished — which
 * reads as a dead link and gets clicked again.
 *
 * The shapes below mirror the real page at every breakpoint (same padding,
 * same column widths, the same fixed-width table that clips on a phone), so the
 * list does not jump when the data lands.
 */

const ROW_COUNT = 4;

/** Varied widths stop the placeholder rows reading as one grey block. */
const NAME_WIDTHS = ["w-36", "w-28", "w-32", "w-24"];
const EMAIL_WIDTHS = ["w-48", "w-44", "w-52", "w-40"];

function Identity({ index }: { index: number }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <Skeleton className={`h-4 ${NAME_WIDTHS[index]}`} />
        <Skeleton className={`h-3 ${EMAIL_WIDTHS[index]}`} />
      </div>
    </div>
  );
}

function StatusBlock() {
  return (
    <div className="flex flex-col items-start gap-1">
      <Skeleton className="h-6 w-16 rounded-md" />
      {/* The real line is a clock icon plus the detail, so the icon is drawn
          rather than left as part of the bar. */}
      <div className="flex items-start gap-1">
        <Skeleton className="mt-0.5 size-3 shrink-0 rounded-full bg-slate-200/80" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

function RoleBlock() {
  return <Skeleton className="h-10 w-full max-w-52.5 rounded-lg" />;
}

export default function Loading() {
  return (
    <div className="h-full overflow-y-auto p-4 font-sans text-slate-900 sm:p-6 lg:p-8 dark:text-foreground">
      <div className="mx-auto flex w-full flex-col gap-6">
        {/* Page header: eyebrow, title, description, then the two actions. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-52 sm:h-10" />
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto *:flex-1 sm:*:flex-none">
            <Skeleton className="h-10 w-40 rounded-lg" />
            <Skeleton className="h-10 w-36 rounded-lg" />
          </div>
        </div>

        {/* Seat usage card */}
        <div className={cn(DASHBOARD_CARD, "flex flex-col gap-4 p-5")}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <Skeleton className="h-6 w-14 shrink-0 rounded-md" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:flex sm:flex-wrap sm:gap-x-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-2">
                <Skeleton className="size-2.5 shrink-0 rounded-full" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-4" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Toolbar card */}
          <div className={cn(DASHBOARD_CARD, "p-3")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:items-center">
              <div className="relative sm:col-span-2 lg:max-w-80 lg:flex-1">
                <Skeleton className="absolute top-1/2 left-3 size-4 -translate-y-1/2 rounded" />
                <div className="h-10 w-full rounded-lg border bg-card" />
              </div>
              <div className="h-10 w-full rounded-lg border bg-card lg:w-40" />
              <div className="h-10 w-full rounded-lg border bg-card lg:w-44" />
              <Skeleton className="h-10 w-32 rounded-lg lg:ml-auto" />
            </div>
          </div>

          <div className={cn(DASHBOARD_CARD, "overflow-hidden")}>
            <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>

            <div className="overflow-hidden">
              {/* min-w-262 is the real table's, so the frame is the same width
                  before and after the data lands. */}
              <div className="flex h-10 min-w-262 items-center gap-4 border-b border-border bg-slate-50/80 px-4 dark:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="w-62 shrink-0">
                  <Skeleton className="h-3 w-12" />
                </div>
                <div className="w-64 shrink-0">
                  <Skeleton className="h-3 w-10" />
                </div>
                <div className="w-36 shrink-0">
                  <Skeleton className="h-3 w-14" />
                </div>
                <div className="flex w-36 shrink-0 justify-center">
                  <Skeleton className="h-3 w-14" />
                </div>
              </div>

              {Array.from({ length: ROW_COUNT }).map((_, index) => (
                <div
                  key={index}
                  className="flex min-w-262 items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <Identity index={index} />
                  </div>
                  <div className="w-62 shrink-0">
                    <StatusBlock />
                  </div>
                  <div className="w-64 shrink-0">
                    <RoleBlock />
                  </div>
                  <div className="w-36 shrink-0">
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <div className="flex w-36 shrink-0 justify-center">
                    <Skeleton className="size-9 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-border bg-slate-50/50 px-4 py-3 sm:flex-row dark:bg-muted/20">
              <Skeleton className="h-5 w-44" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
