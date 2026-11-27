"use client";

import * as React from "react";
import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  Box,
  CreditCard,
  Download,
  Eye,
  FileText,
  FilterX,
  Inbox,
  LayoutList,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  Timer,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import {
  DASHBOARD_BUTTON,
  DASHBOARD_CARD,
  DASHBOARD_ICON_BUTTON,
  DASHBOARD_STAT_GRID,
  DashboardPageHeader,
  StatCard,
} from "@/components/shared/dashboard-ui";
import { formatRelativeTime, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

import { exportAuditLogAction } from "@/features/audit/audit-actions";
import { AuditDateRangePicker } from "@/features/audit/components/audit-date-range-picker";
import { AuditEventDetails } from "@/features/audit/components/audit-event-details";
import { AUDIT_ACTION_ICONS } from "@/features/audit/components/audit-icons";
import { TEAM_DIALOG_CONTENT } from "@/features/team/components/modal-buttons";
import {
  AUDIT_ACTION_BADGE,
  AUDIT_ACTION_FILTER_LABELS,
  AUDIT_ACTION_LABELS,
  AUDIT_FILTER_ACTIONS,
  AUDIT_MODULE_BADGE,
  AUDIT_MODULE_LABELS,
  AUDIT_MODULES,
  AUDIT_PAGE_SIZES,
  AUDIT_RESULT_BADGE,
  AUDIT_RESULT_LABELS,
  AUDIT_RESULTS,
  AUDIT_TAB_LABELS,
  AUDIT_TAB_MODULES,
  auditFiltersToQuery,
  formatAuditTimestamp,
  type AuditEvent,
  type AuditFilters,
  type AuditModule,
  type AuditPageData,
} from "@/features/audit/types/audit";

const ALL = "all";

/**
 * Header cells stick to the top of the table's own scroll box (see the
 * wrapper around <Table>). The cells carry the background and the bottom rule
 * themselves: a row's background and border don't travel with sticky cells.
 * The colour is the old bg-muted/50 row mixed onto the card, made opaque so
 * rows don't show through while they scroll underneath.
 */
const TH =
  "sticky top-0 z-10 h-10 bg-slate-50 px-4 text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-slate-500 uppercase shadow-[inset_0_-1px_0_var(--border)] dark:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))]";

/** Below lg, page sizes above this scroll inside the table, not the page. */
const SCROLL_TABLE_ABOVE = 10;

const TAB_ICONS: Record<(typeof AUDIT_TAB_MODULES)[number], LucideIcon> = {
  tickets: Ticket,
  users: Users,
  sla: Timer,
  billing: CreditCard,
  platform: ShieldCheck,
};

type Draft = Pick<AuditFilters, "q" | "module" | "action" | "user" | "result">;

function draftOf(filters: AuditFilters): Draft {
  const { q, module, action, user, result } = filters;
  return { q, module, action, user, result };
}

/** An option for a User filter value that isn't one of data.users. */
function missingUserOption(
  user: string | null,
  data: AuditPageData,
): { value: string; label: string }[] {
  if (!user || data.users.some((option) => option.id === user)) {
    return [];
  }

  const label =
    data.events.find((event) => event.actor?.id === user)?.actor?.name ??
    "Unknown user";

  return [{ value: user, label }];
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export function AuditLogView({
  data,
  filters,
  timeZone,
  now,
  today,
  earliest,
}: {
  data: AuditPageData;
  filters: AuditFilters;
  timeZone: string;
  now: number;
  today: string;
  earliest: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [navigating, startNavigation] = useTransition();
  const [exporting, startExport] = useTransition();
  const [draft, setDraft] = React.useState<Draft>(() => draftOf(filters));
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const selected = data.events.find((event) => event.id === selectedId) ?? null;
  // The last opened event stays rendered while the popup fades out, so it
  // doesn't go blank mid-animation.
  const [shown, setShown] = React.useState<AuditEvent | null>(null);
  if (selected && selected !== shown) {
    setShown(selected);
  }
  const pageCount = Math.max(1, Math.ceil(data.total / filters.pageSize));

  const hrefFor = (next: Partial<AuditFilters>) => {
    const query = auditFiltersToQuery({ ...filters, page: 1, ...next });
    return query ? `${pathname}?${query}` : pathname;
  };

  const go = (next: Partial<AuditFilters>) => {
    startNavigation(() => router.push(hrefFor(next), { scroll: false }));
  };

  const apply = () => go({ ...draft, q: draft.q.trim() });

  const cleared: Draft = {
    q: "",
    module: null,
    action: null,
    user: null,
    result: null,
  };
  const clear = () => {
    setDraft(cleared);
    go(cleared);
  };

  const dirty =
    JSON.stringify({ ...draft, q: draft.q.trim() }) !==
    JSON.stringify(draftOf(filters));
  const anyFilter = Object.values(draftOf(filters)).some(Boolean);

  const selectTab = (module: AuditModule | null) => {
    setDraft((current) => ({ ...current, module }));
    go({ ...draftOf(filters), module });
  };

  const runExport = () => {
    startExport(async () => {
      const result = await exportAuditLogAction(auditFiltersToQuery(filters));

      if (!result.ok) {
        toast.error("Couldn't export the audit log", {
          description: result.message,
        });
        return;
      }

      const url = URL.createObjectURL(
        new Blob([result.csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(
        result.truncated
          ? `Exported the newest ${result.count.toLocaleString("en-US")} events`
          : `Exported ${result.count.toLocaleString("en-US")} ${result.count === 1 ? "event" : "events"}`,
        {
          description: result.truncated
            ? "Narrow the filters to export the rest."
            : undefined,
        },
      );
      router.refresh();
    });
  };

  const firstRow =
    data.total === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const lastRow = Math.min(filters.page * filters.pageSize, data.total);

  return (
    <>
      {/* From lg the page is exactly the window's height and never scrolls:
          the header, cards, filters and pagination keep their size and the
          table body shrinks to what is left, scrolling inside it. Below lg
          there is no room for that, so the page scrolls as usual. */}
      <div className="h-full min-w-0 overflow-y-auto p-4 font-sans text-slate-900 sm:p-6 lg:overflow-hidden lg:p-8 dark:text-foreground">
        <div className="mx-auto flex w-full flex-col gap-6 lg:h-full lg:min-h-0">
          {/* Header */}
          <div className="shrink-0">
            <DashboardPageHeader
              eyebrow="Settings"
              icon={FileText}
              title="Audit log"
              description="Track tickets, users, SLAs, billing and platform support activity across your workspace."
              action={
                <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
                  <Badge className="h-6 gap-1 rounded-md border-none bg-brand-50 px-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-700/15 ring-inset dark:bg-brand-700/20 dark:text-brand-100">
                    <ShieldAlert className="size-3" aria-hidden />
                    Business plan
                  </Badge>
                  <AuditDateRangePicker
                    from={filters.from}
                    to={filters.to}
                    today={today}
                    earliest={earliest}
                    disabled={navigating}
                    onChange={(from, to) => go({ from, to })}
                    className="w-full sm:w-auto"
                  />
                  <Button
                    variant="outline"
                    className={cn(
                      DASHBOARD_BUTTON,
                      "flex-1 gap-2 bg-card text-sm hover:bg-slate-50 sm:flex-none dark:hover:bg-muted",
                    )}
                    onClick={runExport}
                    disabled={exporting || data.total === 0}
                  >
                    {exporting ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Download className="size-4" aria-hidden />
                    )}
                    Export
                  </Button>
                </div>
              }
            />
          </div>

          {/* Stats */}
          <div className={cn(DASHBOARD_STAT_GRID, "shrink-0")}>
            <StatCard
              icon={FileText}
              iconClassName="bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100"
              label="Total events"
              value={data.summary.total.toLocaleString("en-US")}
            />
            <StatCard
              icon={Users}
              iconClassName="bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300"
              label="Unique users"
              value={data.summary.users.toLocaleString("en-US")}
            />
            <StatCard
              icon={Box}
              iconClassName="bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300"
              label="Modules tracked"
              value={data.summary.modules.toLocaleString("en-US")}
            />
            <StatCard
              icon={ShieldAlert}
              iconClassName="bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300"
              label="Platform access"
              value={data.summary.security.toLocaleString("en-US")}
            />
          </div>

          {/* Filters, tabs, table */}
          <div
            className={cn(
              DASHBOARD_CARD,
              "flex flex-col overflow-hidden lg:min-h-0",
            )}
          >
            <form
              className="grid grid-cols-1 gap-3 border-b border-border p-3 sm:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-wrap xl:items-center"
              onSubmit={(event) => {
                event.preventDefault();
                apply();
              }}
            >
              <div className="relative sm:col-span-2 lg:col-span-3 xl:w-72 xl:flex-none 2xl:w-80">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={draft.q}
                  onChange={(event) =>
                    setDraft({ ...draft, q: event.target.value })
                  }
                  placeholder="Search by user, action, details…"
                  aria-label="Search audit events"
                  maxLength={100}
                  className="h-10 rounded-lg bg-card pl-9"
                />
              </div>

              <FilterSelect
                label="Module"
                value={draft.module}
                allLabel="All modules"
                options={AUDIT_MODULES.map((value) => ({
                  value,
                  label: AUDIT_MODULE_LABELS[value],
                }))}
                onChange={(module) =>
                  setDraft({ ...draft, module: module as AuditModule | null })
                }
              />
              <FilterSelect
                label="Action"
                value={draft.action}
                allLabel="All actions"
                options={AUDIT_FILTER_ACTIONS.map((value) => ({
                  value,
                  label: AUDIT_ACTION_FILTER_LABELS[value],
                }))}
                onChange={(action) =>
                  setDraft({ ...draft, action: action as Draft["action"] })
                }
              />
              <FilterSelect
                label="User"
                value={draft.user}
                allLabel="All users"
                options={[
                  ...data.users.map((user) => ({
                    value: user.id,
                    label: user.name,
                  })),
                  ...missingUserOption(draft.user, data),
                ]}
                onChange={(user) => setDraft({ ...draft, user })}
              />
              <FilterSelect
                label="Result"
                value={draft.result}
                allLabel="All results"
                options={AUDIT_RESULTS.map((value) => ({
                  value,
                  label: AUDIT_RESULT_LABELS[value],
                }))}
                onChange={(result) =>
                  setDraft({ ...draft, result: result as Draft["result"] })
                }
              />

              <div className="flex gap-3 sm:col-span-2 lg:col-span-1 xl:ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    DASHBOARD_BUTTON,
                    "flex-1 bg-card hover:bg-slate-50 xl:flex-none dark:hover:bg-muted",
                  )}
                  onClick={clear}
                  disabled={navigating || (!anyFilter && !dirty)}
                >
                  Clear
                </Button>
                <Button
                  type="submit"
                  className={cn(
                    DASHBOARD_BUTTON,
                    "flex-1 bg-brand-accent px-5 text-brand-accent-foreground hover:bg-brand-accent/90 xl:flex-none",
                  )}
                  disabled={navigating || !dirty}
                >
                  Apply
                </Button>
              </div>
            </form>

            <nav
              aria-label="Modules"
              // overflow-x alone makes overflow-y auto too, so hide y to keep
              // a vertical scrollbar from showing beside the tabs.
              className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-border p-3 scrollbar-none"
            >
              <div className="flex h-10 w-fit shrink-0 items-center gap-1 rounded-lg border border-border bg-slate-100/70 p-1 dark:bg-muted/50">
                <TabButton
                  active={filters.module === null}
                  onClick={() => selectTab(null)}
                  icon={LayoutList}
                  label="All events"
                  count={data.tabCounts.all}
                />
                {AUDIT_TAB_MODULES.map((module) => (
                  <TabButton
                    key={module}
                    active={filters.module === module}
                    onClick={() => selectTab(module)}
                    icon={TAB_ICONS[module]}
                    label={AUDIT_TAB_LABELS[module]}
                    count={data.tabCounts[module]}
                  />
                ))}
              </div>
            </nav>

            {/* One scroll box for both directions, so the sticky header has
                something to stick to: the Table's own wrapper would otherwise
                be the scroller and the header would never pin. From lg it
                takes whatever height the page leaves (see the outer wrapper);
                below lg, 25+ rows a page are capped instead. */}
            <div
              className={cn(
                "overflow-auto transition-opacity *:data-[slot=table-container]:overflow-visible",
                "lg:min-h-0",
                filters.pageSize > SCROLL_TABLE_ABOVE &&
                  "max-h-[70vh] lg:max-h-none",
                navigating && "pointer-events-none opacity-60",
              )}
              aria-busy={navigating}
            >
              <Table className="min-w-270">
                <TableHeader className="[&_tr]:border-b-0">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={TH}>
                      <span className="flex items-center gap-1">
                        Date &amp; time
                        <ArrowDown
                          className="size-3.5"
                          aria-label="newest first"
                        />
                      </span>
                    </TableHead>
                    <TableHead className={TH}>User</TableHead>
                    <TableHead className={TH}>Action</TableHead>
                    <TableHead className={TH}>Module</TableHead>
                    <TableHead className={TH}>Details</TableHead>
                    <TableHead className={TH}>Result</TableHead>
                    <TableHead className={TH}>IP address</TableHead>
                    <TableHead className={cn(TH, "text-center")}>
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.events.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={8} className="px-4 py-14 text-center">
                        <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-muted">
                          <Inbox className="size-5" aria-hidden />
                        </span>
                        <p className="font-semibold text-foreground">
                          No events found
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {anyFilter
                            ? "Nothing matches these filters in the selected dates."
                            : "Nothing was recorded in the selected dates."}
                        </p>
                        {anyFilter && (
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              DASHBOARD_BUTTON,
                              "mt-4 gap-2 bg-card hover:bg-slate-50 dark:hover:bg-muted",
                            )}
                            onClick={clear}
                          >
                            <FilterX className="size-4" />
                            Clear filters
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.events.map((event) => (
                      <EventRow
                        key={event.id}
                        event={event}
                        timeZone={timeZone}
                        now={now}
                        selected={event.id === selectedId}
                        onOpen={() => setSelectedId(event.id)}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-border bg-slate-50/50 px-4 py-3 sm:flex-row dark:bg-muted/20">
              <p className="text-sm text-slate-500 tabular-nums">
                {data.total === 0
                  ? "No events"
                  : `Showing ${firstRow} - ${lastRow} of ${data.total.toLocaleString("en-US")} ${data.total === 1 ? "event" : "events"}`}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                {pageCount > 1 && (
                  <Pagination
                    page={Math.min(filters.page, pageCount)}
                    pageCount={pageCount}
                    hrefFor={(page) => hrefFor({ page })}
                    label="Audit log pages"
                  />
                )}
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  Show
                  <Select
                    value={String(filters.pageSize)}
                    onValueChange={(value) => go({ pageSize: Number(value) })}
                  >
                    <SelectTrigger
                      className="min-h-10 w-20 rounded-lg bg-card"
                      aria-label="Events per page"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      side="bottom"
                      align="start"
                      position="popper"
                      className="p-1 w-(--radix-select-trigger-width) max-h-[60vh]"
                    >
                      {AUDIT_PAGE_SIZES.map((size) => (
                        <SelectItem
                          key={size}
                          value={String(size)}
                          className="p-2 cursor-pointer"
                        >
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details open in a popup, styled like the app's other dialogs. */}
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
          {shown && (
            <AuditEventDetails event={shown} timeZone={timeZone} now={now} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function FilterSelect({
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  allLabel: string;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
}) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) => onChange(next === ALL ? null : next)}
    >
      <SelectTrigger
        className="h-10! w-full rounded-lg bg-card xl:w-40 2xl:w-44"
        aria-label={label}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        side="bottom"
        align="start"
        position="popper"
        className="p-1"
      >
        <SelectItem value={ALL} className="p-2 cursor-pointer">
          {allLabel}
        </SelectItem>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="p-2 cursor-pointer"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "bg-white font-semibold text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200 dark:bg-card dark:ring-border"
          : "text-slate-500 hover:text-foreground",
      )}
    >
      <Icon
        className={cn("size-4", active ? "text-brand-700" : "text-slate-400")}
        aria-hidden
      />
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-px text-[11px] tabular-nums",
          active
            ? "bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100"
            : "bg-white/70 text-slate-500 dark:bg-muted",
        )}
      >
        {count.toLocaleString("en-US")}
      </span>
    </button>
  );
}

function EventRow({
  event,
  timeZone,
  now,
  selected,
  onOpen,
}: {
  event: AuditEvent;
  timeZone: string;
  now: number;
  selected: boolean;
  onOpen: () => void;
}) {
  const ActionIcon = AUDIT_ACTION_ICONS[event.action];

  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      className={cn(
        "cursor-pointer border-border transition-colors hover:bg-slate-50/60 dark:hover:bg-muted/30",
        selected &&
          "bg-brand-50/70 hover:bg-brand-50/70 dark:bg-brand-700/15 dark:hover:bg-brand-700/15",
      )}
      onClick={onOpen}
    >
      <TableCell className="px-4 py-3.5">
        <p className="font-semibold whitespace-nowrap text-foreground tabular-nums">
          {formatAuditTimestamp(event.createdAt, timeZone)}
        </p>
        <p className="text-xs text-slate-500">
          {formatRelativeTime(event.createdAt, now)}
        </p>
      </TableCell>

      <TableCell className="px-4 py-3.5">
        {event.actor ? (
          <div className="flex items-center gap-2.5">
            <Avatar className="size-8">
              {event.actor.avatarUrl && (
                <AvatarImage src={event.actor.avatarUrl} alt="" />
              )}
              <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-700 dark:bg-muted dark:text-slate-300">
                {getInitials(event.actor.name, event.actor.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 max-w-44">
              <p className="truncate font-semibold text-foreground">
                {event.actor.name}
              </p>
              <p className="truncate text-xs text-slate-500">
                {event.actor.role ?? event.actor.email}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-muted">
              <User className="size-4" aria-hidden />
            </span>
            <p className="font-semibold text-slate-500">System</p>
          </div>
        )}
      </TableCell>

      <TableCell className="px-4 py-3">
        <Badge
          className={cn(
            "gap-1 ring-1 ring-current/15 ring-inset",
            AUDIT_ACTION_BADGE[event.action],
          )}
        >
          <ActionIcon className="size-3" aria-hidden />
          {AUDIT_ACTION_LABELS[event.action]}
        </Badge>
      </TableCell>

      <TableCell className="px-4 py-3">
        <Badge
          className={cn(
            "ring-1 ring-current/15 ring-inset",
            AUDIT_MODULE_BADGE[event.module],
          )}
        >
          {AUDIT_MODULE_LABELS[event.module]}
        </Badge>
      </TableCell>

      <TableCell className="max-w-80 px-4 py-3">
        <p
          className="truncate text-slate-700 dark:text-slate-300"
          title={event.summary}
        >
          {event.summary}
        </p>
      </TableCell>

      <TableCell className="px-4 py-3">
        <Badge
          className={cn(
            "ring-1 ring-current/15 ring-inset",
            AUDIT_RESULT_BADGE[event.result],
          )}
        >
          {AUDIT_RESULT_LABELS[event.result]}
        </Badge>
      </TableCell>

      <TableCell className="px-4 py-3 text-[13px] whitespace-nowrap tabular-nums">
        {event.ip ?? <span className="font-sans text-muted-foreground">—</span>}
      </TableCell>

      <TableCell
        className="px-4 py-3 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="outline"
          size="icon"
          className={cn(
            DASHBOARD_ICON_BUTTON,
            "text-slate-500 hover:bg-slate-50 hover:text-foreground dark:hover:bg-muted",
          )}
          aria-label="View event details"
          title="View details"
          onClick={onOpen}
        >
          <Eye className="size-4" aria-hidden />
        </Button>
      </TableCell>
    </TableRow>
  );
}
