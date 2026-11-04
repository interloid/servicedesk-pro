"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

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
  PLATFORM_SEARCH,
  PLATFORM_TOOLBAR,
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
    <div className={PLATFORM_TOOLBAR}>
      <form
        className={PLATFORM_SEARCH}
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
        value={filters.source}
        onChange={(value) => go({ source: value as LogSourceKey })}
        options={Object.entries(LOG_SOURCES).map(([value, source]) => ({
          value,
          label: source.label,
        }))}
      />

      <FilterSelect
        label="Time range"
        value={filters.range}
        onChange={(value) => go({ range: value as LogRangeKey })}
        options={Object.entries(LOG_RANGES).map(([value, range]) => ({
          value,
          label: range.label,
        }))}
      />

      <div className="flex h-10 items-center gap-2 sm:col-span-2 xl:px-2">
        <Switch
          id="errors-only"
          checked={filters.errorsOnly}
          onCheckedChange={(checked) => go({ errorsOnly: checked })}
        />
        <Label htmlFor="errors-only" className="text-sm font-medium">
          Errors only
        </Label>
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
        <p className="flex-1 px-5 py-12 text-center text-sm text-muted-foreground">
          No log entries match these filters.
        </p>
      ) : (
        <ul
          // The rows scroll here, with the bar hidden, so the page itself stays
          // still. Focusable so the keyboard can scroll it too.
          tabIndex={0}
          aria-label="Log entries"
          className="min-h-0 flex-1 divide-y divide-muted overflow-auto xl:scrollbar-none"
        >
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
                    className="flex w-full min-w-3xl items-start gap-x-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <ChevronRight
                      className={cn(
                        "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-90",
                      )}
                      aria-hidden
                    />
                    <span className="w-32 shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatDateTime(entry.timestamp)}
                    </span>
                    <span className="w-20 shrink-0">
                      <ToneBadge tone={LEVELS[entry.level].tone}>
                        {LEVELS[entry.level].label}
                      </ToneBadge>
                    </span>
                    <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                      {SOURCE_LABELS[entry.source] ?? entry.source}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 font-mono text-xs text-foreground",
                        open ? "break-words whitespace-pre-wrap" : "truncate",
                      )}
                    >
                      {entry.message || "(no message)"}
                    </span>
                  </button>

                  {open && (
                    <dl className="grid min-w-3xl grid-cols-1 gap-x-4 gap-y-1 border-t border-muted bg-muted/30 px-11 py-3 text-xs sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                      <dt className="text-muted-foreground">source</dt>
                      <dd className="font-mono break-words text-foreground">
                        {entry.source}
                      </dd>
                      {entry.attributes.map((attribute) => (
                        <Fragment key={attribute.key}>
                          <dt className="break-words text-muted-foreground">
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
