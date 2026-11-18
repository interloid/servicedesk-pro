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
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-14 text-center text-sm text-muted-foreground">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden />
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
        "flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5",
        className,
      )}
    >
      {/* Pill tabs, matching the Notification Center's feed filter. */}
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          aria-label="Filter requests"
          role="tablist"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0"
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
                  "h-10 shrink-0 whitespace-nowrap rounded-full border px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  active
                    ? "border-primary! bg-primary/10 font-semibold text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}{" "}
                <span className="tabular-nums">({counts[item.value]})</span>
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
              className="h-10 bg-card pl-9 text-sm"
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
              "mt-4 hidden rounded-lg bg-muted/60 px-3 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground",
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
                    "flex flex-col gap-2 rounded-lg px-3 py-3.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none",
                  )}
                >
                  <span className="flex items-center justify-between gap-2 sm:contents">
                    <span className="w-fit rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary tabular-nums">
                      {request.number}
                    </span>
                    <span className="sm:hidden">
                      <SupportStatusBadge status={request.status} />
                    </span>
                  </span>

                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {request.subject}
                    </span>
                    {request.accessActive && (
                      <Eye
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-label="Support can access your workspace"
                      />
                    )}
                  </span>

                  <span className="text-xs text-muted-foreground sm:text-sm">
                    <span className="sm:hidden">Updated </span>
                    {formatSupportTime(request.updatedAt)}
                  </span>

                  <span className="hidden sm:block">
                    <SupportStatusBadge status={request.status} />
                  </span>

                  <ChevronRight
                    className="hidden size-4 text-muted-foreground sm:block"
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
