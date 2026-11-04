// tenants.status, refined by the subscription: a live workspace whose
// subscription is trialing or past due shows that instead of "active".
export type TenantStatus =
  "active" | "trialing" | "past_due" | "suspended" | "cancelled";

export type PlatformTenant = {
  id: string;
  name: string;
  slug: string;
  initials: string;
  logoUrl: string | null;
  plan: string;
  // plans.sort_order, so the plan badge and chart colour follow the catalog.
  planRank: number;
  seatsUsed: number;
  seatsLimit: number;
  mrr: number;
  status: TenantStatus;
  createdAt: string;
  owner: string;
  ownerEmail: string;
  blockReason: string | null;
  blockSource: "admin" | "payment" | null;
  blockedAt: string | null;
};

export type UserStatus = "active" | "invited" | "disabled";

export type PlatformUser = {
  id: string;
  name: string;
  email: string;
  tenant: string;
  tenantSlug: string;
  role: string;
  status: UserStatus;
  lastActiveAt: string;
  createdAt: string;
};

export type RevenuePoint = {
  month: string;
  revenue: number;
  newTenants: number;
  churned: number;
};

export type PlanDistributionSlice = {
  name: string;
  value: number;
  color: string;
};

export type PlatformMetrics = {
  totalTenants: number;
  activeTenants: number;
  mrr: number;
  payingTenants: number;
  activeUsers: number;
  openTickets: number;
  signupsThisMonth: number;
  churnedThisMonth: number;
};

export type PlatformOverview = {
  metrics: PlatformMetrics;
  tenants: PlatformTenant[];
  revenueSeries: RevenuePoint[];
  planDistribution: PlanDistributionSlice[];
};

export type PlatformSettings = {
  platformName: string;
  supportEmail: string;
  allowSignups: boolean;
  maintenanceMode: boolean;
  blockOnPaymentFailure: boolean;
};

/* ── Subscriptions ─────────────────────────────────────────────────────── */

// subscriptions.status, plus "cancelling": still paid up, ends at period end.
export type SubscriptionStage =
  "active" | "trialing" | "past_due" | "cancelling" | "cancelled" | "expired";

export type PlatformInvoice = {
  number: string;
  amount: number;
  status: string;
  date: string;
};

export type PlatformSubscription = {
  id: string;
  tenantName: string;
  tenantSlug: string;
  initials: string;
  plan: string;
  planRank: number;
  mrr: number;
  stage: SubscriptionStage;
  seats: number;
  paypalId: string | null;
  paypalStatus: string | null;
  paymentStatus: string | null;
  startedAt: string | null;
  periodEnd: string | null;
  cancelledAt: string | null;
  // "PayPal", "System", or the person who last changed billing.
  cancelledBy: string | null;
  cancelledByEmail: string | null;
  nextPlan: string | null;
  nextPlanAt: string | null;
  paymentFailures: number;
  lastPaymentFailureAt: string | null;
  graceEndsAt: string | null;
  owner: string;
  ownerEmail: string;
  lifetimePaid: number;
  invoices: PlatformInvoice[];
};

export type PlatformBillingData = {
  subscriptions: PlatformSubscription[];
  metrics: {
    mrr: number;
    paying: number;
    pastDue: number;
    cancelling: number;
    mrrAtRisk: number;
    cancelledLast30Days: number;
  };
};

/* ── Logs ──────────────────────────────────────────────────────────────── */

export const LOG_SOURCES = {
  all: { label: "All sources", sources: [] as string[] },
  api: { label: "API gateway", sources: ["edge_logs"] },
  postgres: { label: "Postgres", sources: ["postgres_logs"] },
  postgrest: { label: "PostgREST", sources: ["postgrest_logs"] },
  auth: { label: "Auth", sources: ["auth_logs", "auth_audit_logs"] },
  functions: {
    label: "Edge Functions",
    sources: ["function_edge_logs", "function_logs"],
  },
  storage: { label: "Storage", sources: ["storage_logs"] },
  realtime: { label: "Realtime", sources: ["realtime_logs"] },
  pooler: { label: "Connection pooler", sources: ["supavisor_logs"] },
} as const;

export type LogSourceKey = keyof typeof LOG_SOURCES;

export const LOG_RANGES = {
  "15m": { label: "Last 15 minutes", minutes: 15 },
  "1h": { label: "Last hour", minutes: 60 },
  "6h": { label: "Last 6 hours", minutes: 360 },
  "24h": { label: "Last 24 hours", minutes: 1440 },
} as const;

export type LogRangeKey = keyof typeof LOG_RANGES;

export const LOG_PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_LOG_PAGE_SIZE = 25;

export type LogLevel = "error" | "warning" | "info";

export type LogEntry = {
  id: string;
  timestamp: string;
  source: string;
  level: LogLevel;
  message: string;
  attributes: Array<{ key: string; value: string }>;
};

