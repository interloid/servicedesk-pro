"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CircleDollarSign,
  Clock,
  Percent,
  Smile,
  Ticket,
  TimerReset,
  UserMinus,
} from "lucide-react";

import { ModalNotice } from "@/components/shared/modal-notice";
import { cn } from "@/lib/utils";

import { formatCurrency, formatNumber } from "../format";
import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  type PlatformAnalytics,
  type PlatformOverview,
  type PlatformPlan,
} from "../types";
import { MonthlyBarChart } from "./monthly-bar-chart";
import {
  DataTable,
  FilterSelect,
  PLATFORM_CARD,
  PLATFORM_STAT_GRID,
  PlatformPageHeader,
  TablePaginationFooter,
} from "./platform-ui";
import { StatCard } from "./stat-card";
import { useTablePagination } from "./use-table-pagination";

// Passed the palette validator against the card surface (light mode).
const TEAL = "#0d9488";
const RED = "#dc2626";

function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 60 * 24) return `${(minutes / 60).toFixed(1)} h`;

  return `${(minutes / (60 * 24)).toFixed(1)} d`;
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(PLATFORM_CARD, "flex flex-col gap-4 p-4 sm:p-5")}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function AnalyticsDashboard({
  overview,
  plans,
  analytics,
  range,
}: {
  overview: PlatformOverview;
  plans: PlatformPlan[];
  analytics:
    | { available: true; data: PlatformAnalytics }
    | { available: false; missing: boolean };
  range: AnalyticsRange;
}) {
  const router = useRouter();
  const { pageRows: planRows, footer: plansFooter } = useTablePagination(plans);
  const { metrics, revenueSeries } = overview;
  const data = analytics.available ? analytics.data : null;

  const arpu = metrics.payingTenants ? metrics.mrr / metrics.payingTenants : 0;
  const paidShare = metrics.activeTenants
    ? (metrics.payingTenants / metrics.activeTenants) * 100
    : 0;
  const churned = revenueSeries.reduce((sum, point) => sum + point.churned, 0);
  const liveWorkspaces = data?.workspaces.filter((w) => w.status === "active");
  const usedWorkspaces =
    liveWorkspaces?.filter((w) => w.tickets > 0).length ?? 0;
  const rangeLabel = ANALYTICS_RANGES[range].label.toLowerCase();

  return (
    <div className="flex flex-col gap-6">
      <PlatformPageHeader
        title="Analytics & Reports"
        description="Revenue, growth and how workspaces use the product."
        action={
          <div className="w-full sm:w-44">
            <FilterSelect
              label="Date range"
              value={range}
              onChange={(value) =>
                router.push(
                  value === "30d"
                    ? "/platform/analytics"
                    : `/platform/analytics?range=${value}`,
                )
              }
              options={Object.entries(ANALYTICS_RANGES).map(
                ([value, item]) => ({ value, label: item.label }),
              )}
            />
          </div>
        }
      />

      {!analytics.available && (
        <ModalNotice icon={AlertTriangle} tone="danger">
          {analytics.missing
            ? "Ticket and usage figures need migration 20261103130000_platform_analytics, which isn't on this database yet."
            : "The usage figures couldn't be read. Check the server logs."}
        </ModalNotice>
      )}

      <div className={PLATFORM_STAT_GRID}>
        <StatCard
          label="Average revenue per paying workspace"
          value={formatCurrency(Math.round(arpu * 100) / 100)}
          hint={`${formatCurrency(metrics.mrr)} MRR`}
          icon={CircleDollarSign}
        />
        <StatCard
          label="Workspaces on a paid plan"
          value={`${paidShare.toFixed(0)}%`}
          hint={`${metrics.payingTenants} of ${metrics.activeTenants} live`}
          icon={Percent}
          iconClassName="bg-sky-50 text-sky-700"
        />
        <StatCard
          label="Cancelled, last 12 months"
          value={formatNumber(churned)}
          hint={`${metrics.churnedThisMonth} this month`}
          icon={UserMinus}
          iconClassName="bg-red-50 text-red-600"
        />
        <StatCard
          label={`Workspaces with tickets, ${rangeLabel}`}
          value={
            liveWorkspaces
              ? `${usedWorkspaces} / ${liveWorkspaces.length}`
              : "—"
          }
          icon={Building2}
          iconClassName="bg-violet-50 text-violet-700"
        />
        <StatCard
          label={`Tickets created, ${rangeLabel}`}
          value={data ? formatNumber(data.tickets.created) : "—"}
          hint={
            data ? `${formatNumber(data.tickets.resolved)} resolved` : undefined
          }
          icon={Ticket}
        />
        <StatCard
          label="Median first response"
          value={formatDuration(data?.tickets.median_first_response_minutes)}
          icon={Clock}
          iconClassName="bg-sky-50 text-sky-700"
        />
        <StatCard
          label="Median resolution time"
          value={formatDuration(data?.tickets.median_resolution_minutes)}
          icon={TimerReset}
          iconClassName="bg-violet-50 text-violet-700"
        />
        <StatCard
          label="Customer satisfaction"
          value={data?.csat?.average != null ? `${data.csat.average} / 5` : "—"}
          hint={
            data?.csat ? `${formatNumber(data.csat.count)} ratings` : undefined
          }
          icon={Smile}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          title="Revenue collected"
          description="Paid invoices by month, last 12 months."
        >
          <MonthlyBarChart
            data={revenueSeries}
            series={[{ key: "revenue", name: "Revenue", color: TEAL }]}
            formatValue={(value) =>
              `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
            }
          />
        </ChartCard>

        <ChartCard
          title="New and cancelled workspaces"
          description="By month, last 12 months."
        >
          <MonthlyBarChart
            data={revenueSeries}
            series={[
              { key: "newTenants", name: "New", color: TEAL },
              { key: "churned", name: "Cancelled", color: RED },
            ]}
          />
        </ChartCard>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-foreground">Revenue by plan</h2>
        <DataTable
          rows={planRows}
          rowKey={(plan) => plan.id}
          empty="No plans found."
          footer={
            <TablePaginationFooter
              {...plansFooter}
              noun={{ one: "plan", other: "plans" }}
            />
          }
          columns={[
            {
              key: "plan",
              header: "Plan",
              primary: true,
              cell: (plan) => (
                <span className="font-semibold">{plan.name}</span>
              ),
            },
            {
              key: "workspaces",
              header: "Live workspaces",
              cell: (plan) => formatNumber(plan.workspaces),
            },
            {
              key: "price",
              header: "Price / month",
              cell: (plan) => formatCurrency(plan.price),
            },
            {
              key: "mrr",
              header: "MRR",
              align: "right",
              cell: (plan) => formatCurrency(plan.mrr),
            },
          ]}
        />
      </section>
    </div>
  );
}
