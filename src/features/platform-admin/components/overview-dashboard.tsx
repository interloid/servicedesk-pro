"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CreditCard,
  DollarSign,
  Gauge,
  LayoutDashboard,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Ticket,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  useActiveTooltipDataPoints,
  Pie,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  KPI_HINT,
  KPI_ICON,
  KPI_LABEL,
  KPI_TILE,
  KPI_VALUE,
  PLATFORM_BUTTON,
  PLATFORM_CARD,
  PlatformEmpty,
  PlatformPageHeader,
  PlatformSectionHeading,
} from "./platform-ui";
import { KpiTooltip } from "./kpi-tooltip";
import {
  CHART_COLORS,
  CHART_TICK,
  CHART_TOOLTIP_ITEM,
  CHART_TOOLTIP_LABEL,
  CHART_TOOLTIP_STYLE,
} from "./chart-theme";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "../format";
import type { PlatformOverview } from "../types";

/* ------------------------------------------------------------------ */
/* Local building blocks (Overview only)                               */
/* ------------------------------------------------------------------ */

type KpiTone = "brand" | "emerald" | "violet" | "amber" | "sky" | "rose";

/** Icon circle classes and the sparkline colour for each KPI tone. */
const KPI_TONES: Record<KpiTone, { icon: string; stroke: string }> = {
  brand: { icon: "bg-brand-50 text-brand-700", stroke: "#0f766e" },
  emerald: { icon: "bg-emerald-50 text-emerald-600", stroke: "#059669" },
  violet: { icon: "bg-violet-50 text-violet-600", stroke: "#7c3aed" },
  amber: { icon: "bg-amber-50 text-amber-600", stroke: "#d97706" },
  sky: { icon: "bg-sky-50 text-sky-600", stroke: "#0284c7" },
  rose: { icon: "bg-rose-50 text-rose-600", stroke: "#e11d48" },
};

/** Tiny trend line for a KPI; decorative, the figure beside it is the data. */
/**
 * A KPI's 12-month trend: the line (hover a month to see its value), and
 * under it the change against last month, so the shape has a meaning.
 */
