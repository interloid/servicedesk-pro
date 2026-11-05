"use client";

import { useMemo, useState } from "react";
import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TEAM_DIALOG_CONTENT,
  TEAM_DIALOG_TITLE,
} from "@/features/team/components/modal-buttons";
import { cn } from "@/lib/utils";

import { formatCurrency, formatDate } from "../format";
import {
  UNLIMITED_SEATS,
  type PlatformSubscription,
  type SubscriptionStage,
} from "../types";
import {
  DataTable,
  FilterTabs,
  PLATFORM_ICON_BUTTON,
  PlatformFilterBar,
  SearchField,
  TablePaginationFooter,
} from "./platform-ui";
import { ToneBadge, type BadgeTone } from "./status-badge";
import { useTablePagination } from "./use-table-pagination";

type Filter =
  "all" | "active" | "trialing" | "past_due" | "cancelling" | "ended";

const FILTERS: Array<{ label: string; value: Filter }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Trialing", value: "trialing" },
  { label: "Past due", value: "past_due" },
  { label: "Cancelling", value: "cancelling" },
  { label: "Cancelled", value: "ended" },
];

const STAGES: Record<SubscriptionStage, { label: string; tone: BadgeTone }> = {
  active: { label: "Active", tone: "green" },
  trialing: { label: "Trialing", tone: "blue" },
  past_due: { label: "Past due", tone: "amber" },
  cancelling: { label: "Cancelling", tone: "amber" },
  cancelled: { label: "Cancelled", tone: "red" },
  expired: { label: "Expired", tone: "muted" },
};

function StageBadge({ stage }: { stage: SubscriptionStage }) {
  return <ToneBadge tone={STAGES[stage].tone}>{STAGES[stage].label}</ToneBadge>;
}

function matches(row: PlatformSubscription, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "ended") {
    return row.stage === "cancelled" || row.stage === "expired";
  }

  return row.stage === filter;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium break-words text-foreground">
        {value}
      </span>
    </div>
  );
}

