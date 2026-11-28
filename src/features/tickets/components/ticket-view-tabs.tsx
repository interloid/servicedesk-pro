"use client";

import { use, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { SavedViewTab } from "@/features/saved-view/filters";

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}

function TabButton({ active, onClick, disabled, children }: TabButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        active
          ? "bg-white font-semibold text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200 dark:bg-card dark:ring-border"
          : "text-slate-500 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Stands in when the saved views couldn't be loaded (an error, or a database
 * without the saved-view migrations): the queue with no view, no count.
 */
const FALLBACK_ALL_TAB: SavedViewTab = {
  id: "all",
  name: "All tickets",
  count: 0,
  isAll: true,
};

/** A segmented control, as the platform tables' FilterTabs. */
const TAB_BAR_CLASS =
  "flex h-10 w-fit max-w-full shrink-0 items-center gap-1 overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-slate-100/70 p-1 scrollbar-none dark:bg-muted/50";

/** While the tabs stream in; the table above and below is already live. */
export function TicketViewTabsSkeleton() {
  return (
    <div className={TAB_BAR_CLASS}>
      <Skeleton className="h-8 w-20 rounded-md" />
      <Skeleton className="h-8 w-24 rounded-md" />
      <Skeleton className="h-8 w-28 rounded-md" />
      <Skeleton className="h-8 w-20 rounded-md" />
    </div>
  );
}

/**
 * The viewer's saved views as tabs. `tabs` is the page's unawaited fetch (one
 * count query per view), read here inside a Suspense boundary so the table
 * never waits on it.
 */
export function TicketViewTabs({
  tabs,
  activeViewId,
  onOpen,
  disabled = false,
}: {
  tabs: Promise<SavedViewTab[]>;
  /** ?view=; none is the "All tickets" tab. */
  activeViewId: string | null;
  onOpen: (tab: SavedViewTab) => void;
  /** An empty queue: the tabs show, but there is nothing to switch to. */
  disabled?: boolean;
}) {
  const loaded = use(tabs);
  const fallback = loaded.length === 0;
  const shown = fallback ? [FALLBACK_ALL_TAB] : loaded;

  return (
    <nav aria-label="Ticket views" className={TAB_BAR_CLASS}>
      {shown.map((tab) => {
        const active = activeViewId ? tab.id === activeViewId : tab.isAll;

        return (
          <TabButton
            key={tab.id}
            active={active}
            onClick={() => onOpen(tab)}
            disabled={disabled}
          >
            {tab.name}
            {!fallback && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[11px] tabular-nums",
                  active
                    ? "bg-brand-soft text-brand-ink"
                    : "bg-white/70 text-slate-500 dark:bg-card/60",
                )}
              >
                {tab.count}
              </span>
            )}
          </TabButton>
        );
      })}
    </nav>
  );
}
