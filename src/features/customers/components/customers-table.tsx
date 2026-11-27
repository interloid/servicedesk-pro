"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Search,
  UsersRound,
} from "lucide-react";

import {
  DASHBOARD_CARD,
  DashboardPageHeader,
} from "@/components/shared/dashboard-ui";
import { Pagination } from "@/components/shared/pagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  CUSTOMER_LIST_PAGE_SIZE,
  csatScoreTitle,
  csatTone,
  customerPath,
  DEFAULT_CUSTOMER_SORT,
  defaultSortDirection,
  formatCsatScore,
  formatCustomerDate,
  type CustomerListItem,
  type CustomerListPage,
  type CustomerSort,
  type CustomerSortKey,
} from "@/features/customers/types/customers";

import { formatRelativeTime, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CustomerAccessMenu,
  CustomerStatusBadge,
} from "@/features/customers/components/customer-access";
import { InviteCustomerModal } from "@/features/customers/components/invite-customer-modal";

const HEAD =
  "h-10 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap text-slate-500 shadow-[inset_0_-1px_0_var(--border)]";

const CELL = "py-3.5";

/**
 * The list is searched, sorted and paged on the server; this component only
 * draws one page and writes the user's choices into the URL (`?q=&sort=&dir=
 * &page=`). A filtered page therefore survives a reload, a shared link and the
 * back button, and a tenant with thousands of customers costs the same as one
 * with ten.
 */
