import Link from "next/link";
import { ChevronLeft, Eye, Lock, LogIn } from "lucide-react";

import { formatSupportTime } from "@/features/support/support";
import { cn } from "@/lib/utils";

import { formatDate } from "../format";
import type { WorkspaceSnapshot } from "../services/platform-support.service";
import { DataTable, PLATFORM_CARD, PLATFORM_STAT_GRID } from "./platform-ui";
import { SignInAsButton } from "./sign-in-as-button";
import { ToneBadge, type BadgeTone } from "./status-badge";

const TICKET_STATUS_LABELS: Record<string, string> = {
  new: "New",
  open: "Open",
  pending: "Pending",
  on_hold: "On hold",
  resolved: "Resolved",
  closed: "Closed",
};

const TICKET_TONES: Record<string, BadgeTone> = {
  new: "blue",
  open: "teal",
  pending: "amber",
  on_hold: "violet",
  resolved: "green",
  closed: "muted",
};

const PRIORITY_TONES: Record<string, BadgeTone> = {
  low: "muted",
  normal: "blue",
  high: "amber",
  urgent: "red",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={cn(PLATFORM_CARD, "flex flex-col gap-1 p-4")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-bold text-foreground capitalize">
        {value}
      </span>
    </div>
  );
}

/**
 * Support access: what the workspace looks like, for troubleshooting, and
 * the way in to sign in as its admin.
 * Read-only by construction -- a server component with no actions, built from
 * a snapshot the service loaded after checking and auditing the grant.
 */