export type ManagementFailure = {
  reason:
    | "not_configured"
    | "forbidden"
    | "rate_limited"
    | "usage_exceeded"
    | "failed";
  message: string;
};

/* ── Health ────────────────────────────────────────────────────────────── */

export type ServiceState = "operational" | "degraded" | "down";

export type ServiceHealth = {
  name: string;
  state: ServiceState;
  latencyMs: number | null;
  detail: string | null;
};

export type InfraMetrics = {
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
  load1: number | null;
  load15: number | null;
  cpuCores: number | null;
};

export type QueueHealth = {
  pending: number;
  failed: number;
  oldest_pending_at: string | null;
};

export type DbHealth = {
  connections: {
    total: number;
    active: number;
    idle_in_transaction: number;
    waiting: number;
    max: number;
  };
  longest_query_seconds: number;
  database_bytes: number;
  cache_hit_percent: number | null;
  largest_tables: Array<{ name: string; bytes: number; rows: number }>;
  slow_queries: Array<{
    calls: number;
    mean_ms: number;
    total_ms: number;
    query: string;
  }>;
  cron_jobs: Array<{
    name: string;
    schedule: string;
    active: boolean;
    last_status: string | null;
    last_run_at: string | null;
    last_message: string | null;
    failures_24h: number;
  }>;
  email_queue: QueueHealth | null;
  sla_alert_queue: QueueHealth | null;
};

export type ApiTraffic = {
  hours: Array<{ hour: string; ok: number; serverErrors: number }>;
  requests: number;
  serverErrors: number;
  p95Ms: number | null;
  failingPaths: Array<{
    method: string;
    path: string;
    status: number;
    count: number;
  }>;
  sources: Array<{ source: string; events: number; errors: number }>;
  functions: Array<{
    path: string;
    calls: number;
    errors: number;
    p95Ms: number | null;
  }>;
};

/* ── Audit ─────────────────────────────────────────────────────────────── */

export const PLATFORM_AUDIT_RANGES = {
  "1d": { label: "Last 24 hours", days: 1 },
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
} as const;

export type PlatformAuditRange = keyof typeof PLATFORM_AUDIT_RANGES;

/* ── Plans ─────────────────────────────────────────────────────────────── */

// enforced: the app reads this flag to allow or block the feature. Otherwise it
// only appears as a line on the pricing page. Branding and reports are locked by
// plan NAME (anything but "Free"), so their flags don't decide access either.
// Listed basics first, then in the order plans unlock them.
export const PLAN_FEATURES = [
  {
    key: "core_ticketing",
    label: "Core ticketing",
    enforced: false,
    group: "essentials",
  },
  {
    key: "customer_portal",
    label: "Customer portal",
    enforced: false,
    group: "essentials",
  },
  {
    key: "email_notifications",
    label: "Email notifications",
    enforced: false,
    group: "essentials",
  },
  {
    key: "business_hours",
    label: "Business hours",
    enforced: false,
    group: "service",
  },
  {
    key: "saved_shared_views",
    label: "Saved shared views",
    enforced: true,
    group: "service",
  },
  {
    key: "priority_support",
    label: "Priority support",
    enforced: false,
    group: "service",
  },
  { key: "branding", label: "Branding", enforced: false, group: "advanced" },
  {
    key: "advanced_roles",
    label: "Advanced roles",
    enforced: false,
    group: "advanced",
  },
  { key: "audit_logs", label: "Audit logs", enforced: true, group: "advanced" },
  {
    key: "ai_automation",
    label: "AI automation",
    enforced: false,
    group: "advanced",
  },
] as const;

// plans.seat_limit has no null: this value is what the app reads as "Unlimited".
export const UNLIMITED_SEATS = 999_999;

export type PlanFeatureKey = (typeof PLAN_FEATURES)[number]["key"];

export type PlatformPlan = {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  seatLimit: number;
  ticketLimit: number | null;
  storageLimitMb: number | null;
  isActive: boolean;
  features: Record<PlanFeatureKey, boolean>;
  // -1 is unlimited.
  slaPolicies: number;
  workspaces: number;
  mrr: number;
};

/* ── Analytics ─────────────────────────────────────────────────────────── */

export const ANALYTICS_RANGES = {
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
  "365d": { label: "Last 12 months", days: 365 },
} as const;

export type AnalyticsRange = keyof typeof ANALYTICS_RANGES;

export type PlatformAnalytics = {
  tickets_by_month: Array<{ month: string; created: number; resolved: number }>;
  tickets: {
    created: number;
    resolved: number;
    median_first_response_minutes: number | null;
    median_resolution_minutes: number | null;
  };
  csat: { average: number | null; count: number } | null;
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    tickets: number;
    open_tickets: number;
    customers: number;
    last_ticket_at: string | null;
  }>;
};
