"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  CalendarPlus,
  CircleAlert,
  CircleCheck,
  Eye,
  Hourglass,
  LifeBuoy,
  LockOpen,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isOpenSupportStatus } from "@/features/support/support";
import { TEAM_DIALOG_CONTENT } from "@/features/team/components/modal-buttons";
import { cn } from "@/lib/utils";

import { formatCurrency } from "../format";
import type { PlatformSupportRequest } from "../services/platform-support.service";
import {
  UNLIMITED_SEATS,
  type PlatformTenant,
  type TenantStatus,
} from "../types";
import {
  DataTable,
  FilterSelect,
  FilterTabs,
  PLATFORM_CARD,
  PLATFORM_ICON_BUTTON,
  SearchField,
  StatFilterCard,
  TablePaginationFooter,
} from "./platform-ui";
import { TenantStatusBadge, ToneBadge, type BadgeTone } from "./status-badge";
import { InPersonViewLink, TenantSupportDialog } from "./tenant-support-dialog";
import { useTablePagination } from "./use-table-pagination";
import {
  ExtendTrialDialog,
  WorkspaceDeleteDialog,
  WorkspaceRestoreDialog,
} from "./workspace-lifecycle-dialogs";
import { WorkspaceBlockDialog } from "./workspace-block-dialog";

/**
 * A tenant status, "support" (an open support request) or "deleted". Deleted
 * workspaces show only under "deleted"; every other filter leaves them out.
 */
type StatusFilter = TenantStatus | "all" | "support" | "deleted";
type Lifecycle = "delete" | "restore" | "trial";
type SupportFilter = "all" | "open" | "access" | "none";
type CreatedFilter = "any" | "7" | "30" | "90" | "365";

const STATUS_LABELS: Record<Exclude<StatusFilter, "support">, string> = {
  all: "All",
  active: "Active",
  trialing: "In trial",
  past_due: "Past due",
  suspended: "Blocked",
  cancelled: "Cancelled",
  deleted: "Deleted",
};

// Indexed by plan rank (plans.sort_order order): Free, Pro, Business.
const PLAN_BADGE_TONES: BadgeTone[] = ["muted", "teal", "violet"];

function planBadgeTone(tenant: PlatformTenant): BadgeTone {
  return PLAN_BADGE_TONES[
    Math.min(tenant.planRank, PLAN_BADGE_TONES.length - 1)
  ];
}

type Support = {
  requests: PlatformSupportRequest[];
  open: PlatformSupportRequest[];
  accessActive: boolean;
};

const NO_SUPPORT: Support = { requests: [], open: [], accessActive: false };

