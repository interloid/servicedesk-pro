/**
 * Support requests: a Tenant Admin asks the platform team for help
 * (/[tenantSlug]/support), platform admins answer from the Tenants page
 * (/platform/tenants).
 * Values mirror the check constraints in tables/28_support_requests.sql.
 */

export const SUPPORT_STATUSES = [
  "open",
  "in_progress",
  "waiting_on_customer",
  "resolved",
  "closed",
] as const;

export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_customer: "Waiting on you",
  resolved: "Resolved",
  closed: "Closed",
};

/** The platform side reads "waiting on customer" where the tenant reads "waiting on you". */
export const SUPPORT_STATUS_LABELS_PLATFORM: Record<SupportStatus, string> = {
  ...SUPPORT_STATUS_LABELS,
  waiting_on_customer: "Waiting on customer",
};

/** Soft fills, same scale as the console's ToneBadge. */
export const SUPPORT_STATUS_BADGE: Record<SupportStatus, string> = {
  open: "border-none bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
  in_progress:
    "border-none bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  waiting_on_customer:
    "border-none bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  resolved:
    "border-none bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  closed: "border-none bg-muted text-muted-foreground",
};

export const OPEN_SUPPORT_STATUSES: readonly SupportStatus[] = [
  "open",
  "in_progress",
  "waiting_on_customer",
];

/** How long one grant of workspace access lasts. */
export const SUPPORT_ACCESS_HOURS = 72;

export const SUPPORT_SUBJECT_MAX = 150;
export const SUPPORT_BODY_MAX = 5000;

export interface SupportMessage {
  id: string;
  authorType: "tenant" | "platform";
  authorName: string;
  body: string;
  createdAt: string;
}

export interface SupportRequest {
  id: string;
  number: string;
  tenantId: string;
  subject: string;
  description: string;
  status: SupportStatus;
  createdByName: string;
  createdByEmail: string;
  allowWorkspaceAccess: boolean;
  accessExpiresAt: string | null;
  /** Granted, unexpired and the request still open: the Support access page works. */
  accessActive: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  messageCount: number;
}

export interface SupportRequestDetail extends SupportRequest {
  messages: SupportMessage[];
}

export function supportNumber(value: number | string): string {
  return `SR-${value}`;
}

export function isOpenSupportStatus(status: SupportStatus): boolean {
  return OPEN_SUPPORT_STATUSES.includes(status);
}

/** Mirrors the table comment: granted, unexpired and not resolved or closed. */
export function isSupportAccessActive(
  row: {
    allowWorkspaceAccess: boolean;
    accessExpiresAt: string | null;
    status: SupportStatus;
  },
  now: number,
): boolean {
  return (
    row.allowWorkspaceAccess &&
    row.accessExpiresAt !== null &&
    Date.parse(row.accessExpiresAt) > now &&
    isOpenSupportStatus(row.status)
  );
}

/**
 * "12 Nov 2026, 14:05 UTC". UTC and en-GB so the server render and the
 * hydrated page agree, and both sides of a request read the same times.
 */
export function formatSupportTime(iso: string | null | undefined): string {
  if (!iso) return "—";

  const time = Date.parse(iso);

  if (Number.isNaN(time)) return "—";

  return `${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(time)} UTC`;
}
