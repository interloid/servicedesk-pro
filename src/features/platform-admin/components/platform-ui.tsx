import type { ReactNode } from "react";
import { Inbox, Search, type LucideIcon } from "lucide-react";

import { Pagination } from "@/components/shared/pagination";
import { KpiTooltip } from "./kpi-tooltip";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// One set of controls for the console, taken from the tenant screens (the audit
// log's toolbar is the reference), so a fix or a size change lands everywhere.

/** Page-level and toolbar buttons. Pair with the Button's default or outline. */
export const PLATFORM_BUTTON = "h-10 rounded-lg px-4 font-semibold shadow-none";

/** The icon button at the end of a table row. */
export const PLATFORM_ICON_BUTTON = "size-9 rounded-lg shadow-none";

export const PLATFORM_CARD =
  "rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-0";

/** Small emerald icon tile used beside headings and in cards. */
export const PLATFORM_ICON_TILE =
  "flex shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100";

/** Search first and full width, then selects; one row from xl. */
export const PLATFORM_TOOLBAR =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center";

/** Sits in PLATFORM_TOOLBAR, or alone above a table. */
export const PLATFORM_SEARCH = "sm:col-span-2 xl:w-72 xl:flex-none";

export const PLATFORM_STAT_GRID =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4";

/**
 * The page heading every console page shares (the overview is the reference):
 * a small eyebrow with the page's sidebar section and icon, the title in the
 * heading face, a line of description, and an optional action on the right.
 */
export function PlatformPageHeader({
  title,
  description,
  action,
  eyebrow,
  icon: Icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  /** The page's sidebar section, e.g. "Manage platform". */
  eyebrow?: string;
  /** The page's sidebar icon. */
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && (
          <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-brand-700 uppercase">
            {Icon && <Icon className="size-3.5" strokeWidth={2} aria-hidden />}
            {eyebrow}
          </span>
        )}
        <h1 className="font-heading text-[1.75rem] leading-tight font-bold tracking-tight text-foreground sm:text-[2rem]">
          {title}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-[15px]">
          {description}
        </p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * A titled card: an icon-led header (title, optional description and action)
 * over a padded body, as on the overview. Used for charts, lists and grouped
 * settings.
 */
export function PlatformPanel({
  title,
  description,
  action,
  icon: Icon,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(PLATFORM_CARD, "flex min-w-0 flex-col", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <Icon className="size-4.5" strokeWidth={1.75} aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="font-heading text-base leading-snug font-bold tracking-tight text-foreground">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * A small icon-led heading over a group of cards (Overview, Analytics): a
 * round teal icon, the title in the heading face and one line of context.
 */
export function PlatformSectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="font-heading text-base leading-snug font-bold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}

/**
 * A stat card that doubles as a filter (Tenants, Users), like the tabs below it. Styled as the
 * overview's KPI cards: a round tinted icon, then the figure and its label.
 */
export function StatFilterCard({
  label,
  value,
  icon: Icon,
  iconClass = "bg-slate-100 text-slate-600",
  active,
  alert = false,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  /** The icon circle's colours, when it isn't the alert red. */
  iconClass?: string;
  active: boolean;
  alert?: boolean;
  onClick: () => void;
}) {
  const alerting = alert && value > 0;

  return (
    <KpiTooltip label={label}>
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          PLATFORM_CARD,
          "flex min-w-0 items-start gap-3 p-4 text-left transition-all outline-none hover:-translate-y-px hover:shadow-[0_10px_28px_-12px_rgba(15,23,42,0.18)] focus-visible:ring-2 focus-visible:ring-ring/50",
          active && "border-brand-700/50! ring-1 ring-brand-700/30",
          alerting && !active && "border-red-200! dark:border-red-900/60!",
        )}
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            alerting ? "bg-red-50 text-red-600" : iconClass,
          )}
        >
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-2xl leading-tight font-bold tracking-tight text-foreground tabular-nums">
            {value}
          </span>
          <span
            data-kpi-text
            className="truncate text-sm leading-snug font-medium text-slate-600"
          >
            {label}
          </span>
        </span>
      </button>
    </KpiTooltip>
  );
}

/** Inline empty state for a panel body (charts, short lists). */
export function PlatformEmpty({
  icon: Icon = Inbox,
  children,
  className,
}: {
  icon?: React.ElementType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-3 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="max-w-xs text-sm text-slate-500">{children}</p>
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  maxLength = 100,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  maxLength?: number;
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        maxLength={maxLength}
        className="h-10 rounded-lg bg-card pl-9"
      />
    </div>
  );
}

/**
 * Status tabs on the left, search on the far right, any selects just before it.
 * Stacks when narrow. Sized by the content area, as the sidebar can collapse.
 */
