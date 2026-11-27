"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Building2, Clock, Eye, RotateCcw } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AuditEventDetails } from "@/features/audit/components/audit-event-details";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_BADGE,
  AUDIT_ACTION_FILTER_LABELS,
  AUDIT_ACTION_LABELS,
  AUDIT_MODULES,
  AUDIT_MODULE_LABELS,
  AUDIT_PAGE_SIZES,
  AUDIT_RESULTS,
  AUDIT_RESULT_LABELS,
  DEFAULT_AUDIT_PAGE_SIZE,
} from "@/features/audit/types/audit";
import { TEAM_DIALOG_CONTENT } from "@/features/team/components/modal-buttons";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

import { formatDateTime } from "../format";
import type {
  PlatformAuditEvent,
  PlatformAuditFilters,
} from "../services/platform-audit.service";
import { PLATFORM_AUDIT_RANGES } from "../types";
import {
  DataTable,
  FilterSelect,
  PLATFORM_ICON_BUTTON,
  PLATFORM_CARD,
  SearchField,
  TablePaginationFooter,
} from "./platform-ui";
import { BADGE_SIZE, ToneBadge } from "./status-badge";

const ALL = "all";

export function PlatformAuditTable({
  events,
  total,
  page,
  pageCount,
  tenants,
  filters,
  now,
}: {
  events: PlatformAuditEvent[];
  total: number;
  page: number;
  pageCount: number;
  tenants: Array<{ id: string; name: string }>;
  filters: PlatformAuditFilters;
  now: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.q);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = events.find((event) => event.id === selectedId);

  function hrefWith(patch: Record<string, string | number | null>): string {
    const params = new URLSearchParams();
    const next = { ...filters, ...patch };

    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") continue;
      if (key === "page" && value === 1) continue;
      if (key === "range" && value === "7d") continue;
      if (key === "pageSize" && value === DEFAULT_AUDIT_PAGE_SIZE) continue;
      params.set(key, String(value));
    }

    const query = params.toString();

    return `/platform/audit-logs${query ? `?${query}` : ""}`;
  }

  const isFiltered =
    filters.q !== "" ||
    Boolean(filters.tenant) ||
    Boolean(filters.module) ||
    Boolean(filters.action) ||
    Boolean(filters.result) ||
    filters.range !== "7d";

  // Any change of filter goes back to the first page.
  const setFilter = (key: string, value: string) =>
    router.push(hrefWith({ [key]: value === ALL ? null : value, page: 1 }));

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1">
      {/* One toolbar: search and Clear on top, the five filters below. */}
      <div className={cn(PLATFORM_CARD, "flex shrink-0 flex-col")}>
        <div className="flex items-center gap-3 border-b border-border p-3">
          <form
            className="min-w-0 flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              router.push(hrefWith({ q: search.trim(), page: 1 }));
            }}
          >
            <SearchField
              value={search}
              onChange={setSearch}
              label="Search audit events"
              placeholder="Search person or event, then Enter"
            />
          </form>
          <Button
            variant="ghost"
            className="h-9 shrink-0 gap-1.5 rounded-lg px-3 font-semibold text-slate-600 hover:text-foreground disabled:opacity-40"
            disabled={!isFiltered}
            onClick={() => {
              setSearch("");
              router.push("/platform/audit-logs");
            }}
          >
            <RotateCcw className="size-4" aria-hidden />
            <span className="hidden sm:inline">Clear filters</span>
            <span className="sm:hidden">Clear</span>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <FilterSelect
            className="xl:w-full"
            label="Workspace"
            value={filters.tenant ?? ALL}
            onChange={(value) => setFilter("tenant", value)}
            options={[
              { value: ALL, label: "All workspaces" },
              ...tenants.map((tenant) => ({
                value: tenant.id,
                label: tenant.name,
              })),
            ]}
          />
          <FilterSelect
            className="xl:w-full"
            label="Module"
            value={filters.module ?? ALL}
            onChange={(value) => setFilter("module", value)}
            options={[
              { value: ALL, label: "All modules" },
              ...AUDIT_MODULES.map((value) => ({
                value,
                label: AUDIT_MODULE_LABELS[value],
              })),
            ]}
          />
          <FilterSelect
            className="xl:w-full"
            label="Action"
            value={filters.action ?? ALL}
            onChange={(value) => setFilter("action", value)}
            options={[
              { value: ALL, label: "All actions" },
              ...AUDIT_ACTIONS.map((value) => ({
                value,
                label: AUDIT_ACTION_FILTER_LABELS[value],
              })),
            ]}
          />
          <FilterSelect
            className="xl:w-full"
            label="Result"
            value={filters.result ?? ALL}
            onChange={(value) => setFilter("result", value)}
            options={[
              { value: ALL, label: "All results" },
              ...AUDIT_RESULTS.map((value) => ({
                value,
                label: AUDIT_RESULT_LABELS[value],
              })),
            ]}
          />
          <FilterSelect
            className="xl:w-full"
            label="Date range"
            value={filters.range}
            onChange={(value) => setFilter("range", value)}
            options={Object.entries(PLATFORM_AUDIT_RANGES).map(
              ([value, range]) => ({ value, label: range.label }),
            )}
          />
        </div>
      </div>

      <DataTable
        rows={events}
        rowKey={(event) => event.id}
        empty="No audit events match these filters."
        scrollLabel="Audit events"
        summary={
          <>
            {total.toLocaleString("en-US")} event{total === 1 ? "" : "s"}
            <span className="text-xs font-normal text-muted-foreground">
              {PLATFORM_AUDIT_RANGES[filters.range].label} · times in UTC
            </span>
          </>
        }
        footer={
          <TablePaginationFooter
            page={page}
            pageCount={pageCount}
            pageSize={filters.pageSize}
            pageSizes={AUDIT_PAGE_SIZES}
            total={total}
            noun={{ one: "event", other: "events" }}
            hrefFor={(next) => hrefWith({ page: next })}
            onPageSizeChange={(pageSize) =>
              router.push(hrefWith({ pageSize, page: 1 }), { scroll: false })
            }
          />
        }
        columns={[
          {
            key: "event",
            header: "Event",
            primary: true,
            wrap: true,
            cell: (event) => (
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className="line-clamp-2 font-medium"
                    title={event.summary}
                  >
                    {event.summary}
                  </span>
                  {event.result === "failure" && (
                    <ToneBadge tone="red">
                      {AUDIT_RESULT_LABELS[event.result]}
                    </ToneBadge>
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
                  <Building2
                    className="size-3.5 shrink-0 text-slate-400"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span className="whitespace-nowrap">{event.tenantName}</span>
                  <span aria-hidden className="text-slate-300">
                    ·
                  </span>
                  <span className="shrink-0">
                    {AUDIT_MODULE_LABELS[event.module]}
                  </span>
                </span>
              </div>
            ),
          },
          {
            key: "who",
            header: "Who",
            cell: (event) => (
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar className="size-8 after:border-transparent">
                  <AvatarFallback className="bg-slate-100 text-[11px] font-bold text-slate-600">
                    {event.actor ? (
                      getInitials(event.actor.name, event.actor.email)
                    ) : (
                      <Bot className="size-4" strokeWidth={1.75} aria-hidden />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">
                    {event.actor?.name ?? "System"}
                  </span>
                  {event.actor?.email && (
                    <span className="truncate text-xs text-slate-500">
                      {event.actor.email}
                    </span>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: "action",
            header: "Action",
            cell: (event) => (
              <Badge
                className={cn(BADGE_SIZE, AUDIT_ACTION_BADGE[event.action])}
              >
                {AUDIT_ACTION_LABELS[event.action]}
              </Badge>
            ),
          },
          {
            key: "time",
            header: "Time",
            cell: (event) => (
              <span className="flex items-center gap-2 whitespace-nowrap text-slate-600 tabular-nums">
                <Clock
                  className="size-4 shrink-0 text-slate-400"
                  strokeWidth={1.75}
                  aria-hidden
                />
                {formatDateTime(event.createdAt)}
              </span>
            ),
          },
          {
            key: "details",
            header: <span className="sr-only">Details</span>,
            align: "right",
            cell: (event) => (
              <Button
                variant="outline"
                size="icon"
                className={PLATFORM_ICON_BUTTON}
                aria-label={`View event: ${event.summary}`}
                onClick={() => setSelectedId(event.id)}
              >
                <Eye className="size-4" aria-hidden />
              </Button>
            ),
          },
        ]}
      />

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <DialogContent
          className={cn(
            "max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-lg",
            TEAM_DIALOG_CONTENT,
          )}
        >
          {selected && (
            <AuditEventDetails event={selected} timeZone="UTC" now={now} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
