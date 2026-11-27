"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  CircleCheck,
  MailPlus,
  RotateCcw,
  UserX,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";

import type { PlatformUser, UserStatus } from "../types";
import {
  DataTable,
  FilterSelect,
  FilterTabs,
  PLATFORM_CARD,
  SearchField,
  StatFilterCard,
  TablePaginationFooter,
} from "./platform-ui";
import { ToneBadge, UserStatusBadge } from "./status-badge";
import { useTablePagination } from "./use-table-pagination";

const STATUS_FILTERS: Array<{ label: string; value: UserStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Invited", value: "invited" },
  { label: "Disabled", value: "disabled" },
];

function timeAgo(iso: string): string {
  if (!iso) return "Never";

  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function UsersTable({ users }: { users: PlatformUser[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
  const [tenantFilter, setTenantFilter] = useState("all");

  const tenants = useMemo(
    () => [...new Set(users.map((user) => user.tenant))].sort(),
    [users],
  );

  const searched = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return users.filter(
      (user) =>
        (tenantFilter === "all" || user.tenant === tenantFilter) &&
        (!needle ||
          user.name.toLowerCase().includes(needle) ||
          user.email.toLowerCase().includes(needle)),
    );
  }, [users, query, tenantFilter]);

  const rows = searched.filter(
    (user) => statusFilter === "all" || user.status === statusFilter,
  );
  const { pageRows, resetPage, footer } = useTablePagination(rows);

  const countOf = (value: UserStatus | "all") =>
    value === "all"
      ? searched.length
      : searched.filter((user) => user.status === value).length;
  const isFiltered =
    query.trim() !== "" || statusFilter !== "all" || tenantFilter !== "all";

  function pickStatus(value: UserStatus | "all") {
    setStatusFilter(value);
    resetPage();
  }

  function reset() {
    setQuery("");
    setStatusFilter("all");
    setTenantFilter("all");
    resetPage();
  }

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1">
      <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
        <StatFilterCard
          label="All users"
          value={countOf("all")}
          icon={Users}
          iconClass="bg-brand-50 text-brand-700"
          active={statusFilter === "all"}
          onClick={() => pickStatus("all")}
        />
        <StatFilterCard
          label="Active"
          value={countOf("active")}
          icon={CircleCheck}
          iconClass="bg-emerald-50 text-emerald-600"
          active={statusFilter === "active"}
          onClick={() => pickStatus("active")}
        />
        <StatFilterCard
          label="Invited"
          value={countOf("invited")}
          icon={MailPlus}
          iconClass="bg-sky-50 text-sky-600"
          active={statusFilter === "invited"}
          onClick={() => pickStatus("invited")}
        />
        <StatFilterCard
          label="Disabled"
          value={countOf("disabled")}
          icon={UserX}
          iconClass="bg-slate-100 text-slate-600"
          active={statusFilter === "disabled"}
          onClick={() => pickStatus("disabled")}
        />
      </div>

      {/* One toolbar: status tabs and Clear on top, search and workspace below. */}
      <div className={cn(PLATFORM_CARD, "flex shrink-0 flex-col")}>
        <div className="flex items-center gap-3 border-b border-border p-3">
          <div className="min-w-0 flex-1">
            <FilterTabs
              label="User status"
              value={statusFilter}
              onChange={pickStatus}
              options={STATUS_FILTERS.map((item) => ({
                ...item,
                count: countOf(item.value),
              }))}
            />
          </div>
          <Button
            variant="ghost"
            className="h-9 shrink-0 gap-1.5 rounded-lg px-3 font-semibold text-slate-600 hover:text-foreground disabled:opacity-40"
            disabled={!isFiltered}
            onClick={reset}
          >
            <RotateCcw className="size-4" aria-hidden />
            <span className="hidden sm:inline">Clear filters</span>
            <span className="sm:hidden">Clear</span>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <SearchField
            value={query}
            onChange={(value) => {
              setQuery(value);
              resetPage();
            }}
            label="Search users"
            placeholder="Search name or email…"
          />
          <FilterSelect
            label="Filter by workspace"
            value={tenantFilter}
            className="xl:w-full"
            onChange={(value) => {
              setTenantFilter(value);
              resetPage();
            }}
            options={[
              { value: "all", label: "All workspaces" },
              ...tenants.map((tenant) => ({ value: tenant, label: tenant })),
            ]}
          />
        </div>
      </div>

      <DataTable
        rows={pageRows}
        rowKey={(user) => user.id}
        empty="No users match your search."
        scrollLabel="Users"
        summary={
          <>
            {rows.length} user{rows.length === 1 ? "" : "s"}
            <span className="text-xs font-normal text-muted-foreground">
              of {users.length} on the platform
            </span>
          </>
        }
        footer={
          <TablePaginationFooter
            {...footer}
            noun={{ one: "user", other: "users" }}
          />
        }
        columns={[
          {
            key: "user",
            header: "User",
            primary: true,
            cell: (user) => (
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-9">
                  <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-700">
                    {getInitials(user.name, user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs text-slate-500">
                    {user.email}
                  </span>
                </div>
              </div>
            ),
          },
          {
            key: "workspace",
            header: "Workspace",
            cell: (user) => (
              <span className="flex min-w-0 items-center gap-2 text-slate-700">
                <Building2
                  className="size-4 shrink-0 text-slate-400"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span className="truncate">{user.tenant}</span>
              </span>
            ),
          },
          {
            key: "role",
            header: "Role",
            cell: (user) => <ToneBadge tone="muted">{user.role}</ToneBadge>,
          },
          {
            key: "status",
            header: "Status",
            cell: (user) => <UserStatusBadge status={user.status} />,
          },
          {
            key: "active",
            header: "Last active",
            cell: (user) => (
              <span className="whitespace-nowrap text-slate-500">
                {timeAgo(user.lastActiveAt)}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
