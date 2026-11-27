"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, CircleAlert, ScrollText } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { formatDateTime } from "../format";
import {
  DEFAULT_LOG_PAGE_SIZE,
  LOG_PAGE_SIZES,
  LOG_RANGES,
  LOG_SOURCES,
  type LogEntry,
  type LogLevel,
  type LogRangeKey,
  type LogSourceKey,
} from "../types";
import {
  FilterSelect,
  PLATFORM_CARD,
  PlatformEmpty,
  SearchField,
  TablePaginationFooter,
} from "./platform-ui";
import { ToneBadge, type BadgeTone } from "./status-badge";

const LEVELS: Record<LogLevel, { label: string; tone: BadgeTone }> = {
  error: { label: "Error", tone: "red" },
  warning: { label: "Warning", tone: "amber" },
  info: { label: "Info", tone: "muted" },
};

const SOURCE_LABELS: Record<string, string> = {
  edge_logs: "API gateway",
  postgres_logs: "Postgres",
  postgrest_logs: "PostgREST",
  auth_logs: "Auth",
  auth_audit_logs: "Auth audit",
  function_edge_logs: "Function request",
  function_logs: "Function log",
  storage_logs: "Storage",
  realtime_logs: "Realtime",
  supavisor_logs: "Pooler",
};

export type LogFilters = {
  source: LogSourceKey;
  range: LogRangeKey;
  errorsOnly: boolean;
  q: string;
  page: number;
  pageSize: number;
  at: string | null;
};

function logsHref(filters: LogFilters): string {
  const params = new URLSearchParams();

  if (filters.source !== "all") params.set("source", filters.source);
  if (filters.range !== "1h") params.set("range", filters.range);
  if (filters.errorsOnly) params.set("errors", "1");
  if (filters.q) params.set("q", filters.q);
  if (filters.pageSize !== DEFAULT_LOG_PAGE_SIZE) {
    params.set("pageSize", String(filters.pageSize));
  }

  // Page 1 always means "the latest", so only later pages hold the time.
  if (filters.page > 1) {
    params.set("page", String(filters.page));
    if (filters.at) params.set("at", filters.at);
  }

  const query = params.toString();

  return `/platform/logs${query ? `?${query}` : ""}`;
}

export function LogFiltersBar({ filters }: { filters: LogFilters }) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.q);

  // Any change of filter goes back to the first page.
  function go(patch: Partial<LogFilters>) {
    router.push(logsHref({ ...filters, ...patch, page: 1, at: null }));
  }

  return (
    // One toolbar card: search, source, range and the errors-only toggle,
    // in a single row from xl.
    <div
      className={cn(
        PLATFORM_CARD,
        "grid shrink-0 grid-cols-1 items-center gap-3 p-3 sm:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_11rem_11rem_auto]",
      )}
    >
      <form
        className="sm:col-span-3 xl:col-span-1"
        onSubmit={(event) => {
          event.preventDefault();
          go({ q: search.trim() });
        }}
      >
        <SearchField
          value={search}
          onChange={setSearch}
          label="Search logs"
          maxLength={200}
          placeholder="Search messages and paths, then Enter"
        />
      </form>

      <FilterSelect
        label="Source"
        className="xl:w-full"
        value={filters.source}
        onChange={(value) => go({ source: value as LogSourceKey })}
        options={Object.entries(LOG_SOURCES).map(([value, source]) => ({
          value,
          label: source.label,
        }))}
      />

      <FilterSelect
        label="Time range"
        className="xl:w-full"
        value={filters.range}
        onChange={(value) => go({ range: value as LogRangeKey })}
        options={Object.entries(LOG_RANGES).map(([value, range]) => ({
          value,
          label: range.label,
        }))}
      />

      {/* A bordered chip, so the toggle reads as one of the filters. */}
      <div
        className={cn(
          "flex h-10 items-center justify-between gap-2.5 rounded-lg border px-3 transition-colors",
          filters.errorsOnly
            ? "border-red-200! bg-red-50/60 dark:border-red-900/60! dark:bg-red-950/20"
            : "bg-card",
        )}
      >
        <Label
          htmlFor="errors-only"
          className="flex items-center gap-2 text-sm font-medium whitespace-nowrap"
        >
          <CircleAlert
            className={cn(
              "size-4",
              filters.errorsOnly ? "text-red-600" : "text-slate-400",
            )}
            aria-hidden
          />
          Errors only
        </Label>
        <Switch
          id="errors-only"
          checked={filters.errorsOnly}
          onCheckedChange={(checked) => go({ errorsOnly: checked })}
        />
      </div>
    </div>
  );
}

