import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Gauge,
  HardDrive,
  KeyRound,
  MemoryStick,
  Plug,
  Server,
  Table2,
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
import {
  PLATFORM_CARD,
  PlatformEmpty,
  PlatformSectionHeading,
} from "./platform-ui";
import { SimpleTable } from "./simple-table";
import { StatCard } from "./stat-card";

const STATES: Record<
  ServiceState,
  {
    label: string;
    icon: LucideIcon;
    className: string;
    /** Status pill on a service card. */
    pill: string;
    dot: string;
    /** The overall banner: surface tint and icon tile. */
    banner: string;
    tile: string;
  }
> = {
  operational: {
    label: "Operational",
    icon: CheckCircle2,
    // The brand teal, not emerald: "all good" reads in the app's own colour.
    className: "text-brand-700",
    pill: "bg-brand-700/8 text-brand-700 ring-brand-700/15",
    dot: "bg-brand-600",
    banner: "bg-brand-700/5 ring-brand-700/20",
    tile: "bg-brand-700/10 text-brand-700",
  },
  degraded: {
    label: "Degraded",
    icon: AlertTriangle,
    className: "text-amber-600",
    pill: "bg-amber-50 text-amber-800 ring-amber-600/20",
    dot: "bg-amber-500",
    banner: "bg-amber-50/70 ring-amber-200",
    tile: "bg-amber-100 text-amber-700",
  },
  down: {
    label: "Down",
    icon: XCircle,
    className: "text-red-600",
    pill: "bg-red-50 text-red-700 ring-red-600/15",
    dot: "bg-red-500",
    banner: "bg-red-50/70 ring-red-200",
    tile: "bg-red-100 text-red-700",
  },
};

function Section({
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
    <section className="flex flex-col gap-3">
      <PlatformSectionHeading
        icon={icon}
        title={title}
        description={description}
      />
      {children}
    </section>
  );
}

/** An icon for each checked service, by its name. */
function ServiceGlyph({ name }: { name: string }) {
  const n = name.toLowerCase();
  const props = {
    className: "size-5.5",
    strokeWidth: 1.75,
    "aria-hidden": true,
  };
  if (n.includes("auth")) return <KeyRound {...props} />;
  if (n.includes("storage")) return <HardDrive {...props} />;
  if (n.includes("database") || n.includes("rest"))
    return <Database {...props} />;
  return <Server {...props} />;
}

function Overall({ services }: { services: ServiceHealth[] }) {
  const worst: ServiceState = services.some((s) => s.state === "down")
    ? "down"
    : services.some((s) => s.state === "degraded")
      ? "degraded"
      : "operational";
  const { icon: Icon, banner, tile } = STATES[worst];
  const affected = services.filter((s) => s.state !== "operational");

  return (
    // Tinted by the worst state; a ring stands in for the border colour,
    // which the global `* { border-border }` rule would override.
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl p-4 ring-1 sm:px-5",
        banner,
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full",
          tile,
        )}
      >
        <Icon className="size-5.5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-heading text-base font-bold text-foreground">
          {worst === "operational"
            ? "All checked services are operational"
            : `${affected.length} service${affected.length === 1 ? "" : "s"} need${affected.length === 1 ? "s" : ""} attention`}
        </span>
        <span className="truncate text-sm text-slate-600">
          {affected.length > 0
            ? affected.map((s) => s.name).join(", ")
            : `${services.length} of ${services.length} services responding normally`}
        </span>
      </div>
      <div className="hidden shrink-0 items-center gap-1.5 sm:flex" aria-hidden>
        {services.map((service) => (
          <span
            key={service.name}
            title={service.name}
            className={cn("size-2.5 rounded-full", STATES[service.state].dot)}
          />
        ))}
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  const { label, icon: Icon, pill, tile } = STATES[service.state];

  return (
    <div className={cn(PLATFORM_CARD, "flex items-start gap-4 p-5")}>
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full",
          tile,
        )}
      >
        <ServiceGlyph name={service.name} />
      </span>
      {/* Name on top; status and response time below it, so nothing overlaps. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="font-heading text-base leading-snug font-bold text-foreground">
          {service.name}
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
              pill,
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </span>
          <span className="text-xs text-slate-500">
            {service.detail ??
              (service.latencyMs !== null ? (
                <>
                  <span className="font-semibold text-foreground tabular-nums">
                    {service.latencyMs} ms
                  </span>{" "}
                  response
                </>
              ) : (
                "Reported by Supabase"
              ))}
          </span>
        </div>
      </div>
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
        icon={Server}
        title="Services"
        description="Checked from this server just now."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {services.map((service) => (
            <ServiceCard key={service.name} service={service} />
          ))}
        </div>
      </Section>

      <Section
        icon={Database}
        title="Database & infrastructure"
        description="Connections, storage and server load."
      >
        {!db.available && (
          <ModalNotice icon={AlertTriangle} tone="danger">
            {db.missing
              ? "Database metrics need migration 20261103120000_platform_db_health, which isn't on this database yet."
              : db.timedOut
                ? "The database metrics took too long and Supabase stopped the query. Apply migration 20261103150000_platform_db_health_cron_limit, then refresh."
                : "The database metrics couldn't be read. Check the server logs."}
          </ModalNotice>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            iconClassName="bg-brand-50 text-brand-700"
          />
          <StatCard
            label="Database size"
            value={formatBytes(database?.database_bytes)}
            icon={Database}
            iconClassName="bg-sky-50 text-sky-600"
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
            iconClassName="bg-emerald-50 text-emerald-600"
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
            iconClassName="bg-amber-50 text-amber-600"
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
            iconClassName="bg-violet-50 text-violet-600"
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
            iconClassName="bg-sky-50 text-sky-600"
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
            iconClassName="bg-rose-50 text-rose-600"
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
            iconClassName="bg-brand-50 text-brand-700"
          />
        </div>
      </Section>

      <Section
        icon={Zap}
        title="API traffic"
        description="Requests through the Supabase gateway, last 24 hours (UTC)."
      >
        {!traffic.ok ? (
          <ManagementNotice failure={traffic} />
        ) : (
          <>
            <div className={cn(PLATFORM_CARD, "flex flex-col gap-3 p-5")}>
              {traffic.data.hours.length === 0 ? (
                <PlatformEmpty icon={Zap}>
                  No API requests in the last 24 hours.
                </PlatformEmpty>
              ) : (
                <ApiTrafficChart hours={traffic.data.hours} />
              )}
              {traffic.data.p95Ms !== null && (
                <p className="border-t border-border pt-3 text-xs text-slate-500">
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
        <Section
          icon={Table2}
          title="Database performance"
          description="The largest tables by size."
        >
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
