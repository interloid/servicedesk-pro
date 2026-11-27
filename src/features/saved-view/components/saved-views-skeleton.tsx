import { Skeleton } from "@/components/ui/skeleton";
import { DASHBOARD_CARD } from "@/components/shared/dashboard-ui";
import { cn } from "@/lib/utils";
import { ROW_GRID } from "./row-grid";

/*
 * Route-level loading state for the saved views page. It mirrors the list —
 * same wrappers, section cards, column grid and row heights — so nothing jumps
 * when the real content streams in. Each bar sits in a box of the text's line
 * height, so a row is exactly as tall as the row that replaces it.
 */

/** Widths for the name and summary lines, varied so rows don't look stamped. */
const NAME_WIDTHS = ["w-28", "w-36", "w-24", "w-32"];
const SUMMARY_WIDTHS = ["w-48", "w-40", "w-56", "w-44"];

/** A bar vertically centred in a box of the given line height. */
function Line({ box, bar }: { box: string; bar: string }) {
  return (
    <div className={cn("flex items-center", box)}>
      <Skeleton className={cn("max-w-full", bar)} />
    </div>
  );
}

function RowSkeleton({ index, hasMenu }: { index: number; hasMenu: boolean }) {
  return (
    <li className={cn(ROW_GRID, "px-3 py-3.5 sm:px-5 sm:py-4")}>
      {/* Drag handle — desktop only, like the real grip. */}
      <div className="hidden size-8 items-center justify-center justify-self-center md:flex">
        <Skeleton className="h-4 w-2.5 rounded-sm" />
      </div>

      {/* Order badge. */}
      <Skeleton className="h-8 w-full rounded-md" />

      {/* Name, summary, and the phone-only count line. */}
      <div className="min-w-0">
        <Line box="h-5" bar={cn("h-3.5", NAME_WIDTHS[index % 4])} />
        <Line box="mt-0.5 h-4" bar={cn("h-3", SUMMARY_WIDTHS[index % 4])} />
        <Line box="mt-1 h-4 md:hidden" bar="h-2.5 w-24" />
      </div>

      {/* Tickets pill. */}
      <div className="hidden md:block">
        <Skeleton className="h-6 w-20 rounded-md" />
      </div>

      {/* Last updated. */}
      <div className="hidden md:block">
        <Line box="h-5" bar="h-3.5 w-20" />
      </div>

      {/* Open + menu. Phones always show the menu; desktop only for views
          the user can manage. */}
      <div className="flex items-center justify-end gap-1.5 sm:gap-2">
        <Skeleton className="h-9 w-13 rounded-lg" />
        <Skeleton
          className={cn("size-9 rounded-lg", !hasMenu && "md:hidden")}
        />
      </div>
    </li>
  );
}

function SectionSkeleton({
  tone,
  titleWidth,
  descriptionWidth,
  rows,
  hasMenu,
}: {
  tone: "teal" | "blue";
  titleWidth: string;
  descriptionWidth: string;
  rows: number;
  hasMenu: boolean;
}) {
  return (
    <section className={cn(DASHBOARD_CARD, "overflow-hidden")}>
      <header className="flex items-center gap-3 px-4 py-4 sm:px-5">
        {/* The round icon keeps its tint so the two sections read apart. */}
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            tone === "teal"
              ? "bg-brand-soft"
              : "bg-violet-50 dark:bg-violet-950/60",
          )}
        >
          <Skeleton
            className={cn(
              "size-4.5 rounded-full",
              tone === "teal" ? "bg-brand-accent/15" : "bg-violet-100",
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Line box="h-6" bar={cn("h-4", titleWidth)} />
          <Line box="h-4" bar={cn("h-3", descriptionWidth)} />
        </div>
      </header>

      <div
        aria-hidden
        className={cn(
          ROW_GRID,
          "hidden h-10 border-y border-border bg-slate-50/80 px-4 sm:px-5 md:grid dark:bg-muted/40",
        )}
      >
        <span />
        <Skeleton className="h-2.5 w-9 justify-self-center" />
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-2.5 w-12 justify-self-end" />
      </div>

      <ul className="divide-y divide-border border-t border-border md:border-t-0">
        {Array.from({ length: rows }, (_, i) => (
          <RowSkeleton key={i} index={i} hasMenu={hasMenu} />
        ))}
      </ul>
    </section>
  );
}

export function SavedViewsSkeleton() {
  return (
    <div
      className="h-full p-4 sm:p-6 lg:p-8"
      aria-busy
      aria-label="Loading saved views"
    >
      <div className="mx-auto flex flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            {/* Eyebrow, the 2rem title and the description line. */}
            <Line box="h-4" bar="h-3 w-24" />
            <Line box="h-9 sm:h-10" bar="h-7 w-44 sm:h-8" />
            <Line box="h-5 sm:h-6" bar="h-3.5 w-72 max-w-full" />
          </div>
          <Skeleton className="h-10 w-full shrink-0 rounded-lg sm:w-30" />
        </header>

        {/* The four built-in views: no menu on desktop. */}
        <SectionSkeleton
          tone="teal"
          titleWidth="w-28"
          descriptionWidth="w-72"
          rows={4}
          hasMenu={false}
        />

        <SectionSkeleton
          tone="blue"
          titleWidth="w-40"
          descriptionWidth="w-80"
          rows={2}
          hasMenu
        />
      </div>
    </div>
  );
}
