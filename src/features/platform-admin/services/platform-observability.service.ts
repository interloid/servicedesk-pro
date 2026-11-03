import "server-only";

import { unstable_cache } from "next/cache";

import { env } from "@/config/env";
import { serverEnv } from "@/config/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { shortCached } from "./short-cache";
import {
  LOG_RANGES,
  LOG_SOURCES,
  type ApiTraffic,
  type DbHealth,
  type InfraMetrics,
  type LogEntry,
  type LogLevel,
  type LogRangeKey,
  type LogSourceKey,
  type ManagementFailure,
  type ServiceHealth,
  type ServiceState,
} from "../types";

const MANAGEMENT_API = "https://api.supabase.com/v1";
const SLOW_MS = 1500;
const DAY_MS = 24 * 60 * 60 * 1000;

type Result<T> = { ok: true; data: T } | ({ ok: false } & ManagementFailure);

function failure(
  reason: ManagementFailure["reason"],
  message: string,
): { ok: false } & ManagementFailure {
  return { ok: false, reason, message };
}

function projectRef(): string | null {
  if (serverEnv.SUPABASE_PROJECT_REF) return serverEnv.SUPABASE_PROJECT_REF;

  try {
    const { hostname } = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    return hostname.endsWith(".supabase.co") ? hostname.split(".")[0] : null;
  } catch {
    return null;
  }
}

/* ── Logs ───────────────────────────────────────────────────────────────── */

/**
 * Supabase rate limits this token, so nothing is asked twice when the answer can't
 * have changed. Windows start and end on a whole minute (the API rounds them that
 * way anyway), which makes a repeat within the minute the same question. Held in
 * memory rather than the data cache: log contents shouldn't be written to disk.
 */
const CACHE_MS = 60_000;
const MAX_CACHED = 200;
const DEFAULT_COOLDOWN_MS = 60_000;

const logCache = new Map<string, { at: number; rows: unknown[] }>();
const logsInFlight = new Map<string, Promise<Result<unknown[]>>>();
let cooldownUntil = 0;

/**
 * After a 429 nothing is sent until it has passed: retrying prolongs the limit.
 * Supabase documents X-RateLimit-Reset as the seconds left in its window.
 */
function startCooldown(response: Response): void {
  const seconds = Number(response.headers.get("x-ratelimit-reset"));

  cooldownUntil =
    Date.now() +
    (Number.isFinite(seconds) && seconds > 0
      ? seconds * 1000
      : DEFAULT_COOLDOWN_MS);
}

function coolingDown(): ({ ok: false } & ManagementFailure) | null {
  const left = Math.ceil((cooldownUntil - Date.now()) / 1000);

  return left > 0
    ? failure(
        "rate_limited",
        `Supabase is rate limiting log queries. Try again in ${left} second${left === 1 ? "" : "s"}.`,
      )
    : null;
}

function floorToMinute(time: number): Date {
  return new Date(Math.floor(time / 60_000) * 60_000);
}

async function queryLogs<Row>(
  sql: string,
  startIso: string,
  endIso: string,
): Promise<Result<Row[]>> {
  const key = `${startIso}|${endIso}|${sql}`;
  const cached = logCache.get(key);

  if (cached && Date.now() - cached.at < CACHE_MS) {
    return { ok: true, data: cached.rows as Row[] };
  }

  const waiting = coolingDown();

  if (waiting) return waiting;

  const running = logsInFlight.get(key);

  if (running) return running as Promise<Result<Row[]>>;

  const request = fetchLogs<Row>(sql, startIso, endIso)
    .then((result) => {
      if (result.ok) {
        if (logCache.size >= MAX_CACHED) logCache.clear();
        logCache.set(key, { at: Date.now(), rows: result.data });
      }

      return result;
    })
    .finally(() => logsInFlight.delete(key));

  logsInFlight.set(key, request);

  return request;
}

/**
 * The Management API's logs endpoint. Takes ClickHouse SQL over one `logs` table
 * and at most 24 hours per call. The token never reaches the browser.
 */