export function TenantsTable({
  tenants,
  supportRequests,
}: {
  tenants: PlatformTenant[];
  /** Every support request, newest first. */
  supportRequests: PlatformSupportRequest[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [plan, setPlan] = useState("all");
  const [support, setSupport] = useState<SupportFilter>("all");
  const [created, setCreated] = useState<CreatedFilter>("any");
  // Taken when the filter is picked: reading the clock during render would
  // make the list change on its own between renders.
  const [createdAfter, setCreatedAfter] = useState<number | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [lifecycle, setLifecycle] = useState<{
    kind: Lifecycle;
    tenantId: string;
  } | null>(null);
  const [supportTarget, setSupportTarget] = useState<{
    tenantId: string;
    requestId: string | null;
  } | null>(null);

  const supportByTenant = useMemo(() => {
    const map = new Map<string, Support>();

    for (const request of supportRequests) {
      const entry = map.get(request.tenantId) ?? {
        requests: [],
        open: [],
        accessActive: false,
      };

      entry.requests.push(request);
      if (isOpenSupportStatus(request.status)) entry.open.push(request);
      if (request.accessActive) entry.accessActive = true;
      map.set(request.tenantId, entry);
    }

    return map;
  }, [supportRequests]);

  const supportOf = (tenant: PlatformTenant) =>
    supportByTenant.get(tenant.id) ?? NO_SUPPORT;

  const plans = useMemo(
    () =>
      [...new Map(tenants.map((t) => [t.plan, t.planRank])).entries()]
        .sort((a, b) => a[1] - b[1])
        .map(([name]) => name),
    [tenants],
  );

  // Every filter but status, so the tabs and cards count what they would show.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tenants.filter((tenant) => {
      const s = supportByTenant.get(tenant.id) ?? NO_SUPPORT;

      if (plan !== "all" && tenant.plan !== plan) return false;
      if (support === "open" && s.open.length === 0) return false;
      if (support === "access" && !s.accessActive) return false;
      if (support === "none" && s.requests.length > 0) return false;
      if (
        createdAfter !== null &&
        Date.parse(tenant.createdAt) < createdAfter
      ) {
        return false;
      }

      return (
        !needle ||
        [tenant.name, tenant.slug, tenant.owner, tenant.ownerEmail].some(
          (text) => text.toLowerCase().includes(needle),
        )
      );
    });
  }, [tenants, supportByTenant, query, plan, support, createdAfter]);

  const matchesStatus = (tenant: PlatformTenant, value: StatusFilter) => {
    if (value === "deleted") return tenant.deletedAt !== null;
    if (tenant.deletedAt !== null) return false;
    if (value === "all") return true;

    return value === "support"
      ? (supportByTenant.get(tenant.id)?.open.length ?? 0) > 0
      : tenant.status === value;
  };

  const countOf = (value: StatusFilter) =>
    filtered.filter((tenant) => matchesStatus(tenant, value)).length;

  const rows = filtered.filter((tenant) => matchesStatus(tenant, status));
  const totalMrr = rows.reduce((sum, tenant) => sum + tenant.mrr, 0);
  const withSupport = rows.filter((t) => supportOf(t).open.length > 0).length;
  const { pageRows, resetPage, footer } = useTablePagination(rows);

  const isFiltered =
    query.trim() !== "" ||
    status !== "all" ||
    plan !== "all" ||
    support !== "all" ||
    created !== "any";

  function update<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      resetPage();
    };
  }

  function reset() {
    setQuery("");
    setStatus("all");
    setPlan("all");
    setSupport("all");
    setCreated("any");
    setCreatedAfter(null);
    resetPage();
  }

  const blocking = tenants.find((tenant) => tenant.id === blockingId);
  const lifecycleTenant = tenants.find(
    (tenant) => tenant.id === lifecycle?.tenantId,
  );
  const closeLifecycle = () => setLifecycle(null);
  const supportTenant = tenants.find((t) => t.id === supportTarget?.tenantId);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatFilterCard
          label="All Tenants"
          value={countOf("all")}
          icon={Users}
          iconClass="bg-brand-50 text-brand-700"
          active={status === "all"}
          onClick={() => update(setStatus)("all")}
        />
        <StatFilterCard
          label="Active"
          value={countOf("active")}
          icon={CircleCheck}
          iconClass="bg-emerald-50 text-emerald-600"
          active={status === "active"}
          onClick={() => update(setStatus)("active")}
        />
        <StatFilterCard
          label="In trial"
          value={countOf("trialing")}
          icon={Hourglass}
          iconClass="bg-sky-50 text-sky-600"
          active={status === "trialing"}
          onClick={() => update(setStatus)("trialing")}
        />
        <StatFilterCard
          label="Support Requests"
          value={countOf("support")}
          icon={LifeBuoy}
          alert
          active={status === "support"}
          onClick={() => update(setStatus)("support")}
        />
        <StatFilterCard
          label="Past Due"
          value={countOf("past_due")}
          icon={CircleAlert}
          iconClass="bg-amber-50 text-amber-600"
          active={status === "past_due"}
          onClick={() => update(setStatus)("past_due")}
        />
        <StatFilterCard
          label="Blocked"
          value={countOf("suspended")}
          icon={Ban}
          iconClass="bg-slate-100 text-slate-600"
          active={status === "suspended"}
          onClick={() => update(setStatus)("suspended")}
        />
      </div>

      {/* One toolbar: status tabs and Clear on top, search and filters below. */}
      <div className={cn(PLATFORM_CARD, "flex shrink-0 flex-col")}>
        <div className="flex items-center gap-3 border-b border-border p-3">
          <div className="min-w-0 flex-1">
            <FilterTabs
              label="Tenant status"
              value={status}
              onChange={update(setStatus)}
              options={[
                ...(
                  [
                    "all",
                    "active",
                    "trialing",
                    "past_due",
                    "suspended",
                    "cancelled",
                  ] as const
                ).map((value) => ({
                  value,
                  label: STATUS_LABELS[value],
                  count: countOf(value),
                })),
                {
                  value: "support" as const,
                  label: "Support Requests",
                  count: countOf("support"),
                },
              ]}
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
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-[minmax(16rem,1.6fr)_repeat(4,minmax(0,1fr))]">
          <div className="sm:col-span-2 lg:col-span-4 2xl:col-span-1">
            <SearchField
              value={query}
              onChange={update(setQuery)}
              label="Search tenants"
              placeholder="Search tenant (name, slug, owner, email)…"
            />
          </div>
          <FilterSelect
            className="xl:w-full"
            label="Filter by plan"
            value={plan}
            onChange={update(setPlan)}
            options={[
              { value: "all", label: "Plan: All" },
              ...plans.map((name) => ({ value: name, label: `Plan: ${name}` })),
            ]}
          />
          <FilterSelect
            className="xl:w-full"
            label="Filter by status"
            value={status}
            onChange={(value) => update(setStatus)(value as StatusFilter)}
            options={[
              ...(
                Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>
              ).map((value) => ({
                value,
                label: `Status: ${STATUS_LABELS[value]}`,
              })),
              { value: "support", label: "Status: Has support request" },
            ]}
          />
          <FilterSelect
            className="xl:w-full"
            label="Filter by support requests"
            value={support}
            onChange={(value) => update(setSupport)(value as SupportFilter)}
            options={[
              { value: "all", label: "Support: All" },
              { value: "open", label: "Support: Open requests" },
              { value: "access", label: "Support: Access granted" },
              { value: "none", label: "Support: No requests" },
            ]}
          />
          <FilterSelect
            className="xl:w-full"
            label="Filter by created date"
            value={created}
            onChange={(value) => {
              const days = value as CreatedFilter;
              setCreatedAfter(
                days === "any" ? null : Date.now() - Number(days) * 86_400_000,
              );
              update(setCreated)(days);
            }}
            options={[
              { value: "any", label: "Created: Any time" },
              { value: "7", label: "Created: Last 7 days" },
              { value: "30", label: "Created: Last 30 days" },
              { value: "90", label: "Created: Last 90 days" },
              { value: "365", label: "Created: Last year" },
            ]}
          />
        </div>
      </div>

      <DataTable
        rows={pageRows}
        rowKey={(tenant) => tenant.id}
        empty="No tenants match these filters."
        scrollLabel="Tenants"
        summary={
          <>
            {rows.length} tenant{rows.length === 1 ? "" : "s"}
            {withSupport > 0 && (
              <ToneBadge tone="red">
                {withSupport} with support requests
              </ToneBadge>
            )}
            <span className="text-xs font-normal text-muted-foreground">
              {formatCurrency(totalMrr)} / mo in total
            </span>
          </>
        }
        footer={
          <TablePaginationFooter
            {...footer}
            noun={{ one: "tenant", other: "tenants" }}
          />
        }
        columns={[
          {
            key: "workspace",
            header: "Tenant",
            primary: true,
            cell: (tenant) => (
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-9 after:border-transparent">
                  {tenant.logoUrl && (
                    <AvatarImage
                      src={tenant.logoUrl}
                      alt=""
                      className="object-contain"
                    />
                  )}
                  <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-600">
                    {tenant.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{tenant.name}</span>
                  <span className="truncate text-xs text-slate-500">
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
            cell: (tenant) => (
              <span className="text-slate-700 tabular-nums">
                {`${tenant.seatsUsed} / ${
                  tenant.seatsLimit >= UNLIMITED_SEATS
                    ? "Unlimited"
                    : tenant.seatsLimit
                }`}
              </span>
            ),
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
              <div className="flex flex-col items-start gap-1">
                {tenant.deletedAt ? (
                  <ToneBadge tone="red">Deleted</ToneBadge>
                ) : (
                  <TenantStatusBadge status={tenant.status} />
                )}
                {tenant.deletedAt ? (
                  <span className="text-xs text-muted-foreground">
                    {tenant.deletedAt.slice(0, 10)}
                  </span>
                ) : (
                  tenant.status === "suspended" && (
                    <span className="text-xs text-muted-foreground">
                      {tenant.blockSource === "payment"
                        ? "Failed payments"
                        : "By an admin"}
                    </span>
                  )
                )}
              </div>
            ),
          },
          {
            key: "support",
            header: "Support Request",
            cell: (tenant) => {
              const s = supportOf(tenant);

              return s.open.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setSupportTarget({
                      tenantId: tenant.id,
                      requestId: s.open.length === 1 ? s.open[0].id : null,
                    })
                  }
                  className="inline-flex h-6 items-center gap-1.5 rounded-md bg-red-50 px-2 text-xs font-semibold whitespace-nowrap text-red-700 ring-1 ring-red-600/15 transition-colors outline-none ring-inset hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500/50 dark:bg-red-950/60 dark:text-red-300"
                >
                  <LifeBuoy className="size-3.5" aria-hidden />
                  {s.open.length} Open
                </button>
              ) : (
                <span className="text-muted-foreground">—</span>
              );
            },
          },
          {
            key: "created",
            header: "Created",
            cell: (tenant) => (
              <span className="whitespace-nowrap text-slate-500 tabular-nums">
                {tenant.createdAt}
              </span>
            ),
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            cell: (tenant) => {
              const deleted = tenant.deletedAt !== null;
              const canBlock =
                !deleted &&
                (tenant.status === "active" ||
                  tenant.status === "trialing" ||
                  tenant.status === "past_due");
              const open = (kind: Lifecycle) =>
                setLifecycle({ kind, tenantId: tenant.id });

              return (
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={PLATFORM_ICON_BUTTON}
                    aria-label={`View ${tenant.name}`}
                    title="View tenant and support requests"
                    onClick={() =>
                      setSupportTarget({ tenantId: tenant.id, requestId: null })
                    }
                  >
                    <Eye className="size-4" aria-hidden />
                  </Button>
                  {supportOf(tenant).accessActive && (
                    <InPersonViewLink tenant={tenant} compact />
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={PLATFORM_ICON_BUTTON}
                        aria-label={`More actions for ${tenant.name}`}
                      >
                        <MoreHorizontal className="size-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        className="cursor-pointer p-2"
                        onSelect={() =>
                          setSupportTarget({
                            tenantId: tenant.id,
                            requestId: null,
                          })
                        }
                      >
                        <LifeBuoy className="size-4" aria-hidden />
                        Support requests
                      </DropdownMenuItem>
                      {tenant.trialEndsAt && (
                        <DropdownMenuItem
                          className="cursor-pointer p-2"
                          onSelect={() => open("trial")}
                        >
                          <CalendarPlus className="size-4" aria-hidden />
                          Extend trial
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {deleted && (
                        <DropdownMenuItem
                          className="cursor-pointer p-2"
                          onSelect={() => open("restore")}
                        >
                          <RotateCcw className="size-4" aria-hidden />
                          Restore workspace
                        </DropdownMenuItem>
                      )}
                      {canBlock && (
                        <DropdownMenuItem
                          variant="destructive"
                          className="cursor-pointer p-2"
                          onSelect={() => setBlockingId(tenant.id)}
                        >
                          <Ban className="size-4" aria-hidden />
                          Block workspace
                        </DropdownMenuItem>
                      )}
                      {!deleted && tenant.status === "suspended" && (
                        <DropdownMenuItem
                          className="cursor-pointer p-2"
                          onSelect={() => setBlockingId(tenant.id)}
                        >
                          <LockOpen className="size-4" aria-hidden />
                          Unblock workspace
                        </DropdownMenuItem>
                      )}
                      {!deleted && (
                        <DropdownMenuItem
                          variant="destructive"
                          className="cursor-pointer p-2"
                          onSelect={() => open("delete")}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          Delete workspace
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            },
          },
        ]}
      />

      <Dialog
        open={Boolean(blocking)}
        onOpenChange={(open) => !open && setBlockingId(null)}
      >
        <DialogContent
          className={cn(
            "max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-lg",
            TEAM_DIALOG_CONTENT,
          )}
        >
          {blocking && (
            <WorkspaceBlockDialog
              key={blocking.id}
              tenant={blocking}
              onClose={() => setBlockingId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(lifecycleTenant)}
        onOpenChange={(open) => !open && closeLifecycle()}
      >
        <DialogContent
          className={cn(
            "max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-lg",
            TEAM_DIALOG_CONTENT,
          )}
        >
          {lifecycleTenant && lifecycle?.kind === "delete" && (
            <WorkspaceDeleteDialog
              key={lifecycleTenant.id}
              tenant={lifecycleTenant}
              onClose={closeLifecycle}
            />
          )}
          {lifecycleTenant && lifecycle?.kind === "restore" && (
            <WorkspaceRestoreDialog
              key={lifecycleTenant.id}
              tenant={lifecycleTenant}
              onClose={closeLifecycle}
            />
          )}
          {lifecycleTenant && lifecycle?.kind === "trial" && (
            <ExtendTrialDialog
              key={lifecycleTenant.id}
              tenant={lifecycleTenant}
              onClose={closeLifecycle}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(supportTenant)}
        onOpenChange={(open) => !open && setSupportTarget(null)}
      >
        <DialogContent
          className={cn(
            "max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-3xl",
            TEAM_DIALOG_CONTENT,
          )}
        >
          {supportTenant && (
            <TenantSupportDialog
              key={supportTenant.id}
              tenant={supportTenant}
              requests={supportOf(supportTenant).requests}
              initialRequestId={supportTarget?.requestId}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