export function WorkspaceView({
  snapshot,
  signInAsName,
}: {
  snapshot: WorkspaceSnapshot;
  /** The admin support may sign in as, when the grant allows it. */
  signInAsName?: string | null;
}) {
  const { request, tenant, subscription } = snapshot;
  const totalTickets = Object.values(snapshot.ticketCounts).reduce(
    (sum, n) => sum + n,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/platform/tenants"
        className="flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Tenants
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Support access · {tenant.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          /{tenant.slug} · {tenant.planName} plan · created{" "}
          {formatDate(tenant.createdAt)}
        </p>
      </div>

      <section
        aria-label="What this page is for"
        className="flex flex-col gap-4 rounded-[14px] border border-sky-200 bg-sky-50 p-4 text-sky-950 sm:p-5 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100"
      >
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-sm">
            {tenant.name} asked for help on <strong>{request.number}</strong>{" "}
            and gave support access to their workspace. Start by looking around.
            Sign in only when you need to see or change exactly what they do.
          </p>
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium">
            <Lock className="size-3.5" aria-hidden />
            Access ends {formatSupportTime(request.accessExpiresAt)}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1.5 rounded-lg border border-sky-200 bg-white/70 p-3.5 dark:border-sky-900/60 dark:bg-sky-950/30">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Eye className="size-4" aria-hidden />
              Look around (read-only)
            </p>
            <p className="text-xs leading-normal">
              The summary below: status, tickets, team, SLA policies and
              billing. Nothing can change from here. This visit is recorded in
              their audit log.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 rounded-lg border border-sky-200 bg-white/70 p-3.5 dark:border-sky-900/60 dark:bg-sky-950/30">
            <div className="flex flex-col gap-1.5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <LogIn className="size-4" aria-hidden />
                Sign in as {signInAsName ?? "their admin"} (full access)
              </p>
              <p className="text-xs leading-normal">
                Opens {tenant.name} as the admin who granted access, to
                reproduce and fix the problem. Every change is recorded in their
                audit log as platform support.
              </p>
            </div>
            {signInAsName ? (
              <SignInAsButton
                requestId={request.id}
                name={signInAsName}
                workspaceName={tenant.name}
                accessEndsAt={request.accessExpiresAt}
                className="w-full sm:w-fit"
              />
            ) : (
              <p className="text-xs font-medium">
                Not available: the admin who granted access is no longer an
                active Tenant Admin, or the workspace is blocked.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className={PLATFORM_STAT_GRID}>
        <Stat
          label="Workspace status"
          value={tenant.blockedAt ? "Blocked" : tenant.status}
        />
        <Stat
          label="Subscription"
          value={
            subscription
              ? `${subscription.status.replace("_", " ")}${subscription.paymentFailures ? ` · ${subscription.paymentFailures} failed` : ""}`
              : "None"
          }
        />
        <Stat
          label="Team"
          value={`${snapshot.team.filter((m) => m.status === "active").length} active / ${snapshot.team.length}`}
        />
        <Stat
          label="Customers"
          value={snapshot.customers.toLocaleString("en-US")}
        />
      </div>

      {tenant.blockedAt && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          Blocked since {formatDate(tenant.blockedAt)}
          {tenant.blockReason ? `: ${tenant.blockReason}` : ""}.
        </p>
      )}

      <Section title={`Tickets (${totalTickets.toLocaleString("en-US")})`}>
        <div className="flex flex-wrap gap-2">
          {Object.entries(snapshot.ticketCounts).map(([status, count]) => (
            <ToneBadge key={status} tone={TICKET_TONES[status] ?? "muted"}>
              {TICKET_STATUS_LABELS[status] ?? status} · {count}
            </ToneBadge>
          ))}
        </div>
        <DataTable
          rows={snapshot.tickets}
          rowKey={(t) => String(t.number)}
          empty="No tickets yet."
          summary="25 most recently updated"
          columns={[
            {
              key: "subject",
              header: "Ticket",
              primary: true,
              cell: (t) => (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{t.subject}</span>
                  <span className="text-xs text-muted-foreground">
                    #{t.number} · {t.requester}
                  </span>
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              cell: (t) => (
                <ToneBadge tone={TICKET_TONES[t.status] ?? "muted"}>
                  {TICKET_STATUS_LABELS[t.status] ?? t.status}
                </ToneBadge>
              ),
            },
            {
              key: "priority",
              header: "Priority",
              cell: (t) => (
                <ToneBadge
                  tone={PRIORITY_TONES[t.priority] ?? "muted"}
                  className="capitalize"
                >
                  {t.priority}
                </ToneBadge>
              ),
            },
            { key: "assignee", header: "Assignee", cell: (t) => t.assignee },
            {
              key: "updated",
              header: "Updated",
              cell: (t) => (
                <span className="whitespace-nowrap text-muted-foreground">
                  {formatSupportTime(t.updatedAt)}
                </span>
              ),
            },
          ]}
        />
      </Section>

      <Section title={`Team (${snapshot.team.length})`}>
        <DataTable
          rows={snapshot.team}
          rowKey={(m, i) => `${m.email}-${i}`}
          empty="No team members."
          columns={[
            {
              key: "name",
              header: "Member",
              primary: true,
              cell: (m) => (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">
                    {m.name}
                    {m.isOwner && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        (owner)
                      </span>
                    )}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {m.email}
                  </span>
                </div>
              ),
            },
            { key: "role", header: "Role", cell: (m) => m.role },
            {
              key: "status",
              header: "Status",
              cell: (m) => (
                <ToneBadge
                  tone={
                    m.status === "active"
                      ? "green"
                      : m.status === "invited"
                        ? "blue"
                        : "muted"
                  }
                  className="capitalize"
                >
                  {m.status}
                </ToneBadge>
              ),
            },
          ]}
        />
      </Section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title={`SLA policies (${snapshot.slaPolicies.length})`}>
          <DataTable
            rows={snapshot.slaPolicies}
            rowKey={(p, i) => `${p.name}-${i}`}
            empty="No SLA policies."
            columns={[
              {
                key: "name",
                header: "Policy",
                primary: true,
                cell: (p) => (
                  <span className="font-medium">
                    {p.name}
                    {p.isDefault && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        (default)
                      </span>
                    )}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                cell: (p) => (
                  <ToneBadge
                    tone={p.status === "active" ? "green" : "muted"}
                    className="capitalize"
                  >
                    {p.status}
                  </ToneBadge>
                ),
              },
              {
                key: "applies",
                header: "Applies to",
                cell: (p) => <span className="capitalize">{p.appliesTo}</span>,
              },
            ]}
          />
        </Section>

        <Section title="Business hours & billing">
          <div className={cn(PLATFORM_CARD, "divide-y divide-muted px-4")}>
            {snapshot.businessHours.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                No business hours calendar.
              </p>
            ) : (
              snapshot.businessHours.map((h) => (
                <div
                  key={h.name}
                  className="flex justify-between gap-3 py-3 text-sm"
                >
                  <span className="text-muted-foreground">{h.name}</span>
                  <span className="font-medium">{h.timezone}</span>
                </div>
              ))
            )}
            <div className="flex justify-between gap-3 py-3 text-sm">
              <span className="text-muted-foreground">Seats</span>
              <span className="font-medium">{subscription?.seats ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-3 py-3 text-sm">
              <span className="text-muted-foreground">Period ends</span>
              <span className="font-medium">
                {formatDate(subscription?.periodEnd)}
              </span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