function Sparkline({
  data,
  dataKey,
  tone,
  format = (value) => formatNumber(value),
}: {
  data: Array<{ month: string } & Record<string, unknown>>;
  dataKey: string;
  tone: KpiTone;
  /** How a value reads in the tooltip and the change line. */
  format?: (value: number) => string;
}) {
  const color = KPI_TONES[tone].stroke;
  const id = `spark-${tone}-${dataKey}`;
  const values = data.map((point) => Number(point[dataKey]) || 0);
  const current = values.at(-1) ?? 0;
  const previous = values.at(-2) ?? 0;
  const change = current - previous;
  const ChangeIcon = change > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="hidden w-28 shrink-0 flex-col items-end gap-1 sm:flex">
      <div className="h-11 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, left: 4, bottom: 2 }}
          >
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              cursor={{ stroke: color, strokeOpacity: 0.25 }}
              allowEscapeViewBox={{ x: true, y: true }}
              position={{ y: -34 }}
              wrapperStyle={{ zIndex: 20, outline: "none" }}
              content={({ active, payload }) => {
                const point = payload?.[0];
                if (!active || !point) return null;
                return (
                  <div className="rounded-md border border-border bg-card px-2 py-1 text-xs whitespace-nowrap shadow-md">
                    <span className="text-slate-500">
                      {(point.payload as { month: string }).month}
                    </span>{" "}
                    <span className="font-semibold text-foreground tabular-nums">
                      {format(Number(point.value) || 0)}
                    </span>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${id})`}
              dot={false}
              activeDot={{
                r: 3.5,
                strokeWidth: 2,
                stroke: "#fff",
                fill: color,
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <span className="flex items-center gap-1 text-[11px] leading-none whitespace-nowrap text-slate-400">
        12-mo trend
        {change !== 0 && (
          <span
            className={cn(
              "inline-flex items-center font-semibold tabular-nums",
              change > 0 ? "text-emerald-600" : "text-red-600",
            )}
            title="Change against last month"
          >
            <ChangeIcon className="size-3" aria-hidden />
            {format(Math.abs(change))}
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * KPI card: round icon on the left, then the figure, its label and a line of
 * context, with an optional sparkline on the right. The figure stays in its
 * own text node.
 */
function KpiCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone = "brand",
  trend,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  icon: LucideIcon;
  tone?: KpiTone;
  trend?: ReactNode;
}) {
  return (
    <KpiTooltip label={label} hint={hint}>
      <div className={cn(PLATFORM_CARD, KPI_TILE)}>
        <div className="flex items-start justify-between gap-3">
          <p data-kpi-text className={KPI_LABEL}>
            {label}
          </p>
          <span className={cn(KPI_ICON, KPI_TONES[tone].icon)}>
            <Icon className="size-4" strokeWidth={ICON_STROKE} aria-hidden />
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              <span className={KPI_VALUE}>{value}</span>
              {unit && (
                <span className="text-xs font-medium text-slate-500">
                  {unit}
                </span>
              )}
            </p>
            <p data-kpi-text className={KPI_HINT}>
              {hint}
            </p>
          </div>
          {trend}
        </div>
      </div>
    </KpiTooltip>
  );
}

/** Card with an icon-led header, used for every chart and list below. */
function OverviewPanel({
  title,
  description,
  icon: Icon,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(PLATFORM_CARD, "flex min-w-0 flex-col", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <Icon className="size-4.5" strokeWidth={ICON_STROKE} aria-hidden />
          </span>
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

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
      <span
        className="size-2.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}

/**
 * Reports the donut slice under the pointer, using the same hover detection
 * as Recharts' tooltip (its slice mouse events report the wrong slice).
 */
function ActivePlanSync({
  onChange,
}: {
  onChange: (name: string | null) => void;
}) {
  const points = useActiveTooltipDataPoints<{ name?: string }>();
  const name = points?.[0]?.name ?? null;
  useEffect(() => {
    onChange(name);
  }, [name, onChange]);
  return null;
}

/** Axis labels a touch larger than the shared default, for readability. */
const AXIS_TICK = { ...CHART_TICK, fontSize: 12 };

/** One stroke weight for every icon on the page (matches the sidebar). */
const ICON_STROKE = 1.75;

/** "$1.2k" style ticks so the money axis stays narrow. */
function compactCurrency(value: unknown) {
  const n = Number(value);
  if (n >= 1000) {
    const k = n / 1000;
    return `$${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return `$${n}`;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function OverviewDashboard({
  overview,
}: {
  overview: PlatformOverview;
}) {
  const {
    metrics,
    tenants,
    revenueSeries: REVENUE_SERIES,
    planDistribution: PLAN_DISTRIBUTION,
  } = overview;
  const planTotal = PLAN_DISTRIBUTION.reduce((s, p) => s + p.value, 0);
  // The plan under the pointer: a legend row wins over a donut slice.
  const [chartPlan, setChartPlan] = useState<string | null>(null);
  const [legendPlan, setLegendPlan] = useState<string | null>(null);
  const activeName = legendPlan ?? chartPlan;
  const activeSlice =
    PLAN_DISTRIBUTION.find((p) => p.name === activeName) ?? null;
  const activePlan = activeSlice
    ? PLAN_DISTRIBUTION.indexOf(activeSlice)
    : null;
  const topTenants = [...tenants]
    .filter((t) => t.mrr > 0)
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <PlatformPageHeader
        eyebrow="Manage platform"
        icon={LayoutDashboard}
        title="Platform overview"
        description="Here's what's happening across every workspace, from live platform data."
        action={
          <Button
            asChild
            className={`${PLATFORM_BUTTON} w-full gap-1.5 bg-brand-700 text-white hover:bg-brand-800 sm:w-auto`}
          >
            <Link href="/platform/tenants">
              Manage tenants
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      {/* KPIs */}
      <section className="flex flex-col gap-3">
        <PlatformSectionHeading
          icon={Gauge}
          title="Key metrics"
          description="Tenants, revenue, users and tickets across the platform."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label="Total tenants"
            value={String(metrics.totalTenants)}
            hint={`${metrics.activeTenants} active`}
            icon={Building2}
            tone="brand"
          />
          <KpiCard
            label="Monthly revenue"
            value={formatCurrency(metrics.mrr)}
            unit="/ mo"
            hint="from paid plans"
            icon={DollarSign}
            tone="emerald"
            trend={
              <Sparkline
                data={REVENUE_SERIES}
                dataKey="revenue"
                tone="emerald"
                format={(value) => formatCurrency(value)}
              />
            }
          />
          <KpiCard
            label="Paying tenants"
            value={String(metrics.payingTenants)}
            hint={`${metrics.payingTenants} of ${metrics.totalTenants} tenants`}
            icon={CreditCard}
            tone="violet"
          />
          <KpiCard
            label="Active users"
            value={String(metrics.activeUsers)}
            hint="across all workspaces"
            icon={Users}
            tone="sky"
          />
          <KpiCard
            label="Open tickets"
            value={String(metrics.openTickets)}
            hint="platform-wide, all queues"
            icon={Ticket}
            tone="rose"
          />
          <KpiCard
            label="Signups / churn"
            value={String(metrics.signupsThisMonth)}
            unit="this month"
            hint={`${metrics.churnedThisMonth} churned`}
            icon={TrendingUp}
            tone="amber"
            trend={
              <Sparkline
                data={REVENUE_SERIES}
                dataKey="newTenants"
                tone="amber"
              />
            }
          />
        </div>
      </section>

      {/* Revenue + plan distribution */}
      <section className="flex flex-col gap-3">
        <PlatformSectionHeading
          icon={Wallet}
          title="Revenue"
          description="What workspaces pay, and which plans they're on."
        />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <OverviewPanel
            title="Revenue collected"
            description="Paid invoices, last 12 months, platform-wide"
            icon={LineChartIcon}
            className="xl:col-span-2"
            bodyClassName="flex flex-col pt-4"
            action={<LegendDot color={CHART_COLORS.primary} label="Revenue" />}
          >
            <div className="h-60 w-full xl:h-auto xl:min-h-60 xl:flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={REVENUE_SERIES}
                  margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={CHART_COLORS.primary}
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="100%"
                        stopColor={CHART_COLORS.primary}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_COLORS.grid}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={AXIS_TICK}
                    tickMargin={8}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={AXIS_TICK}
                    tickFormatter={compactCurrency}
                    width={44}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatCurrency(Number(value)),
                      "Revenue",
                    ]}
                    cursor={{
                      stroke: CHART_COLORS.primary,
                      strokeOpacity: 0.3,
                      strokeDasharray: "4 4",
                    }}
                    labelStyle={CHART_TOOLTIP_LABEL}
                    itemStyle={CHART_TOOLTIP_ITEM}
                    contentStyle={CHART_TOOLTIP_STYLE}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    fill="url(#mrrFill)"
                    dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS.primary }}
                    activeDot={{
                      r: 5,
                      strokeWidth: 2,
                      stroke: "#ffffff",
                      fill: CHART_COLORS.primary,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </OverviewPanel>

          <OverviewPanel
            title="Plan distribution"
            description="Active tenants by plan"
            icon={PieChartIcon}
            bodyClassName="flex flex-col justify-center"
          >
            {planTotal === 0 ? (
              <PlatformEmpty icon={PieChartIcon}>
                No active tenants on any plan yet.
              </PlatformEmpty>
            ) : (
              <div className="flex flex-col items-center gap-6 sm:flex-row xl:flex-col 2xl:flex-row">
                <div className="relative size-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={PLAN_DISTRIBUTION}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={54}
                        outerRadius={84}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {PLAN_DISTRIBUTION.map((slice, index) => (
                          <Cell
                            key={slice.name}
                            fill={slice.color}
                            fillOpacity={
                              activePlan === null || activePlan === index
                                ? 1
                                : 0.3
                            }
                            className="outline-none [transition:fill-opacity_150ms]"
                          />
                        ))}
                      </Pie>
                      {/*
                      Invisible: it only drives Recharts' hover detection,
                      which ActivePlanSync reads. The readout sits in the
                      donut's hole instead of a box covering the ring.
                    */}
                      <Tooltip content={() => null} cursor={false} />
                      <ActivePlanSync onChange={setChartPlan} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/*
                  The donut's hole shows the total, or the hovered plan in
                  place of a floating tooltip that would cover the ring. The
                  list beside it carries the same data.
                */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
                  >
                    <span className="text-2xl leading-none font-bold text-foreground tabular-nums">
                      {activeSlice ? activeSlice.value : planTotal}
                    </span>
                    <span className="mt-1 max-w-24 truncate text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                      {activeSlice ? activeSlice.name : "tenants"}
                    </span>
                    {activeSlice && (
                      <span className="mt-0.5 text-[11px] font-semibold text-slate-400 tabular-nums">
                        {Math.round((activeSlice.value / planTotal) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
                <ul className="flex w-full min-w-0 flex-1 flex-col divide-y divide-slate-100!">
                  {PLAN_DISTRIBUTION.map((slice, index) => (
                    <li
                      key={slice.name}
                      onMouseEnter={() => setLegendPlan(slice.name)}
                      onMouseLeave={() => setLegendPlan(null)}
                      className={cn(
                        "-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 text-sm transition-colors",
                        activePlan === index && "bg-slate-50",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5 font-medium text-foreground">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: slice.color }}
                          aria-hidden
                        />
                        <span className="truncate">{slice.name}</span>
                      </span>
                      <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                        <span className="font-semibold text-foreground">
                          {slice.value}
                        </span>
                        <span className="w-10 text-right text-xs text-slate-500">
                          {planTotal
                            ? Math.round((slice.value / planTotal) * 100)
                            : 0}
                          %
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </OverviewPanel>
        </div>
      </section>

      {/* New vs churned + top tenants */}
      <section className="flex flex-col gap-3">
        <PlatformSectionHeading
          icon={TrendingUp}
          title="Growth"
          description="New and cancelled workspaces, and who pays the most."
        />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <OverviewPanel
            title="New vs churned tenants"
            description="Monthly movement across the last 12 months"
            icon={BarChart3}
            className="xl:col-span-2"
            bodyClassName="flex flex-col pt-4"
            action={
              <div className="flex items-center gap-4">
                <LegendDot color={CHART_COLORS.primary} label="New" />
                <LegendDot color={CHART_COLORS.danger} label="Churned" />
              </div>
            }
          >
            <div className="h-56 w-full xl:h-auto xl:min-h-56 xl:flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={REVENUE_SERIES}
                  margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
                  barGap={3}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_COLORS.grid}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={AXIS_TICK}
                    tickMargin={8}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={AXIS_TICK}
                    width={28}
                  />
                  <Tooltip
                    cursor={{ fill: CHART_COLORS.cursor }}
                    labelStyle={CHART_TOOLTIP_LABEL}
                    itemStyle={CHART_TOOLTIP_ITEM}
                    contentStyle={CHART_TOOLTIP_STYLE}
                  />
                  <Bar
                    dataKey="newTenants"
                    name="New"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                  >
                    {REVENUE_SERIES.map((point, index) => (
                      <Cell
                        key={`new-${index}`}
                        fill={
                          index === REVENUE_SERIES.length - 1
                            ? CHART_COLORS.primary
                            : CHART_COLORS.primarySoft
                        }
                      />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="churned"
                    name="Churned"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                  >
                    {REVENUE_SERIES.map((point, index) => (
                      <Cell
                        key={`churn-${index}`}
                        fill={
                          index === REVENUE_SERIES.length - 1
                            ? CHART_COLORS.danger
                            : CHART_COLORS.dangerSoft
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              The current month is shown in full colour.
            </p>
          </OverviewPanel>

          <OverviewPanel
            title="Top tenants by MRR"
            description="Highest monthly recurring revenue"
            icon={Trophy}
            bodyClassName="px-5 pt-2 pb-3"
            action={
              <Link
                href="/platform/tenants"
                className="inline-flex items-center gap-1 rounded-md text-xs font-semibold text-brand-700 hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                View all
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            {topTenants.length === 0 ? (
              <PlatformEmpty icon={Building2}>
                No workspaces on a paid plan yet.
              </PlatformEmpty>
            ) : (
              <ol className="flex flex-col divide-y divide-slate-100!">
                {topTenants.map((tenant) => (
                  <li key={tenant.id} className="flex items-center gap-3 py-3">
                    <Avatar className="size-9 after:border-transparent">
                      <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-600">
                        {tenant.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {tenant.name}
                      </span>
                      <span className="truncate text-xs text-slate-500">
                        {tenant.plan} · {tenant.seatsUsed}{" "}
                        {tenant.seatsUsed === 1 ? "seat" : "seats"}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                      {formatCurrency(tenant.mrr)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </OverviewPanel>
        </div>
      </section>
    </div>
  );
}