function SubscriptionDetails({ row }: { row: PlatformSubscription }) {
  const showCancellation =
    row.stage === "cancelled" ||
    row.stage === "expired" ||
    row.stage === "cancelling";
  const paymentTrouble = row.paymentFailures > 0 || Boolean(row.graceEndsAt);

  return (
    <>
      <DialogHeader>
        <DialogTitle className={TEAM_DIALOG_TITLE}>
          {row.tenantName}
        </DialogTitle>
        <DialogDescription>
          {row.plan} plan{row.tenantSlug ? ` · /${row.tenantSlug}` : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="divide-y divide-muted">
            <Detail label="Status" value={<StageBadge stage={row.stage} />} />
            <Detail
              label="Owner"
              value={
                row.ownerEmail ? `${row.owner} (${row.ownerEmail})` : row.owner
              }
            />
            <Detail
              label="Seats"
              value={row.seats >= UNLIMITED_SEATS ? "Unlimited" : row.seats}
            />
            <Detail label="MRR" value={formatCurrency(row.mrr)} />
            <Detail
              label="Total paid"
              value={formatCurrency(row.lifetimePaid)}
            />
            <Detail label="Started" value={formatDate(row.startedAt)} />
            <Detail
              label="Current period ends"
              value={formatDate(row.periodEnd)}
            />
            <Detail label="PayPal subscription" value={row.paypalId ?? "—"} />
            <Detail label="PayPal status" value={row.paypalStatus ?? "—"} />
            {row.nextPlan && (
              <Detail
                label="Scheduled change"
                value={`${row.nextPlan} on ${formatDate(row.nextPlanAt)}`}
              />
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {showCancellation && (
            <section>
              <h3 className="text-sm font-semibold text-foreground">
                Cancellation
              </h3>
              <div className="divide-y divide-muted">
                <Detail
                  label="Cancelled on"
                  value={formatDate(row.cancelledAt)}
                />
                <Detail
                  label={
                    row.cancelledByEmail
                      ? "Last billing change by"
                      : "Cancelled by"
                  }
                  value={
                    row.cancelledBy
                      ? row.cancelledByEmail
                        ? `${row.cancelledBy} (${row.cancelledByEmail})`
                        : row.cancelledBy
                      : "Not recorded"
                  }
                />
                {row.stage === "cancelling" && (
                  <Detail
                    label="Access ends"
                    value={formatDate(row.periodEnd)}
                  />
                )}
              </div>
            </section>
          )}

          {paymentTrouble && (
            <section>
              <h3 className="text-sm font-semibold text-foreground">
                Payment failures
              </h3>
              <div className="divide-y divide-muted">
                <Detail label="Failed attempts" value={row.paymentFailures} />
                <Detail
                  label="Last failure"
                  value={formatDate(row.lastPaymentFailureAt)}
                />
                <Detail
                  label="Grace period ends"
                  value={formatDate(row.graceEndsAt)}
                />
              </div>
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold text-foreground">
              Recent invoices
            </h3>
            {row.invoices.length === 0 ? (
              <p className="py-1.5 text-sm text-muted-foreground">
                No invoices yet.
              </p>
            ) : (
              <div className="divide-y divide-muted">
                {row.invoices.map((invoice, index) => (
                  <Detail
                    key={`${invoice.number}-${index}`}
                    label={`${invoice.number} · ${formatDate(invoice.date)}`}
                    value={`${formatCurrency(invoice.amount)} · ${invoice.status}`}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export function SubscriptionsTable({
  subscriptions,
}: {
  subscriptions: PlatformSubscription[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const searched = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return subscriptions.filter(
      (row) =>
        !needle ||
        [
          row.tenantName,
          row.tenantSlug,
          row.owner,
          row.ownerEmail,
          row.cancelledBy ?? "",
          row.paypalId ?? "",
        ].some((text) => text.toLowerCase().includes(needle)),
    );
  }, [subscriptions, query]);

  const rows = searched.filter((row) => matches(row, filter));
  const selected = subscriptions.find((row) => row.id === selectedId);
  const { pageRows, resetPage, footer } = useTablePagination(rows);

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1">
      <PlatformFilterBar
        tabs={
          <FilterTabs
            label="Subscription status"
            value={filter}
            onChange={(value) => {
              setFilter(value);
              resetPage();
            }}
            options={FILTERS.map((item) => ({
              ...item,
              count: searched.filter((row) => matches(row, item.value)).length,
            }))}
          />
        }
        search={
          <SearchField
            value={query}
            onChange={(value) => {
              setQuery(value);
              resetPage();
            }}
            label="Search subscriptions"
            placeholder="Search workspace, owner…"
          />
        }
      />

      <DataTable
        rows={pageRows}
        rowKey={(row) => row.id}
        empty="No subscriptions match."
        scrollLabel="Subscriptions"
        summary={`${rows.length} subscription${rows.length === 1 ? "" : "s"}`}
        footer={
          <TablePaginationFooter
            {...footer}
            noun={{ one: "subscription", other: "subscriptions" }}
          />
        }
        columns={[
          {
            key: "workspace",
            header: "Workspace",
            primary: true,
            cell: (row) => (
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{row.tenantName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {row.ownerEmail || row.owner}
                </span>
              </div>
            ),
          },
          { key: "plan", header: "Plan", cell: (row) => row.plan },
          {
            key: "status",
            header: "Status",
            cell: (row) => <StageBadge stage={row.stage} />,
          },
          {
            key: "mrr",
            header: "MRR",
            cell: (row) => (
              <span className="tabular-nums">{formatCurrency(row.mrr)}</span>
            ),
          },
          {
            key: "period",
            header: "Period ends",
            cell: (row) => (
              <span className="text-muted-foreground">
                {formatDate(row.periodEnd)}
              </span>
            ),
          },
          {
            key: "cancelled",
            header: "Cancelled",
            cell: (row) =>
              row.cancelledAt || row.stage === "cancelling" ? (
                <div className="flex flex-col">
                  <span>{formatDate(row.cancelledAt)}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {row.cancelledBy ?? "Not recorded"}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            key: "details",
            header: <span className="sr-only">Details</span>,
            align: "right",
            cell: (row) => (
              <Button
                variant="outline"
                size="icon"
                className={PLATFORM_ICON_BUTTON}
                aria-label={`View ${row.tenantName} subscription`}
                onClick={() => setSelectedId(row.id)}
              >
                <Eye className="size-4" aria-hidden />
              </Button>
            ),
          },
        ]}
      />

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <DialogContent
          className={cn(
            "max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-3xl",
            TEAM_DIALOG_CONTENT,
          )}
        >
          {selected && <SubscriptionDetails row={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
