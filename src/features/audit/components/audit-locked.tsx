import Link from "next/link";
import { ArrowRight, FileText, Lock } from "lucide-react";

import { LockedBackdrop } from "@/components/shared/locked-backdrop";
import { Button } from "@/components/ui/button";
import {
  AUDIT_RETENTION_DAYS,
  DEFAULT_AUDIT_PAGE_SIZE,
  addDays,
  type AuditActor,
  type AuditEvent,
  type AuditFilters,
  type AuditPageData,
} from "../types/audit";
import { AuditLogView } from "./audit-log-view";

/**
 * Made-up events for the blurred backdrop. A locked workspace's real log is
 * never read: the blur is decoration, and anything under it can still be
 * read from the page source. A fixed clock keeps server and client renders
 * the same.
 */
const SAMPLE_NOW = Date.parse("2026-10-20T12:00:00Z");
const SAMPLE_TODAY = "2026-10-20";
const SAMPLE_TIME_ZONE = "UTC";

const sampleActor = (id: string, name: string, role: string): AuditActor => ({
  id,
  name,
  email: `${id}@example.com`,
  avatarUrl: null,
  role,
});

const ALEX = sampleActor("sample-1", "Alex Morgan", "Tenant Admin");
const SAM = sampleActor("sample-2", "Sam Lee", "Manager");
const JORDAN = sampleActor("sample-3", "Jordan Ray", "Agent");

const sampleEvent = (
  index: number,
  event: Pick<
    AuditEvent,
    "action" | "module" | "result" | "entity" | "summary"
  > & {
    actor: AuditActor | null;
  },
): AuditEvent => ({
  id: `sample-${index}`,
  createdAt: new Date(SAMPLE_NOW - index * 47 * 60_000).toISOString(),
  entityId: null,
  changes: [],
  related: null,
  ip: "203.0.113.10",
  userAgent: null,
  meta: {},
  ...event,
});

const SAMPLE_EVENTS: AuditEvent[] = [
  sampleEvent(1, {
    action: "assign",
    module: "tickets",
    result: "success",
    entity: "Ticket",
    summary: "Reassigned ticket #1042 from Sam Lee to Jordan Ray",
    actor: ALEX,
  }),
  sampleEvent(2, {
    action: "role_change",
    module: "roles",
    result: "success",
    entity: "Member",
    summary: "Changed role of Jordan Ray from Manager to Agent",
    actor: ALEX,
  }),
  sampleEvent(3, {
    action: "create",
    module: "conversations",
    result: "success",
    entity: "Reply",
    summary: "Added an internal note on ticket #1039",
    actor: SAM,
  }),
  sampleEvent(4, {
    action: "update",
    module: "sla",
    result: "success",
    entity: "SLA policy",
    summary: 'Updated SLA policy "Standard"',
    actor: SAM,
  }),
  sampleEvent(5, {
    action: "invite",
    module: "users",
    result: "success",
    entity: "Member",
    summary: "Invited a new agent",
    actor: ALEX,
  }),
  sampleEvent(6, {
    action: "update",
    module: "billing",
    result: "success",
    entity: "Subscription",
    summary: "Changed plan from Pro to Business",
    actor: null,
  }),
  sampleEvent(7, {
    action: "support_access",
    module: "platform",
    result: "success",
    entity: "Support request",
    summary: "Platform support viewed the workspace for #1001",
    actor: null,
  }),
];

const SAMPLE_DATA: AuditPageData = {
  events: SAMPLE_EVENTS,
  total: 128,
  tabCounts: {
    all: 128,
    tickets: 54,
    users: 21,
    sla: 12,
    billing: 6,
    platform: 3,
  },
  summary: { total: 128, users: 6, modules: 8, security: 3 },
  users: [ALEX, SAM, JORDAN].map(({ id, name, email }) => ({
    id,
    name,
    email,
  })),
};

const SAMPLE_FILTERS: AuditFilters = {
  from: addDays(SAMPLE_TODAY, -6),
  to: SAMPLE_TODAY,
  q: "",
  module: null,
  action: null,
  user: null,
  result: null,
  page: 1,
  pageSize: DEFAULT_AUDIT_PAGE_SIZE,
};

/**
 * What a workspace without the Business plan sees at /settings/audit: the
 * log's shape, blurred, under a lock, like Reports and Branding.
 */
export function AuditLocked({
  plansHref,
  canUpgrade,
}: {
  plansHref: string;
  /** Only a Tenant Admin can open Plans & pricing; a Manager is told who can. */
  canUpgrade: boolean;
}) {
  return (
    <div className="relative h-full min-h-120 overflow-hidden">
      <LockedBackdrop className="h-full">
        <AuditLogView
          data={SAMPLE_DATA}
          filters={SAMPLE_FILTERS}
          timeZone={SAMPLE_TIME_ZONE}
          now={SAMPLE_NOW}
          today={SAMPLE_TODAY}
          earliest={addDays(SAMPLE_TODAY, -(AUDIT_RETENTION_DAYS - 1))}
        />
      </LockedBackdrop>

      <div className="absolute inset-0 flex items-center justify-center bg-background/30 px-4">
        <div className="flex w-full max-w-lg flex-col items-center rounded-xl border border-border bg-card/90 px-6 py-10 text-center shadow-[0_24px_48px_-20px_rgba(15,23,42,0.25)] backdrop-blur-md sm:px-10">
          <span
            aria-hidden
            className="flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-8 ring-brand-50/50 dark:bg-brand-700/20 dark:text-brand-100 dark:ring-brand-700/10"
          >
            <Lock className="size-7" strokeWidth={1.75} />
          </span>
          <span className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-brand-700 uppercase">
            <FileText className="size-3.5" strokeWidth={2} aria-hidden />
            Settings
          </span>
          <h1 className="mt-2 font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Audit log is available on the Business plan
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-[15px]">
            {canUpgrade
              ? "Upgrade to Business to track sign-ins, role changes, SLA and billing changes."
              : "Ask a Tenant Admin to upgrade to Business to view the audit log."}
          </p>
          {canUpgrade && (
            <Button
              asChild
              className="mt-6 h-10 gap-2 rounded-lg px-6 font-semibold shadow-none"
            >
              <Link href={plansHref}>
                View plans
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
