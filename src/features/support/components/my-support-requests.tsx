"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Eye, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  formatSupportTime,
  isOpenSupportStatus,
  type SupportRequest,
} from "../support";
import { SupportStatusBadge } from "./support-badges";

type Filter = "open" | "closed" | "all";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Resolved & closed" },
  { value: "all", label: "All" },
];

export function MySupportRequests({
  requests,
  requestHref,
}: {
  requests: SupportRequest[];
  /** Base path; a request lives at `${requestHref}/${id}`. */
  requestHref: string;
}) {
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({
      open: requests.filter((r) => isOpenSupportStatus(r.status)).length,
      closed: requests.filter((r) => !isOpenSupportStatus(r.status)).length,
      all: requests.length,
    }),
    [requests],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    return requests.filter((request) => {
      const open = isOpenSupportStatus(request.status);

      if (filter === "open" && !open) return false;
      if (filter === "closed" && open) return false;

      return (
        !q ||
        request.subject.toLowerCase().includes(q) ||
        request.number.toLowerCase().includes(q)
      );
    });
  }, [requests, filter, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav
          aria-label="Filter requests"
          className="flex gap-2 overflow-x-auto scrollbar-none"
        >
          {FILTERS.map((item) => {
            const active = item.value === filter;

            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(item.value)}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "border-primary! bg-primary/10 font-semibold text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs tabular-nums",
                    active
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {counts[item.value]}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="relative sm:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search subject or SR number"
            aria-label="Search support requests"
            className="h-10 rounded-lg bg-card pl-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-xs">
        {visible.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            {requests.length === 0
              ? "You haven't contacted support yet."
              : "No requests match."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((request) => (
              <li key={request.id}>
                <Link
                  href={`${requestHref}/${request.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                        {request.number}
                      </span>
                      <span className="truncate text-sm font-semibold text-foreground">
                        {request.subject}
                      </span>
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      Updated {formatSupportTime(request.updatedAt)} ·{" "}
                      {request.messageCount} repl
                      {request.messageCount === 1 ? "y" : "ies"}
                    </span>
                  </div>
                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    {request.accessActive && (
                      <span
                        className="flex items-center gap-1 text-xs text-muted-foreground"
                        title="Support can view your workspace"
                      >
                        <Eye className="size-3.5" aria-hidden />
                        Access on
                      </span>
                    )}
                    <SupportStatusBadge status={request.status} />
                  </div>
                  <div className="shrink-0 sm:hidden">
                    <SupportStatusBadge status={request.status} />
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