export function PlatformFilterBar({
  tabs,
  search,
  children,
}: {
  tabs: ReactNode;
  search: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="@container">
      <div className="flex flex-col gap-3 @[58rem]:flex-row @[58rem]:items-center @[58rem]:justify-between">
        <div className="min-w-0">{tabs}</div>
        <div className="flex min-w-48 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end @[58rem]:flex-1">
          {children && <div className="shrink-0 sm:w-44">{children}</div>}
          <div className="min-w-48 sm:flex-1 @[58rem]:max-w-72">{search}</div>
        </div>
      </div>
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  /** Overrides the trigger's width (it is 11rem from xl by default). */
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className={cn("h-10! w-full rounded-lg bg-card xl:w-44", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        side="bottom"
        align="start"
        position="popper"
        className="p-1"
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="cursor-pointer p-2"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Status filters; scrolls sideways on a phone rather than wrapping. */
export function FilterTabs<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
}) {
  return (
    // A segmented control: one track, the active option raised in white.
    <nav
      aria-label={label}
      className="flex h-10 w-fit max-w-full shrink-0 items-center gap-1 overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-slate-100/70 p-1 scrollbar-none"
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? "bg-white font-semibold text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200"
                : "text-slate-500 hover:text-foreground",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[11px] tabular-nums",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "bg-white/70 text-slate-500",
                )}
              >
                {option.count.toLocaleString("en-US")}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/** The tenant audit log's table footer: range, numbered pages, rows per page. */
export function TablePaginationFooter({
  page,
  pageCount,
  pageSize,
  pageSizes,
  total,
  noun,
  hrefFor,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  pageSizes: readonly number[];
  total: number;
  noun: { one: string; other: string };
  onPageSizeChange: (size: number) => void;
} & (
  | { hrefFor: (page: number) => string; onPageChange?: never }
  | { onPageChange: (page: number) => void; hrefFor?: never }
)) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const pager = { page, pageCount, label: `${noun.one} pages` };

  return (
    <div className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-border bg-slate-50/50 px-4 py-3 sm:flex-row">
      <p className="text-sm text-slate-500 tabular-nums">
        {total === 0
          ? `No ${noun.other}`
          : `Showing ${first} - ${last} of ${total.toLocaleString("en-US")} ${total === 1 ? noun.one : noun.other}`}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {hrefFor ? (
          <Pagination {...pager} hrefFor={hrefFor} />
        ) : (
          <Pagination {...pager} onChange={onPageChange!} />
        )}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Show
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger
              className="min-h-10 w-20"
              aria-label={`${noun.other} per page`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              side="bottom"
              align="start"
              position="popper"
              className="max-h-[60vh] w-(--radix-select-trigger-width) p-1"
            >
              {pageSizes.map((size) => (
                <SelectItem
                  key={size}
                  value={String(size)}
                  className="cursor-pointer p-2"
                >
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
    </div>
  );
}

export type DataColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** The row's main column: wraps, with a minimum width. */
  primary?: boolean;
  align?: "right";
  /** Long text that should wrap instead of widening the table. */
  wrap?: boolean;
};

const TH =
  "h-10 bg-slate-50 px-4 text-[11px] font-semibold tracking-wider whitespace-nowrap text-slate-500 uppercase shadow-[inset_0_-1px_0_var(--border)]";

/**
 * A table at every width: when the card is too narrow, the table scrolls sideways
 * inside it rather than changing shape.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  summary,
  footer,
  scrollLabel,
}: {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  empty: string;
  summary?: ReactNode;
  footer?: ReactNode;
  /**
   * Names the rows' own scroll area. Set it to cap the card at the page's
   * remaining height, with the rows scrolling between a fixed header
   * and footer; a short list keeps its natural height. The page needs the same
   * height setup as the logs page.
   */
  scrollLabel?: string;
}) {
  const scrolls = scrollLabel !== undefined;
  const scrollArea = scrolls
    ? { tabIndex: 0, "aria-label": scrollLabel }
    : undefined;

  return (
    <div
      className={cn(
        PLATFORM_CARD,
        "overflow-hidden",
        scrolls && "flex flex-col",
        scrolls && rows.length <= 3 && "shrink-0",
      )}
    >
      {summary && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3.5 text-sm font-semibold text-foreground">
          {summary}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Inbox className="size-5" aria-hidden />
          </span>
          <p className="max-w-sm text-sm text-slate-500">{empty}</p>
        </div>
      ) : (
        <div
          {...scrollArea}
          className={cn(
            scrolls &&
              // Both axes scroll here, so the table's own wrapper must not
              // catch the sticky header. The bar stays where a mouse may need
              // it to reach the columns off to the side.
              "min-h-0 overflow-auto xl:scrollbar-none [&_[data-slot=table-container]]:overflow-visible",
            // Keeps a few rows in view on a short window, without padding out
            // a list too short to reach this height.
            scrolls && rows.length > 3 && "min-h-60",
          )}
        >
          <Table>
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className="hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      TH,
                      scrolls && "sticky top-0 z-10",
                      column.align === "right" && "text-right",
                    )}
                  >
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow
                  key={rowKey(row, index)}
                  className="transition-colors hover:bg-slate-50/80"
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "px-4 py-3.5 text-sm text-foreground",
                        column.align === "right" && "text-right",
                        (column.wrap || column.primary) &&
                          "min-w-48 break-words whitespace-normal [&_.truncate]:whitespace-normal",
                      )}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {footer}
    </div>
  );
}