export function LogsTable({
  entries,
  total,
  filters,
}: {
  entries: LogEntry[];
  total: number;
  filters: LogFilters;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div
      className={cn(
        PLATFORM_CARD,
        "flex min-h-72 flex-1 flex-col overflow-hidden",
      )}
    >
      {entries.length === 0 ? (
        <PlatformEmpty icon={ScrollText} className="flex-1">
          No log entries match these filters.
        </PlatformEmpty>
      ) : (
        <ul
          // The rows scroll here, with the bar hidden, so the page itself stays
          // still. Focusable so the keyboard can scroll it too.
          tabIndex={0}
          aria-label="Log entries"
          className="min-h-0 flex-1 divide-y divide-slate-100! overflow-auto xl:scrollbar-none"
        >
          {/* Column headings, sticky while the rows scroll. Hidden from
              assistive tech so the list still holds only log entries. */}
          <li
            aria-hidden
            className="sticky top-0 z-10 flex min-w-3xl items-center gap-x-3 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase shadow-[inset_0_-1px_0_var(--border)]"
          >
            <span className="size-4 shrink-0" />
            <span className="w-32 shrink-0">Time</span>
            <span className="w-20 shrink-0">Level</span>
            <span className="w-28 shrink-0">Source</span>
            <span className="min-w-0 flex-1">Message</span>
          </li>
          {entries.map((entry, index) => {
            const key = `${entry.id}-${index}`;
            const open = openId === key;

            return (
              <Fragment key={key}>
                <li>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : key)}
                    className="flex w-full min-w-3xl items-start gap-x-3 px-4 py-3 text-left transition-colors outline-none hover:bg-slate-50/80 focus-visible:bg-slate-50 aria-expanded:bg-slate-50/80"
                  >
                    <ChevronRight
                      className={cn(
                        "mt-0.5 size-4 shrink-0 text-slate-400 transition-transform",
                        open && "rotate-90",
                      )}
                      aria-hidden
                    />
                    <span className="w-32 shrink-0 pt-0.5 text-xs whitespace-nowrap text-slate-500 tabular-nums">
                      {formatDateTime(entry.timestamp)}
                    </span>
                    <span className="w-20 shrink-0">
                      <ToneBadge tone={LEVELS[entry.level].tone}>
                        {LEVELS[entry.level].label}
                      </ToneBadge>
                    </span>
                    <span className="w-28 shrink-0 truncate pt-0.5 text-xs text-slate-600">
                      {SOURCE_LABELS[entry.source] ?? entry.source}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 pt-0.5 font-mono text-xs text-foreground",
                        open ? "break-words whitespace-pre-wrap" : "truncate",
                      )}
                    >
                      {entry.message || "(no message)"}
                    </span>
                  </button>

                  {open && (
                    <dl className="grid min-w-3xl grid-cols-1 gap-x-4 gap-y-1 border-t border-border bg-slate-50 px-11 py-3.5 text-xs sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                      <dt className="text-slate-500">source</dt>
                      <dd className="font-mono break-words text-foreground">
                        {entry.source}
                      </dd>
                      {entry.attributes.map((attribute) => (
                        <Fragment key={attribute.key}>
                          <dt className="break-words text-slate-500">
                            {attribute.key}
                          </dt>
                          <dd className="font-mono break-words text-foreground">
                            {attribute.value}
                          </dd>
                        </Fragment>
                      ))}
                    </dl>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ul>
      )}

      <TablePaginationFooter
        page={filters.page}
        pageCount={Math.max(1, Math.ceil(total / filters.pageSize))}
        pageSize={filters.pageSize}
        pageSizes={LOG_PAGE_SIZES}
        total={total}
        noun={{ one: "entry", other: "entries" }}
        hrefFor={(page) => logsHref({ ...filters, page })}
        onPageSizeChange={(pageSize) =>
          router.push(logsHref({ ...filters, pageSize, page: 1, at: null }), {
            scroll: false,
          })
        }
      />
    </div>
  );
}
