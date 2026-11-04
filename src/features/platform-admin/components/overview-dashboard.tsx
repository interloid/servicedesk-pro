"use client";

import Link from "next/link";
import {
  Building2,
  DollarSign,
  CreditCard,
  Users,
  Ticket,
  TrendingUp,
  ArrowRight,
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
  Pie,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PLATFORM_BUTTON, PlatformPageHeader } from "./platform-ui";
import { StatCard } from "./stat-card";
import { formatCurrency } from "../format";
import type { PlatformOverview } from "../types";

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
  const topTenants = [...tenants]
    .filter((t) => t.mrr > 0)
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <PlatformPageHeader
        title="Platform overview"
        description="Business-level metrics across every workspace, from live platform data."
        action={
          <Button
            variant="outline"
            asChild
            className={`${PLATFORM_BUTTON} w-full gap-1.5 sm:w-auto`}
          >
            <Link href="/platform/tenants">
              Manage tenants
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total tenants"
          value={String(metrics.totalTenants)}
          hint={`${metrics.activeTenants} active`}
          icon={Building2}
        />
        <StatCard
          label="Monthly revenue"
          value={formatCurrency(metrics.mrr)}
          hint="active workspaces on paid plans"
          icon={DollarSign}
          iconClassName="bg-teal-50 text-teal-700"
        />
        <StatCard
          label="Paying tenants"
          value={String(metrics.payingTenants)}
          hint={`${metrics.payingTenants} of ${metrics.totalTenants} tenants`}
          icon={CreditCard}
          iconClassName="bg-sky-50 text-sky-700"
        />
        <StatCard
          label="Active users"
          value={String(metrics.activeUsers)}
          hint="across all workspaces"
          icon={Users}
          iconClassName="bg-indigo-50 text-indigo-700"
        />
        <StatCard
          label="Open tickets"
          value={String(metrics.openTickets)}
          hint="platform-wide, all queues"
          icon={Ticket}
        />
        <StatCard
          label="Signups / churn"
          value={String(metrics.signupsThisMonth)}
          hint={`${metrics.churnedThisMonth} churned`}
          icon={TrendingUp}
          iconClassName="bg-amber-50 text-amber-700"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="rounded-[14px] border-border bg-card p-4 shadow-xs ring-0 sm:p-5 xl:col-span-2">
          <div className="mb-4">
            <p className="text-sm font-semibold text-foreground">
              Revenue collected
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Paid invoices, last 12 months, platform-wide
            </p>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={REVENUE_SERIES}
                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f766e" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  minTickGap={12}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  tickFormatter={(value) =>
                    Number(value) >= 1000
                      ? `${Math.round(Number(value) / 1000)}k`
                      : String(value)
                  }
                  width={36}
                />
                <Tooltip
                  formatter={(value) => [
                    formatCurrency(Number(value)),
                    "Revenue",
                  ]}
                  labelStyle={{ color: "#0f172a", fontWeight: 700 }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0f766e"
                  strokeWidth={2}
                  fill="url(#mrrFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-[14px] border-border bg-card p-4 shadow-xs ring-0 sm:p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-foreground">
              Plan distribution
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Active tenants by plan
            </p>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={PLAN_DISTRIBUTION}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {PLAN_DISTRIBUTION.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value} tenants`, name]}
                  // Otherwise the text takes the slice's colour; Free's is too pale.
                  itemStyle={{ color: "#0f172a" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-2.5">
            {PLAN_DISTRIBUTION.map((slice) => (
              <div
                key={slice.name}
                className="flex items-center justify-between text-xs"
              >
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ backgroundColor: slice.color }}
                  />
                  {slice.name}
                </span>
                <span className="text-muted-foreground">
                  {slice.value} ·{" "}
                  {planTotal ? Math.round((slice.value / planTotal) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="rounded-[14px] border-border bg-card p-4 shadow-xs ring-0 sm:p-5 xl:col-span-2">
          <div className="mb-4">
            <p className="text-sm font-semibold text-foreground">
              New vs churned tenants
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Monthly movement across the last 12 months
            </p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={REVENUE_SERIES}
                margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  minTickGap={12}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  width={28}
                />
                <Tooltip
                  itemStyle={{ color: "#0f172a" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="newTenants" name="New" radius={[3, 3, 0, 0]}>
                  {REVENUE_SERIES.map((point, index) => (
                    <Cell
                      key={`new-${index}`}
                      fill={
                        index === REVENUE_SERIES.length - 1
                          ? "#0f766e"
                          : "#99f6e4"
                      }
                    />
                  ))}
                </Bar>
                <Bar dataKey="churned" name="Churned" radius={[3, 3, 0, 0]}>
                  {REVENUE_SERIES.map((point, index) => (
                    <Cell
                      key={`churn-${index}`}
                      fill={
                        index === REVENUE_SERIES.length - 1
                          ? "#ef4444"
                          : "#fecaca"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-[14px] border-border bg-card p-4 shadow-xs ring-0 sm:p-5">
          <div className="mb-2">
            <p className="text-sm font-semibold text-foreground">
              Top tenants by MRR
            </p>
          </div>
          <div className="flex flex-col divide-y divide-muted">
            {topTenants.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No workspaces on a paid plan yet.
              </p>
            )}
            {topTenants.map((tenant) => (
              <div key={tenant.id} className="flex items-center gap-3 py-2.5">
                <Avatar className="size-8 rounded-md">
                  <AvatarFallback className="rounded-md bg-muted text-xs font-bold text-foreground">
                    {tenant.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {tenant.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {tenant.plan} · {tenant.seatsUsed}{" "}
                    {tenant.seatsUsed === 1 ? "seat" : "seats"}
                  </span>
                </div>
                <span className="text-sm font-bold text-foreground">
                  {formatCurrency(tenant.mrr)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
