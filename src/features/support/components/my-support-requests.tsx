"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Archive,
  CircleCheck,
  ChevronRight,
  Eye,
  Headset,
  Inbox,
  SearchX,
  Search,
  type LucideIcon,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { DASHBOARD_CARD } from "@/components/shared/dashboard-ui";
import { cn } from "@/lib/utils";

import {
  formatSupportTime,
  isOpenSupportStatus,
  type SupportRequest,
} from "../support";
import { SupportStatusBadge } from "./support-badges";

type Tab = "all" | "open" | "resolved" | "closed";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

function inTab(request: SupportRequest, tab: Tab): boolean {
  if (tab === "all") return true;
  if (tab === "open") return isOpenSupportStatus(request.status);
  return request.status === tab;
}

/** Same shape as the Notification Center's empty state. */
function EmptyState({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-14 text-center text-sm text-slate-500">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-muted">
        <Icon className="size-5" aria-hidden />
      </span>
      {children}
    </div>
  );
}

function emptyMessage(
  tab: Tab,
  hasRequests: boolean,
  query: string,
): { icon: LucideIcon; text: string } {
  if (!hasRequests)
    return {
      icon: Headset,
      text: "You haven't contacted support yet. Requests you create will show up here.",
    };
  if (query) return { icon: SearchX, text: "No requests match your search." };
  if (tab === "open")
    return { icon: Inbox, text: "No open requests. You're all caught up." };
  if (tab === "resolved")
    return { icon: CircleCheck, text: "No resolved requests yet." };
  if (tab === "closed")
    return { icon: Archive, text: "No closed requests yet." };
  return { icon: Inbox, text: "No requests here." };
}

/** Request ID · Subject · Updated · Status; rows stack on phones. */
const ROW_GRID =
  "sm:grid sm:grid-cols-[6.5rem_minmax(0,1fr)_9.5rem_auto_1rem] md:grid-cols-[7rem_minmax(0,1fr)_11rem_9rem_1rem] sm:items-center sm:gap-4";

export function MySupportRequests({
  requests,
  requestHref,
  searchable = false,
  className,
}: {
  requests: SupportRequest[];
  /** Base path; a request lives at `${requestHref}/${id}`. */
  requestHref: string;
  /** Adds a subject / SR-number search box. */
  searchable?: boolean;
  className?: string;
}) {
  const [tab, setTab] = useState<Tab>(() =>
    requests.some((r) => isOpenSupportStatus(r.status)) ? "open" : "all",
  );
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () =>
      Object.fromEntries(
        TABS.map(({ value }) => [
          value,
          requests.filter((r) => inTab(r, value)).length,
        ]),
      ) as Record<Tab, number>,
    [requests],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    return requests.filter(
      (request) =>
        inTab(request, tab) &&
        (!q ||
          request.subject.toLowerCase().includes(q) ||
          request.number.toLowerCase().includes(q)),
    );
  }, [requests, tab, query]);

  const empty = emptyMessage(tab, requests.length > 0, query.trim());

  return (
    <section
      className={cn(
        DASHBOARD_CARD,
        "flex min-w-0 flex-col overflow-hidden",
        className,
      )}
    >
      {/* Segmented tabs, matching the platform tables' filter bar. */}
      <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          aria-label="Filter requests"
          role="tablist"
          className="flex h-10 w-fit max-w-full shrink-0 items-center gap-1 overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-slate-100/70 p-1 scrollbar-none dark:bg-muted/50"
        >
          {TABS.map((item) => {
            const active = item.value === tab;

            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.value)}
                className={cn(
                  "flex h-8 shrink-0 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active
                    ? "bg-white font-semibold text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200 dark:bg-card dark:ring-border"
                    : "text-slate-500 hover:text-foreground",
                )}
              >
                {item.label}{" "}
                <span
                  className={cn(
                    "ml-1 tabular-nums",
                    active ? "text-brand-700" : "text-slate-400",
                  )}
                >
                  ({counts[item.value]})
                </span>
              </button>
            );
          })}
        </div>

        {searchable && (
          <div className="relative sm:w-64">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search subject or SR number"
              aria-label="Search support requests"
              className="h-10 rounded-lg bg-card pl-9 text-sm"
            />
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={empty.icon}>{empty.text}</EmptyState>
      ) : (
        <>
          <div
            className={cn(
              ROW_GRID,
              "hidden h-10 bg-slate-50/80 px-4 text-[11px] font-semibold tracking-[0.06em] text-slate-500 uppercase shadow-[inset_0_-1px_0_var(--border)] dark:bg-muted/40",
            )}
            aria-hidden
          >
            <span>Request ID</span>
            <span>Subject</span>
            <span>Updated</span>
            <span>Status</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {visible.map((request) => (
              <li key={request.id}>
                <Link
                  href={`${requestHref}/${request.id}`}
                  className={cn(
                    ROW_GRID,
                    "flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-slate-50/60 focus-visible:bg-slate-50/60 focus-visible:outline-none dark:hover:bg-muted/30 dark:focus-visible:bg-muted/30",
                  )}
                >
                  <span className="flex items-center justify-between gap-2 sm:contents">
                    <span className="inline-flex h-6 w-fit items-center rounded-md bg-brand-50 px-2 text-xs font-semibold text-brand-700 tabular-nums ring-1 ring-brand-700/15 ring-inset dark:bg-brand-700/20 dark:text-brand-100">
                      {request.number}
                    </span>
                    <span className="sm:hidden">
                      <SupportStatusBadge status={request.status} />
                    </span>
                  </span>

                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {request.subject}
                    </span>
                    {request.accessActive && (
                      <Eye
                        className="size-3.5 shrink-0 text-brand-700"
                        aria-label="Support can access your workspace"
                      />
                    )}
                  </span>

                  <span className="text-xs text-slate-500 tabular-nums sm:text-sm">
                    <span className="sm:hidden">Updated </span>
                    {formatSupportTime(request.updatedAt)}
                  </span>

                  <span className="hidden sm:block">
                    <SupportStatusBadge status={request.status} />
                  </span>

                  <ChevronRight
                    className="hidden size-4 text-slate-400 sm:block"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
