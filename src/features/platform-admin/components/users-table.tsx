"use client";

import { useMemo, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/format";

import type { PlatformUser, UserStatus } from "../types";
import {
  DataTable,
  FilterSelect,
  FilterTabs,
  PLATFORM_SEARCH,
  PLATFORM_TOOLBAR,
  SearchField,
} from "./platform-ui";
import { UserStatusBadge } from "./status-badge";

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

  return (
    <div className="flex flex-col gap-4">
      <div className={PLATFORM_TOOLBAR}>
        <div className={PLATFORM_SEARCH}>
          <SearchField
            value={query}
            onChange={setQuery}
            label="Search users"
            placeholder="Search name or email…"
          />
        </div>
        <FilterSelect
          label="Filter by workspace"
          value={tenantFilter}
          onChange={setTenantFilter}
          options={[
            { value: "all", label: "All workspaces" },
            ...tenants.map((tenant) => ({ value: tenant, label: tenant })),
          ]}
        />
      </div>

      <FilterTabs
        label="User status"
        value={statusFilter}
        onChange={setStatusFilter}
        options={STATUS_FILTERS.map((item) => ({
          ...item,
          count:
            item.value === "all"
              ? searched.length
              : searched.filter((user) => user.status === item.value).length,
        }))}
      />

      <DataTable
        rows={rows}
        rowKey={(user) => user.id}
        empty="No users match your search."
        summary={
          <>
            {rows.length} user{rows.length === 1 ? "" : "s"}
            <span className="text-xs font-normal text-muted-foreground">
              of {users.length} on the platform
            </span>
          </>
        }
        columns={[
          {
            key: "user",
            header: "User",
            primary: true,
            cell: (user) => (
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-9">
                  <AvatarFallback className="bg-foreground text-xs font-bold text-background">
                    {getInitials(user.name, user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            ),
          },
          {
            key: "workspace",
            header: "Workspace",
            cell: (user) => user.tenant,
          },
          { key: "role", header: "Role", cell: (user) => user.role },
          {
            key: "status",
            header: "Status",
            cell: (user) => <UserStatusBadge status={user.status} />,
          },
          {
            key: "active",
            header: "Last active",
            align: "right",
            cell: (user) => (
              <span className="text-muted-foreground">
                {timeAgo(user.lastActiveAt)}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