async function fetchLogs<Row>(
  sql: string,
  startIso: string,
  endIso: string,
): Promise<Result<Row[]>> {
  const token = serverEnv.SUPABASE_MANAGEMENT_TOKEN;
  const ref = projectRef();

  if (!token || !ref) {
    return failure(
      "not_configured",
      "Set SUPABASE_MANAGEMENT_TOKEN to read Supabase logs.",
    );
  }

  const params = new URLSearchParams({
    sql,
    iso_timestamp_start: startIso,
    iso_timestamp_end: endIso,
  });

  try {
    const response = await fetch(
      `${MANAGEMENT_API}/projects/${ref}/analytics/endpoints/logs?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (response.status === 401 || response.status === 403) {
      return failure(
        "forbidden",
        "Supabase rejected the token. Check it can read this project's logs (Logs: Read).",
      );
    }

    if (response.status === 429) {
      startCooldown(response);

      return (
        coolingDown() ??
        failure("rate_limited", "Supabase is rate limiting log queries.")
      );
    }

    if (response.status === 402) {
      return failure(
        "usage_exceeded",
        "Supabase refused the query because the project's usage limit was exceeded.",
      );
    }

    if (!response.ok) {
      return failure(
        "failed",
        `Supabase returned ${response.status} for the log query.`,
      );
    }

    const body = (await response.json()) as {
      result?: Row[];
      error?: string | { message?: string } | null;
    };

    if (body.error) {
      const message =
        typeof body.error === "string" ? body.error : body.error.message;
      console.error("[platform] log query error:", message);

      return failure("failed", "Supabase couldn't run the log query.");
    }

    return { ok: true, data: body.result ?? [] };
  } catch (error) {
    console.error("[platform] log query failed:", error);

    return failure("failed", "Couldn't reach the Supabase log API.");
  }
}

/** Inside a ClickHouse string literal used with ilike. */
function escapeLike(term: string): string {
  return term
    .replace(/\\/g, "\\\\\\\\")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\\\%")
    .replace(/_/g, "\\\\_");
}

// Logs carry whatever the request carried, so strip credentials before display.
const HIDDEN_ATTRIBUTE =
  /authorization|apikey|api_key|cookie|token|password|secret|request\.search/i;

function scrub(text: string): string {
  return text
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bsb_(secret|publishable)_\w+/g, "[redacted]")
    .replace(
      /([?&](?:token|access_token|refresh_token|token_hash|apikey|code|password)=)[^&\s"]+/gi,
      "$1[redacted]",
    );
}

/** Microseconds, or "YYYY-MM-DD HH:MM:SS[.ffffff]" in UTC, to ISO. */
function toIso(value: unknown): string {
  if (typeof value === "number") {
    return new Date(value / 1000).toISOString();
  }

  const text = String(value ?? "");

  if (/^\d{13,}$/.test(text)) {
    return new Date(Number(text) / 1000).toISOString();
  }

  const zoned = /[zZ]|[+-]\d\d:?\d\d$/.test(text)
    ? text
    : `${text.replace(" ", "T")}Z`;
  const parsed = Date.parse(zoned);

  return Number.isNaN(parsed) ? "" : new Date(parsed).toISOString();
}

type LogRow = {
  id: string;
  timestamp: unknown;
  source: string;
  severity_text: string | null;
  event_message: string | null;
  log_attributes: Record<string, unknown> | null;
};

const STATUS_KEYS = ["response.status_code", "status", "res.statusCode"];
const ERROR_SEVERITIES = "'ERROR', 'FATAL', 'PANIC', 'CRITICAL'";

function toLogEntry(row: LogRow): LogEntry {
  const attributes = row.log_attributes ?? {};
  const status = STATUS_KEYS.map((key) => Number(attributes[key])).find(
    (value) => Number.isFinite(value) && value > 0,
  );
  const severity = (row.severity_text ?? "").toUpperCase();

  let level: LogLevel = "info";

  if (/ERROR|FATAL|PANIC|CRITICAL/.test(severity) || (status ?? 0) >= 500) {
    level = "error";
  } else if (/WARN/.test(severity) || (status ?? 0) >= 400) {
    level = "warning";
  }

  const method = attributes["request.method"];
  const path = attributes["request.path"] ?? attributes["request.pathname"];

  // A gateway message repeats the visitor's IP and full URL; the path is enough.
  const message =
    row.source === "edge_logs" && method && path
      ? `${method} ${path}${status ? ` → ${status}` : ""}`
      : (row.event_message ?? "");

  return {
    id: row.id,
    timestamp: toIso(row.timestamp),
    source: row.source,
    level,
    message: scrub(message).slice(0, 2000),
    attributes: Object.entries(attributes)
      .filter(([key, value]) => !HIDDEN_ATTRIBUTE.test(key) && value !== "")
      .map(([key, value]) => ({ key, value: scrub(String(value)) }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  };
}

export async function getPlatformLogs({
  source,
  range,
  errorsOnly,
  q,
  page,
  pageSize,
  at,
}: {
  source: LogSourceKey;
  range: LogRangeKey;
  errorsOnly: boolean;
  q: string;
  page: number;
  pageSize: number;
  /** The window's end. Held while paging, so new logs don't shift the rows. */
  at: string | null;
}): Promise<
  Result<{ entries: LogEntry[]; total: number; page: number; at: string }>
> {
  // Both come from allowlists; only `q` is free text, and it is escaped.
  const sources: readonly string[] = LOG_SOURCES[source].sources;
  const where: string[] = [];

  if (sources.length > 0) {
    where.push(`source in (${sources.map((s) => `'${s}'`).join(", ")})`);
  }

  if (errorsOnly) {
    where.push(
      `(upper(severity_text) in (${ERROR_SEVERITIES}) or ${STATUS_KEYS.map(
        (key) => `toInt32OrZero(log_attributes['${key}']) >= 500`,
      ).join(" or ")})`,
    );
  }

  if (q) {
    const like = `'%${escapeLike(q.slice(0, 200))}%'`;
    where.push(
      `(event_message ilike ${like} or log_attributes['request.path'] ilike ${like})`,
    );
  }

  const filter = where.length ? `where ${where.join(" and ")}` : "";
  const now = Date.now();
  const held = at ? Date.parse(at) : Number.NaN;
  const end = floorToMinute(Number.isNaN(held) ? now : Math.min(held, now));
  const startIso = new Date(
    end.getTime() - LOG_RANGES[range].minutes * 60_000,
  ).toISOString();
  const endIso = end.toISOString();

  const counted = await queryLogs<{ total: number | string }>(
    `select count() as total from logs ${filter}`,
    startIso,
    endIso,
  );

  if (!counted.ok) return counted;

  const total = Number(counted.data[0]?.total ?? 0);
  // Past the end, from an old link or a narrower filter: the last page instead.
  const safePage = Math.min(
    Math.max(1, page),
    Math.max(1, Math.ceil(total / pageSize)),
  );

  const rows = await queryLogs<LogRow>(
    `select id, timestamp, source, severity_text, event_message, log_attributes
from logs
${filter}
order by timestamp desc, id desc
limit ${pageSize} offset ${(safePage - 1) * pageSize}`,
    startIso,
    endIso,
  );

  if (!rows.ok) return rows;

  return {
    ok: true,
    data: {
      entries: rows.data.map(toLogEntry),
      total,
      page: safePage,
      at: endIso,
    },
  };
}

/* ── API traffic ────────────────────────────────────────────────────────── */

const STATUS = "toInt32OrZero(log_attributes['response.status_code'])";

export async function getApiTraffic(): Promise<Result<ApiTraffic>> {
  const end = floorToMinute(Date.now());
  const startIso = new Date(end.getTime() - DAY_MS).toISOString();
  const endIso = end.toISOString();

  const [hourly, failing, sources, functions] = await Promise.all([
    queryLogs<{
      hour: unknown;
      requests: number | string;
      server_errors: number | string;
      p95: number | string | null;
    }>(
      `select toStartOfHour(timestamp) as hour, count() as requests,
  countIf(${STATUS} >= 500) as server_errors,
  quantile(0.95)(toFloat64OrZero(log_attributes['response.origin_time'])) as p95
from logs where source = 'edge_logs'
group by hour order by hour limit 25`,
      startIso,
      endIso,
    ),
    queryLogs<{
      method: string;
      path: string;
      status: number | string;
      count: number | string;
    }>(
      `select log_attributes['request.method'] as method,
  log_attributes['request.path'] as path, ${STATUS} as status, count() as count
from logs where source = 'edge_logs' and ${STATUS} >= 500
group by method, path, status order by count desc limit 10`,
      startIso,
      endIso,
    ),
    queryLogs<{
      source: string;
      events: number | string;
      errors: number | string;
    }>(
      `select source, count() as events,
  countIf(upper(severity_text) in (${ERROR_SEVERITIES})) as errors
from logs group by source order by events desc limit 20`,
      startIso,
      endIso,
    ),
    queryLogs<{
      path: string;
      calls: number | string;
      errors: number | string;
      p95: number | string | null;
    }>(
      `select log_attributes['request.pathname'] as path, count() as calls,
  countIf(${STATUS} >= 500) as errors,
  quantile(0.95)(toFloat64OrZero(log_attributes['execution_time_ms'])) as p95
from logs where source = 'function_edge_logs'
group by path order by calls desc limit 15`,
      startIso,
      endIso,
    ),
  ]);

  if (!hourly.ok) return hourly;
  if (!failing.ok) return failing;
  if (!sources.ok) return sources;
  if (!functions.ok) return functions;

  const positive = (value: unknown) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
  };

  const hours = hourly.data.map((row) => {
    const requests = Number(row.requests);
    const serverErrors = Number(row.server_errors);

    return { hour: toIso(row.hour), ok: requests - serverErrors, serverErrors };
  });

  // A true p95 across the day isn't derivable from hourly ones; show the worst.
  const p95s = hourly.data.flatMap((row) => positive(row.p95) ?? []);

  return {
    ok: true,
    data: {
      hours,
      requests: hours.reduce(
        (sum, hour) => sum + hour.ok + hour.serverErrors,
        0,
      ),
      serverErrors: hours.reduce((sum, hour) => sum + hour.serverErrors, 0),
      p95Ms: p95s.length ? Math.max(...p95s) : null,
      failingPaths: failing.data.map((row) => ({
        method: row.method,
        path: scrub(row.path),
        status: Number(row.status),
        count: Number(row.count),
      })),
      sources: sources.data.map((row) => ({
        source: row.source,
        events: Number(row.events),
        errors: Number(row.errors),
      })),
      functions: functions.data.map((row) => ({
        path: row.path,
        calls: Number(row.calls),
        errors: Number(row.errors),
        p95Ms: positive(row.p95),
      })),
    },
  };
}

/* ── Services ───────────────────────────────────────────────────────────── */

async function probe(
  name: string,
  check: () => PromiseLike<boolean>,
): Promise<ServiceHealth> {
  const started = performance.now();

  try {
    const healthy = await check();
    const latencyMs = Math.round(performance.now() - started);
    const state: ServiceState = !healthy
      ? "down"
      : latencyMs > SLOW_MS
        ? "degraded"
        : "operational";

    return {
      name,
      state,
      latencyMs,
      detail: state === "degraded" ? "Responding slowly" : null,
    };
  } catch {
    return { name, state: "down", latencyMs: null, detail: "No response" };
  }
}

/** Realtime and the pooler can't be probed from here; the API reports them. */
let managedCache: { at: number; services: ServiceHealth[] } | null = null;

async function managedServices(): Promise<ServiceHealth[]> {
  const token = serverEnv.SUPABASE_MANAGEMENT_TOKEN;
  const ref = projectRef();

  if (!token || !ref) return [];

  if (managedCache && Date.now() - managedCache.at < CACHE_MS) {
    return managedCache.services;
  }

  if (coolingDown()) return managedCache?.services ?? [];

  try {
    const response = await fetch(
      `${MANAGEMENT_API}/projects/${ref}/health?services=realtime,pooler`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (response.status === 429) startCooldown(response);

    if (!response.ok) return managedCache?.services ?? [];

    const rows = (await response.json()) as Array<{
      name: string;
      healthy: boolean;
      status?: string;
    }>;
    const labels: Record<string, string> = {
      realtime: "Realtime",
      pooler: "Connection pooler",
    };

    const services: ServiceHealth[] = rows.map((row) => ({
      name: labels[row.name] ?? row.name,
      state: row.healthy ? "operational" : "down",
      latencyMs: null,
      detail: row.healthy ? null : (row.status ?? "Unhealthy"),
    }));

    managedCache = { at: Date.now(), services };

    return services;
  } catch {
    return [];
  }
}

export async function getServiceHealth(): Promise<ServiceHealth[]> {
  const admin = createSupabaseAdminClient();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;

  const [database, auth, storage, managed] = await Promise.all([
    probe("Database & REST API", async () => {
      const { error } = await admin
        .from("plans")
        .select("id", { head: true })
        .limit(1);
      return !error;
    }),
    probe("Auth", async () => {
      const response = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      return response.ok;
    }),
    probe("Storage", async () => {
      const { error } = await admin.storage.listBuckets();
      return !error;
    }),
    managedServices(),
  ]);

  return [database, auth, storage, ...managed];
}

/* ── Infrastructure metrics ─────────────────────────────────────────────── */

type Sample = { name: string; labels: string; value: number };

function parsePrometheus(text: string): Sample[] {
  const samples: Sample[] = [];

  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;

    const match = /^([a-zA-Z_:][\w:]*)(\{.*\})?\s+(\S+)/.exec(line);

    if (match) {
      samples.push({
        name: match[1],
        labels: match[2] ?? "",
        value: Number(match[3]),
      });
    }
  }

  return samples;
}

/**
 * Supabase's Prometheus endpoint, which takes the secret key. It is in beta and
 * its metric names aren't documented, so a missing one just shows as unreported.
 * Cached for a minute: Supabase asks for no more than one scrape a minute.
 */
const readInfraMetrics = unstable_cache(
  async (): Promise<InfraMetrics | null> => {
    const credentials = Buffer.from(
      `service_role:${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`,
    ).toString("base64");

    const response = await fetch(
      `${env.NEXT_PUBLIC_SUPABASE_URL}/customer/v1/privileged/metrics`,
      {
        headers: { Authorization: `Basic ${credentials}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!response.ok) {
      console.error("[platform] metrics scrape returned", response.status);
      return null;
    }

    const samples = parsePrometheus(await response.text());
    const first = (name: string, labels = "") =>
      samples.find(
        (sample) => sample.name === name && sample.labels.includes(labels),
      )?.value ?? null;
    const mount = samples.some(
      (sample) =>
        sample.name === "node_filesystem_size_bytes" &&
        sample.labels.includes('mountpoint="/data"'),
    )
      ? 'mountpoint="/data"'
      : 'mountpoint="/"';

    const memoryTotal = first("node_memory_MemTotal_bytes");
    const memoryFree = first("node_memory_MemAvailable_bytes");
    const diskTotal = first("node_filesystem_size_bytes", mount);
    const diskFree = first("node_filesystem_avail_bytes", mount);
    const cores = new Set(
      samples
        .filter((sample) => sample.name === "node_cpu_seconds_total")
        .map((sample) => /cpu="(\d+)"/.exec(sample.labels)?.[1])
        .filter(Boolean),
    ).size;

    return {
      memoryUsedBytes:
        memoryTotal !== null && memoryFree !== null
          ? memoryTotal - memoryFree
          : null,
      memoryTotalBytes: memoryTotal,
      diskUsedBytes:
        diskTotal !== null && diskFree !== null ? diskTotal - diskFree : null,
      diskTotalBytes: diskTotal,
      load1: first("node_load1"),
      load15: first("node_load15"),
      cpuCores: cores || null,
    };
  },
  ["platform-infra-metrics"],
  { revalidate: 60 },
);

export async function getInfraMetrics(): Promise<InfraMetrics | null> {
  try {
    return await readInfraMetrics();
  } catch (error) {
    console.error("[platform] metrics scrape failed:", error);
    return null;
  }
}

/* ── Database ───────────────────────────────────────────────────────────── */

type DbHealthResult =
  | { available: true; data: DbHealth }
  | { available: false; missing: boolean; timedOut: boolean };

export function getDbHealth(): Promise<DbHealthResult> {
  return shortCached("db-health", readDbHealth, (result) => result.available);
}

async function readDbHealth(): Promise<DbHealthResult> {
  const { data, error } =
    await createSupabaseAdminClient().rpc("platform_db_health");

  if (error) {
    if (error.code !== "PGRST202") {
      console.error("[platform] db health failed:", error.message);
    }

    return {
      available: false,
      missing: error.code === "PGRST202",
      // 57014: Postgres cancelled it at the role's statement timeout.
      timedOut: error.code === "57014",
    };
  }

  return { available: true, data: data as unknown as DbHealth };
}
