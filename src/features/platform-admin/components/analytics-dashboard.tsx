"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CircleDollarSign,
  Clock,
  Headphones,
  Layers,
  LineChart,
  Percent,
  Smile,
  Ticket,
  TimerReset,
  TrendingUp,
  UserMinus,
  type LucideIcon,
} from "lucide-react";

import { ModalNotice } from "@/components/shared/modal-notice";

import { formatCurrency, formatNumber } from "../format";
import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  type PlatformAnalytics,
  type PlatformOverview,
  type PlatformPlan,
} from "../types";
import { MonthlyBarChart } from "./monthly-bar-chart";
import { CHART_COLORS } from "./chart-theme";
import {
  DataTable,
  FilterSelect,
  PLATFORM_STAT_GRID,
  PlatformPageHeader,
  PlatformSectionHeading,
  PlatformPanel,
} from "./platform-ui";
import { StatCard } from "./stat-card";

// The console's shared chart palette (chart-theme.ts).
const TEAL = CHART_COLORS.primary;
const RED = CHART_COLORS.danger;

/** Plan dot colours by list position (cheapest first), as on the plan cards. */
const PLAN_DOTS = ["#94a3b8", TEAL, "#7c3aed", "#0284c7", "#d97706"];

function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 60 * 24) return `${(minutes / 60).toFixed(1)} h`;

  return `${(minutes / (60 * 24)).toFixed(1)} d`;
}

function ChartCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <PlatformPanel title={title} description={description} icon={icon}>
      {children}
    </PlatformPanel>
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
  const totalMrr = plans.reduce((sum, plan) => sum + plan.mrr, 0);

  return (
    <div className="flex flex-col gap-6">
      <PlatformPageHeader
        eyebrow="Billing &amp; product"
        icon={BarChart3}
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

      <section className="flex flex-col gap-3">
        <PlatformSectionHeading
          icon={TrendingUp}
          title="Revenue & growth"
          description="Earnings, paid share and how many workspaces stay."
        />
        <div className={PLATFORM_STAT_GRID}>
          <StatCard
            label="Average revenue per paying workspace"
            value={formatCurrency(Math.round(arpu * 100) / 100)}
            hint={`${formatCurrency(metrics.mrr)} MRR`}
            icon={CircleDollarSign}
            iconClassName="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            label="Workspaces on a paid plan"
            value={`${paidShare.toFixed(0)}%`}
            hint={`${metrics.payingTenants} of ${metrics.activeTenants} live`}
            icon={Percent}
            iconClassName="bg-brand-50 text-brand-700"
          />
          <StatCard
            label="Cancelled, last 12 months"
            value={formatNumber(churned)}
            hint={`${metrics.churnedThisMonth} this month`}
            icon={UserMinus}
            iconClassName="bg-rose-50 text-rose-600"
          />
          <StatCard
            label={`Workspaces with tickets, ${rangeLabel}`}
            value={
              liveWorkspaces
                ? `${usedWorkspaces} / ${liveWorkspaces.length}`
                : "—"
            }
            icon={Building2}
            iconClassName="bg-sky-50 text-sky-600"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <PlatformSectionHeading
          icon={Headphones}
          title="Support performance"
          description={`How workspaces handle tickets, ${rangeLabel}.`}
        />
        <div className={PLATFORM_STAT_GRID}>
          <StatCard
            label={`Tickets created, ${rangeLabel}`}
            value={data ? formatNumber(data.tickets.created) : "—"}
            hint={
              data
                ? `${formatNumber(data.tickets.resolved)} resolved`
                : undefined
            }
            icon={Ticket}
            iconClassName="bg-brand-50 text-brand-700"
          />
          <StatCard
            label="Median first response"
            value={formatDuration(data?.tickets.median_first_response_minutes)}
            icon={Clock}
            iconClassName="bg-sky-50 text-sky-600"
          />
          <StatCard
            label="Median resolution time"
            value={formatDuration(data?.tickets.median_resolution_minutes)}
            icon={TimerReset}
            iconClassName="bg-violet-50 text-violet-600"
          />
          <StatCard
            label="Customer satisfaction"
            value={
              data?.csat?.average != null ? `${data.csat.average} / 5` : "—"
            }
            hint={
              data?.csat
                ? `${formatNumber(data.csat.count)} ratings`
                : undefined
            }
            icon={Smile}
            iconClassName="bg-amber-50 text-amber-600"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <PlatformSectionHeading
          icon={LineChart}
          title="Trends"
          description="Month by month over the last 12 months."
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ChartCard
            icon={BarChart3}
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
            icon={Building2}
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
      </section>

      <section className="flex flex-col gap-3">
        <PlatformSectionHeading
          icon={Layers}
          title="Revenue by plan"
          description="Where monthly recurring revenue comes from."
        />
        <DataTable
          rows={plans}
          rowKey={(plan) => plan.id}
          empty="No plans found."
          columns={[
            {
              key: "plan",
              header: "Plan",
              primary: true,
              cell: (plan) => (
                <span className="flex items-center gap-2.5 font-semibold">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        PLAN_DOTS[plans.indexOf(plan) % PLAN_DOTS.length],
                    }}
                  />
                  {plan.name}
                </span>
              ),
            },
            {
              key: "workspaces",
              header: "Live workspaces",
              cell: (plan) => (
                <span className="tabular-nums">
                  {formatNumber(plan.workspaces)}
                </span>
              ),
            },
            {
              key: "price",
              header: "Price / month",
              cell: (plan) => (
                <span className="text-slate-600 tabular-nums">
                  {formatCurrency(plan.price)}
                </span>
              ),
            },
            {
              key: "share",
              header: "Share of MRR",
              cell: (plan) => {
                const share = totalMrr ? (plan.mrr / totalMrr) * 100 : 0;
                return (
                  <span className="flex min-w-32 items-center gap-2.5">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${share}%`,
                          backgroundColor:
                            PLAN_DOTS[plans.indexOf(plan) % PLAN_DOTS.length],
                        }}
                      />
                    </span>
                    <span className="w-9 text-right text-xs text-slate-500 tabular-nums">
                      {share.toFixed(0)}%
                    </span>
                  </span>
                );
              },
            },
            {
              key: "mrr",
              header: "MRR",
              align: "right",
              cell: (plan) => (
                <span className="font-semibold tabular-nums">
                  {formatCurrency(plan.mrr)}
                </span>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
