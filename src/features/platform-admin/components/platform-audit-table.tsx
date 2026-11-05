"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

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
  PLATFORM_SEARCH,
  PLATFORM_TOOLBAR,
  SearchField,
  TablePaginationFooter,
} from "./platform-ui";
import { BADGE_SIZE } from "./status-badge";

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

  // Any change of filter goes back to the first page.
  const setFilter = (key: string, value: string) =>
    router.push(hrefWith({ [key]: value === ALL ? null : value, page: 1 }));

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1">
      <div className={PLATFORM_TOOLBAR}>
        <form
          className={PLATFORM_SEARCH}
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
        <FilterSelect
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
          label="Date range"
          value={filters.range}
          onChange={(value) => setFilter("range", value)}
          options={Object.entries(PLATFORM_AUDIT_RANGES).map(
            ([value, range]) => ({ value, label: range.label }),
          )}
        />
      </div>

      <DataTable
        rows={events}
        rowKey={(event) => event.id}
        empty="No audit events match these filters."
        scrollLabel="Audit events"
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
              <div className="flex min-w-0 flex-col">
                <span className="font-medium">{event.summary}</span>
                <span className="text-xs text-muted-foreground">
                  {event.tenantName}
                </span>
              </div>
            ),
          },
          {
            key: "who",
            header: "Who",
            cell: (event) => (
              <div className="flex min-w-0 flex-col">
                <span className="truncate">
                  {event.actor?.name ?? "System"}
                </span>
                {event.actor?.email && (
                  <span className="truncate text-xs text-muted-foreground">
                    {event.actor.email}
                  </span>
                )}
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
            header: "Time (UTC)",
            cell: (event) => (
              <span className="text-muted-foreground">
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
            "w-[calc(100%-2rem)] max-w-lg min-w-0 overflow-hidden sm:max-w-lg",
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
