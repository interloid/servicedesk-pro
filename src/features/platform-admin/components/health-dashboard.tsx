import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Gauge,
  HardDrive,
  MemoryStick,
  Plug,
  Timer,
  XCircle,
  Zap,
} from "lucide-react";

import { ModalNotice } from "@/components/shared/modal-notice";
import { cn } from "@/lib/utils";

import { formatBytes, formatNumber } from "../format";
import type {
  ApiTraffic,
  DbHealth,
  InfraMetrics,
  ManagementFailure,
  ServiceHealth,
  ServiceState,
} from "../types";
import { ApiTrafficChart } from "./api-traffic-chart";
import { ManagementNotice } from "./management-notice";
import { PLATFORM_CARD, PLATFORM_STAT_GRID } from "./platform-ui";
import { SimpleTable } from "./simple-table";
import { StatCard } from "./stat-card";

const STATES: Record<
  ServiceState,
  { label: string; icon: LucideIcon; className: string }
> = {
  operational: {
    label: "Operational",
    icon: CheckCircle2,
    className: "text-emerald-600",
  },
  degraded: {
    label: "Degraded",
    icon: AlertTriangle,
    className: "text-amber-600",
  },
  down: { label: "Down", icon: XCircle, className: "text-red-600" },
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Overall({ services }: { services: ServiceHealth[] }) {
  const worst: ServiceState = services.some((s) => s.state === "down")
    ? "down"
    : services.some((s) => s.state === "degraded")
      ? "degraded"
      : "operational";
  const { icon: Icon, className } = STATES[worst];
  const affected = services.filter((s) => s.state !== "operational");

  return (
    <div className={cn(PLATFORM_CARD, "flex items-center gap-3 p-4")}>
      <Icon className={cn("size-6 shrink-0", className)} aria-hidden />
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold text-foreground">
          {worst === "operational"
            ? "All checked services are operational"
            : `${affected.length} service${affected.length === 1 ? "" : "s"} need${affected.length === 1 ? "s" : ""} attention`}
        </span>
        {affected.length > 0 && (
          <span className="truncate text-xs text-muted-foreground">
            {affected.map((s) => s.name).join(", ")}
          </span>
        )}
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  const { label, icon: Icon, className } = STATES[service.state];

  return (
    <div className={cn(PLATFORM_CARD, "flex flex-col gap-1 p-4")}>
      <span className="text-sm font-semibold text-foreground">
        {service.name}
      </span>
      <span
        className={cn(
          "flex items-center gap-1.5 text-sm font-medium",
          className,
        )}
      >
        <Icon className="size-4" aria-hidden />
        {label}
      </span>
      <span className="text-xs text-muted-foreground">
        {service.detail ??
          (service.latencyMs !== null
            ? `${service.latencyMs} ms response`
            : "Reported by Supabase")}
      </span>
    </div>
  );
}

function percent(
  used: number | null,
  total: number | null,
): string | undefined {
  return used !== null && total
    ? `${Math.round((used / total) * 100)}% used`
    : undefined;
}

export function HealthDashboard({
  services,
  infra,
  db,
  traffic,
}: {
  services: ServiceHealth[];
  infra: InfraMetrics | null;
  db:
    | { available: true; data: DbHealth }
    | { available: false; missing: boolean; timedOut: boolean };
  traffic: { ok: true; data: ApiTraffic } | ({ ok: false } & ManagementFailure);
}) {
  const database = db.available ? db.data : null;
  const errorRate =
    traffic.ok && traffic.data.requests > 0
      ? (traffic.data.serverErrors / traffic.data.requests) * 100
      : null;

  return (
    <div className="flex flex-col gap-8">
      <Overall services={services} />

      <Section
        title="Services"
        description="Checked from this server just now."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {services.map((service) => (
            <ServiceCard key={service.name} service={service} />
          ))}
        </div>
      </Section>

      <Section title="Database & infrastructure">
        {!db.available && (
          <ModalNotice icon={AlertTriangle} tone="danger">
            {db.missing
              ? "Database metrics need migration 20261103120000_platform_db_health, which isn't on this database yet."
              : db.timedOut
                ? "The database metrics took too long and Supabase stopped the query. Apply migration 20261103150000_platform_db_health_cron_limit, then refresh."
                : "The database metrics couldn't be read. Check the server logs."}
          </ModalNotice>
        )}
        <div className={PLATFORM_STAT_GRID}>
          <StatCard
            label="Connections"
            value={
              database
                ? `${database.connections.total} / ${database.connections.max}`
                : "—"
            }
            hint={
              database
                ? `${database.connections.active} active · ${database.connections.waiting} waiting on locks`
                : undefined
            }
            icon={Plug}
          />
          <StatCard
            label="Database size"
            value={formatBytes(database?.database_bytes)}
            icon={Database}
          />
          <StatCard
            label="Cache hit rate"
            value={
              database?.cache_hit_percent != null
                ? `${database.cache_hit_percent}%`
                : "—"
            }
            hint="Since stats were last reset"
            icon={Gauge}
          />
          <StatCard
            label="Longest running query"
            value={
              database ? `${Math.round(database.longest_query_seconds)} s` : "—"
            }
            hint={
              database
                ? `${database.connections.idle_in_transaction} idle in transaction`
                : undefined
            }
            icon={Timer}
          />
          <StatCard
            label="Memory"
            value={formatBytes(infra?.memoryUsedBytes)}
            hint={
              infra?.memoryTotalBytes
                ? `of ${formatBytes(infra.memoryTotalBytes)} · ${percent(infra.memoryUsedBytes, infra.memoryTotalBytes) ?? ""}`
                : "Not reported"
            }
            icon={MemoryStick}
          />
          <StatCard
            label="Disk"
            value={formatBytes(infra?.diskUsedBytes)}
            hint={
              infra?.diskTotalBytes
                ? `of ${formatBytes(infra.diskTotalBytes)} · ${percent(infra.diskUsedBytes, infra.diskTotalBytes) ?? ""}`
                : "Not reported"
            }
            icon={HardDrive}
          />
          <StatCard
            label="CPU load (1 min)"
            value={infra?.load1 != null ? infra.load1.toFixed(2) : "—"}
            hint={
              infra?.cpuCores
                ? `${infra.cpuCores} core${infra.cpuCores === 1 ? "" : "s"}${infra.load15 != null ? ` · 15 min ${infra.load15.toFixed(2)}` : ""}`
                : "Not reported"
            }
            icon={Cpu}
          />
          <StatCard
            label="API requests (24 h)"
            value={traffic.ok ? formatNumber(traffic.data.requests) : "—"}
            hint={
              errorRate !== null
                ? `${errorRate.toFixed(2)}% server errors`
                : undefined
            }
            icon={Zap}
          />
        </div>
      </Section>

      <Section
        title="API traffic"
        description="Requests through the Supabase gateway, last 24 hours (UTC)."
      >
        {!traffic.ok ? (
          <ManagementNotice failure={traffic} />
        ) : (
          <>
            <div
              className={cn(PLATFORM_CARD, "flex flex-col gap-3 p-4 sm:p-5")}
            >
              {traffic.data.hours.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No API requests in the last 24 hours.
                </p>
              ) : (
                <ApiTrafficChart hours={traffic.data.hours} />
              )}
              {traffic.data.p95Ms !== null && (
                <p className="text-xs text-muted-foreground">
                  Slowest hourly p95 origin time: {traffic.data.p95Ms} ms
                </p>
              )}
            </div>

            <SimpleTable
              headers={["Failing path", "Status", "Count"]}
              empty="No server errors in the last 24 hours."
              noun={{ one: "failing path", other: "failing paths" }}
              rows={traffic.data.failingPaths.map((row) => [
                <span key="path" className="font-mono text-xs break-all">
                  {row.method} {row.path}
                </span>,
                row.status,
                formatNumber(row.count),
              ])}
            />
          </>
        )}
      </Section>

      {database && (
        <Section title="Database performance">
          <SimpleTable
            headers={["Largest table", "Rows (est.)", "Size"]}
            empty="No tables found."
            noun={{ one: "table", other: "tables" }}
            rows={database.largest_tables.map((table) => [
              <span key="name" className="font-mono text-xs">
                {table.name}
              </span>,
              formatNumber(table.rows),
              formatBytes(table.bytes),
            ])}
          />
        </Section>
      )}
    </div>
  );
}
