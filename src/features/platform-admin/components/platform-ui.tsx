import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { Pagination } from "@/components/shared/pagination";
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
  "rounded-[14px] border border-border bg-card shadow-xs ring-0";

/** Search first and full width, then selects; one row from xl. */
export const PLATFORM_TOOLBAR =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center";

/** Sits in PLATFORM_TOOLBAR, or alone above a table. */
export const PLATFORM_SEARCH = "sm:col-span-2 xl:w-72 xl:flex-none";

export const PLATFORM_STAT_GRID =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4";

export function PlatformPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
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
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className="h-10! w-full rounded-lg bg-card xl:w-44"
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
    <nav
      aria-label={label}
      className="flex shrink-0 gap-2 overflow-x-auto overflow-y-hidden scrollbar-none"
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
              "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "border-primary! bg-primary/10 font-semibold text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs tabular-nums",
                  active
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
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
    <div className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
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
  "h-11 bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] px-4 text-xs font-semibold whitespace-nowrap text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]";

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
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
          {summary}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">
          {empty}
        </p>
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
                  className="hover:bg-muted/40"
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "px-4 py-3 text-sm text-foreground",
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