export default function CustomersTable({
  tenant,
  result,
  search,
  sort,
  now,
  canInvite = false,
  portalUrl,
}: {
  tenant: string;
  result: CustomerListPage;
  /** The search the page was rendered for, already trimmed. */
  search: string;
  sort: CustomerSort;
  now: number;
  /** Tenant Admins get the Invite customer button and each row's access menu. */
  canInvite?: boolean;
  /** The workspace's portal address, for the Share customer portal popup. */
  portalUrl: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const [term, setTerm] = React.useState(search);
  const [renderedSearch, setRenderedSearch] = React.useState(search);

  // The URL moved without the box -- the back button, or a link. Follow it,
  // unless the user is part-way through typing something else.
  if (search !== renderedSearch) {
    setRenderedSearch(search);

    if (term.trim() === renderedSearch) {
      setTerm(search);
    }
  }

  const { customers, total, tenantTotal, page, pageCount } = result;

  /** The current URL with some params changed; `null` removes one. */
  const hrefWith = React.useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(changes)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      const query = params.toString();

      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );

  // Debounced, so it still feels like typing into a filter. Compared trimmed:
  // "foo " is the search the server already ran, not a new one.
  React.useEffect(() => {
    const next = term.trim();

    if (next === search) {
      return;
    }

    const timer = setTimeout(() => {
      startTransition(() => {
        // The page goes with the search: page 3 of the old result is past the
        // end of a narrower one.
        router.replace(hrefWith({ q: next || null, page: null }), {
          scroll: false,
        });
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [term, search, router, hrefWith]);

  function sortHref(key: CustomerSortKey): string {
    const direction =
      sort.key === key
        ? sort.direction === "asc"
          ? "desc"
          : "asc"
        : defaultSortDirection(key);
    const isDefault =
      key === DEFAULT_CUSTOMER_SORT.key &&
      direction === DEFAULT_CUSTOMER_SORT.direction;

    return hrefWith({
      sort: isDefault ? null : key,
      dir: isDefault ? null : direction,
      page: null,
    });
  }

  const pageHref = (value: number) =>
    hrefWith({ page: value === 1 ? null : String(value) });

  const start = (page - 1) * CUSTOMER_LIST_PAGE_SIZE;

  function avatar(customer: CustomerListItem) {
    return (
      <Avatar className="size-9 shrink-0">
        {customer.avatarUrl ? (
          <AvatarImage
            src={customer.avatarUrl}
            alt=""
            className="object-cover"
          />
        ) : null}

        <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-600">
          {getInitials(customer.fullName, customer.email)}
        </AvatarFallback>
      </Avatar>
    );
  }

  function sortHeader(key: CustomerSortKey, label: string, padding: string) {
    const active = sort.key === key;

    return (
      <TableHead
        className={cn(HEAD, padding)}
        aria-sort={
          active
            ? sort.direction === "asc"
              ? "ascending"
              : "descending"
            : undefined
        }
      >
        <Link
          href={sortHref(key)}
          replace
          scroll={false}
          // text-muted-foreground explicitly: globals.css colours every <a>
          // with the brand, and the header text must stay grey like before.
          className={cn(
            "inline-flex items-center gap-1.5 text-slate-500 hover:text-foreground",
            active && "text-foreground",
          )}
        >
          {label}
          {active &&
            (sort.direction === "asc" ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            ))}
        </Link>
      </TableHead>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 font-sans sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full flex-col gap-6">
        <DashboardPageHeader
          eyebrow="Workspace"
          icon={Building2}
          title="Customers"
          description="Companies and the people who raise tickets from them."
          action={
            canInvite ? <InviteCustomerModal portalUrl={portalUrl} /> : null
          }
        />

        <div
          className={cn(
            DASHBOARD_CARD,
            "overflow-hidden transition-opacity",
            isPending && "opacity-60",
          )}
          aria-busy={isPending || undefined}
        >
          {/* The toolbar row, as on the platform tables: how many rows the
              search found on the left, the search on the right. type="search",
              so the browser draws its own clear button inside the field. */}
          <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex flex-wrap items-baseline gap-2 px-1 text-sm font-semibold text-foreground tabular-nums">
              {total.toLocaleString("en-US")}{" "}
              {total === 1 ? "customer" : "customers"}
              <span className="text-xs font-normal text-slate-500">
                of {tenantTotal.toLocaleString("en-US")} in this workspace
              </span>
            </p>

            <div className="relative w-full sm:w-80 lg:w-96">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />

              <Input
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search customers or company..."
                aria-label="Search customers"
                maxLength={200}
                className="h-10 rounded-lg bg-card pl-9 text-sm"
              />
            </div>
          </div>

          {tenantTotal === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="w-full overflow-x-auto">
                <Table className="w-full min-w-275 table-fixed">
                  <colgroup>
                    <col className="w-[24%]" />
                    <col className="w-[12%]" />
                    <col className="w-[11%]" />
                    <col className="w-[9%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                    <col className="w-[9%]" />
                    {canInvite && <col className="w-[9%]" />}
                  </colgroup>

                  <TableHeader>
                    <TableRow className="border-b-0 hover:bg-transparent">
                      {sortHeader("fullName", "Customer", "px-4")}
                      {sortHeader("company", "Company", "px-4")}
                      <TableHead className={cn(HEAD, "px-4")}>Status</TableHead>
                      {sortHeader("ticketCount", "Tickets", "px-5")}
                      {sortHeader("lastActivityAt", "Last activity", "px-5")}
                      {sortHeader("createdAt", "Added", "px-4")}
                      {sortHeader("csatScore", "CSAT", "px-4")}
                      {canInvite && (
                        <TableHead className={cn(HEAD, "px-4 text-right")}>
                          Actions
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {customers.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={canInvite ? 8 : 7}
                          className="py-14 text-center text-sm text-slate-500"
                        >
                          No customers match your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      customers.map((customer) => (
                        <TableRow
                          key={customer.id}
                          className="cursor-pointer transition-colors hover:bg-slate-50/60"
                          onClick={(event) => {
                            const target = event.target as HTMLElement;

                            if (target.closest("a, button, [role=menuitem]")) {
                              return;
                            }

                            router.push(customerPath(tenant, customer.id));
                          }}
                        >
                          <TableCell className={cn(CELL, "px-4")}>
                            <div className="flex min-w-0 items-center gap-3">
                              {avatar(customer)}

                              <div className="min-w-0">
                                <Link
                                  href={customerPath(tenant, customer.id)}
                                  className="block truncate text-sm font-semibold text-foreground hover:text-brand-ink"
                                >
                                  {customer.fullName}
                                </Link>

                                <p className="truncate text-xs text-slate-500">
                                  {customer.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell
                            className={cn(CELL, "px-4 text-sm text-slate-700")}
                          >
                            <span className="block truncate">
                              {customer.company || (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </span>
                          </TableCell>

                          <TableCell className={cn(CELL, "px-4")}>
                            <CustomerStatusBadge
                              status={customer.portalStatus}
                            />
                          </TableCell>

                          <TableCell
                            className={cn(
                              CELL,
                              "px-5 text-sm font-semibold text-foreground tabular-nums",
                            )}
                          >
                            {customer.ticketCount}
                          </TableCell>

                          <TableCell
                            className={cn(
                              CELL,
                              "px-5 text-sm whitespace-nowrap text-slate-500",
                            )}
                          >
                            {customer.lastActivityAt ? (
                              <span
                                title={formatCustomerDate(
                                  customer.lastActivityAt,
                                )}
                              >
                                {formatRelativeTime(
                                  customer.lastActivityAt,
                                  now,
                                ) ?? "—"}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>

                          <TableCell
                            className={cn(
                              CELL,
                              "px-4 text-sm whitespace-nowrap text-slate-500",
                            )}
                          >
                            {formatCustomerDate(customer.createdAt)}
                          </TableCell>

                          <TableCell
                            className={cn(CELL, "px-4 text-sm tabular-nums")}
                          >
                            {customer.csatScore === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span
                                className={cn(
                                  "font-semibold",
                                  csatTone(customer.csatScore),
                                )}
                              >
                                {formatCsatScore(customer.csatScore)}

                                <span className="sr-only">
                                  {csatScoreTitle(
                                    customer.csatScore,
                                    customer.csatCount,
                                  )}
                                </span>
                              </span>
                            )}
                          </TableCell>

                          {canInvite && (
                            <TableCell className={cn(CELL, "px-4 text-right")}>
                              <CustomerAccessMenu customer={customer} />
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Stacked and centred below sm, opposite ends of one line from
                  sm -- the same shape as the team table's pager. */}
              <div className="flex flex-col items-center justify-between gap-3 border-t border-border bg-slate-50/50 px-4 py-3 text-sm text-slate-500 tabular-nums sm:flex-row">
                <span className="text-center sm:text-left">
                  Showing{" "}
                  {total === 0
                    ? 0
                    : `${start + 1} - ${Math.min(
                        start + CUSTOMER_LIST_PAGE_SIZE,
                        total,
                      )}`}{" "}
                  of {total} {total === 1 ? "customer" : "customers"}
                  {search ? " matching your search" : ""}
                </span>

                <Pagination
                  page={page}
                  pageCount={pageCount}
                  hrefFor={pageHref}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===============================================================
   EMPTY STATE
=============================================================== */

function EmptyState() {
  return (
    <div className="flex flex-col items-center px-5 py-14 text-center">
      <span
        aria-hidden
        className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-400"
      >
        <UsersRound className="size-5" />
      </span>

      <p className="mt-4 font-heading text-base font-bold text-foreground">
        No customers yet
      </p>

      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Customers appear here the first time they raise a request through your
        support portal.
      </p>
    </div>
  );
}
