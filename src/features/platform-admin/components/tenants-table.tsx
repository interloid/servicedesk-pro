"use client";

import { useMemo, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TEAM_DIALOG_CONTENT } from "@/features/team/components/modal-buttons";
import { cn } from "@/lib/utils";

import { formatCurrency } from "../format";
import type { PlatformTenant, TenantStatus } from "../types";
import {
  DataTable,
  FilterTabs,
  PLATFORM_SEARCH,
  SearchField,
} from "./platform-ui";
import { TenantStatusBadge, ToneBadge, type BadgeTone } from "./status-badge";
import { WorkspaceBlockDialog } from "./workspace-block-dialog";

const FILTERS: Array<{ label: string; value: TenantStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Trialing", value: "trialing" },
  { label: "Past due", value: "past_due" },
  { label: "Blocked", value: "suspended" },
  { label: "Cancelled", value: "cancelled" },
];

// Indexed by plan rank (plans.sort_order order): Free, Pro, Business.
const PLAN_BADGE_TONES: BadgeTone[] = ["muted", "teal", "violet"];

function planBadgeTone(tenant: PlatformTenant): BadgeTone {
  return PLAN_BADGE_TONES[
    Math.min(tenant.planRank, PLAN_BADGE_TONES.length - 1)
  ];
}

export function TenantsTable({ tenants }: { tenants: PlatformTenant[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TenantStatus | "all">("all");
  const [actingId, setActingId] = useState<string | null>(null);
  const acting = tenants.find((tenant) => tenant.id === actingId);

  const searched = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return tenants.filter(
      (tenant) =>
        !needle ||
        [tenant.name, tenant.slug, tenant.owner, tenant.ownerEmail].some(
          (text) => text.toLowerCase().includes(needle),
        ),
    );
  }, [tenants, query]);

  const rows = searched.filter(
    (tenant) => filter === "all" || tenant.status === filter,
  );
  const totalMrr = rows.reduce((sum, tenant) => sum + tenant.mrr, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className={PLATFORM_SEARCH}>
        <SearchField
          value={query}
          onChange={setQuery}
          label="Search tenants"
          placeholder="Search name, slug, or owner…"
        />
      </div>

      <FilterTabs
        label="Tenant status"
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((item) => ({
          ...item,
          count:
            item.value === "all"
              ? searched.length
              : searched.filter((tenant) => tenant.status === item.value)
                  .length,
        }))}
      />

      <DataTable
        rows={rows}
        rowKey={(tenant) => tenant.id}
        empty="No tenants match your search."
        summary={
          <>
            {rows.length} tenant{rows.length === 1 ? "" : "s"}
            <span className="text-xs font-normal text-muted-foreground">
              {formatCurrency(totalMrr)} / mo shown
            </span>
          </>
        }
        columns={[
          {
            key: "workspace",
            header: "Workspace",
            primary: true,
            cell: (tenant) => (
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-9 rounded-md">
                  <AvatarFallback className="rounded-md bg-muted text-xs font-bold text-foreground">
                    {tenant.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{tenant.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    /{tenant.slug}
                    {tenant.ownerEmail && ` · ${tenant.ownerEmail}`}
                  </span>
                </div>
              </div>
            ),
          },
          {
            key: "plan",
            header: "Plan",
            cell: (tenant) => (
              <ToneBadge tone={planBadgeTone(tenant)}>{tenant.plan}</ToneBadge>
            ),
          },
          {
            key: "seats",
            header: "Seats",
            cell: (tenant) => `${tenant.seatsUsed} / ${tenant.seatsLimit}`,
          },
          {
            key: "mrr",
            header: "MRR",
            cell: (tenant) => (
              <span className="font-semibold tabular-nums">
                {formatCurrency(tenant.mrr)}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (tenant) => (
              <div className="flex flex-col items-end gap-1 @3xl:items-start">
                <TenantStatusBadge status={tenant.status} />
                {tenant.status === "suspended" && (
                  <span className="text-xs text-muted-foreground">
                    {tenant.blockSource === "payment"
                      ? "Failed payments"
                      : "By an admin"}
                  </span>
                )}
              </div>
            ),
          },
          {
            key: "created",
            header: "Created",
            align: "right",
            cell: (tenant) => (
              <span className="text-muted-foreground">{tenant.createdAt}</span>
            ),
          },
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            action: true,
            align: "right",
            cell: (tenant) =>
              tenant.status === "active" ||
              tenant.status === "trialing" ||
              tenant.status === "past_due" ? (
                <Button
                  variant="outline"
                  className="h-9 rounded-lg border-red-200! bg-transparent px-3 font-semibold text-red-600 shadow-none hover:bg-red-50 hover:text-red-700 dark:border-red-900/50! dark:hover:bg-red-950/30"
                  aria-label={`Block ${tenant.name}`}
                  onClick={() => setActingId(tenant.id)}
                >
                  Block
                </Button>
              ) : tenant.status === "suspended" ? (
                <Button
                  variant="outline"
                  className="h-9 rounded-lg px-3 font-semibold shadow-none"
                  aria-label={`Unblock ${tenant.name}`}
                  onClick={() => setActingId(tenant.id)}
                >
                  Unblock
                </Button>
              ) : null,
          },
        ]}
      />

      <Dialog
        open={Boolean(acting)}
        onOpenChange={(open) => !open && setActingId(null)}
      >
        <DialogContent
          className={cn(
            "max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-lg",
            TEAM_DIALOG_CONTENT,
          )}
        >
          {acting && (
            <WorkspaceBlockDialog
              key={acting.id}
              tenant={acting}
              onClose={() => setActingId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
