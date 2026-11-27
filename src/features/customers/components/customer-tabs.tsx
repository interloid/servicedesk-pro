"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  isCustomerTab,
  type CustomerTab,
} from "@/features/customers/types/customers";
import { cn } from "@/lib/utils";

const TABS: ReadonlyArray<readonly [CustomerTab, string]> = [
  ["overview", "Overview"],
  ["tickets", "Tickets"],
];

/**
 * The tab strip on a customer's profile.
 *
 * It lives in the route's layout, and a layout is not re-rendered when only
 * the search params change -- which is what keeps the header and these tabs
 * on screen while the tab body loads. The active tab is read from the URL here
 * for the same reason: the layout never sees `?tab=`.
 */
export function CustomerTabs({
  baseHref,
  ticketTotal,
}: {
  /** The profile's own path, with no query. */
  baseHref: string;
  /** Shown beside "Tickets" when above zero. */
  ticketTotal: number;
}) {
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab") ?? undefined;
  const current: CustomerTab = isCustomerTab(raw) ? raw : "overview";

  return (
    // The platform's segmented control: one track, the active tab raised in
    // white. Links rather than buttons, so a tab can be shared and bookmarked.
    <nav aria-label="Customer sections" className="max-w-full">
      <ul className="flex h-10 w-fit max-w-full items-center gap-1 overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-slate-100/70 p-1 scrollbar-none">
        {TABS.map(([value, label]) => {
          const active = value === current;

          return (
            <li key={value}>
              <Link
                href={
                  value === "overview" ? baseHref : `${baseHref}?tab=${value}`
                }
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  // text colours restated on hover: globals.css colours every
                  // <a> and its hover with the brand.
                  active
                    ? "bg-white font-semibold text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200 hover:text-foreground dark:bg-card dark:ring-border"
                    : "font-medium text-slate-500 hover:text-foreground",
                )}
              >
                {label}
                {value === "tickets" && ticketTotal > 0 ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-[11px] tabular-nums",
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "bg-white/70 text-slate-500",
                    )}
                  >
                    {ticketTotal}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
