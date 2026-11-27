"use client";
import React from "react";
import {
  CalendarDays,
  CircleCheck,
  CirclePause,
  Clock,
  FileText,
  Lock,
  ShieldCheck,
} from "lucide-react";
import {
  DASHBOARD_CARD,
  DASHBOARD_STAT_GRID,
  DashboardPageHeader,
  StatCard,
} from "@/components/shared/dashboard-ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BADGE_TONES, StatusBadge } from "./status-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { NewPolicyButton } from "./new-policy-button";
import {
  formatUpdatedDate,
  formatWorkingDays,
  formatWorkingHours,
} from "../format";
import { formatDurationShort, slaDayMins } from "../duration";
import {
  POLICY_IN_USE_MESSAGE,
  SlaPolicy,
  SlaPolicyQuota,
  describePolicyLimit,
  hasPolicyRoom,
} from "../types/types";
import { useRouter } from "next/navigation";

interface SlaPoliciesPageProps {
  tenant: string;
  initialPolicies: SlaPolicy[];
  /** The plan's cap, so the create button can be gated before it's pressed. */
  policyQuota: SlaPolicyQuota;
  /** Agents may look at policies but not create them. */
  canManage: boolean;
}

const COLUMNS = [
  "Policy name",
  "Business hours",
  "SLA targets",
  "Applied to",
  "Updated at",
  "Status",
];

interface ClickablePolicyRowProps {
  href: string;
  children: React.ReactNode;
}

export function ClickablePolicyRow({
  href,
  children,
}: ClickablePolicyRowProps) {
  const router = useRouter();

  const navigate = () => {
    router.push(href);
  };

  return (
    <TableRow
      tabIndex={0}
      role="link"
      onClick={navigate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate();
        }
      }}
      className={cn(
        "cursor-pointer border-border align-middle transition-colors",
        "hover:bg-slate-50/60",
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-brand-accent focus-visible:ring-inset",
      )}
    >
      {children}
    </TableRow>
  );
}
/**
 * A Server Component: the list has no client state, so it renders straight
 * from the server's rows and a refresh always shows the latest ones.
 */
export const SlaPoliciesPage: React.FC<SlaPoliciesPageProps> = ({
  tenant,
  initialPolicies: policies,
  policyQuota,
  canManage,
}) => {
  // createSlaPolicy enforces the same cap on the server.
  const canCreate = hasPolicyRoom(policyQuota, policies.length);
  const countOf = (status: SlaPolicy["status"]) =>
    policies.filter((policy) => policy.status === status).length;

  return (
    <div className="h-full overflow-y-auto p-4 font-sans text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full flex-col gap-6">
        <DashboardPageHeader
          eyebrow="Workspace"
          icon={Clock}
          title="SLA policies"
          description="Manage response and resolution targets for your support team."
          action={
            canManage ? (
              <NewPolicyButton
                href={`/${tenant}/sla/new`}
                disabledReason={
                  canCreate ? null : describePolicyLimit(policyQuota)
                }
              />
            ) : null
          }
        />

        <div className={DASHBOARD_STAT_GRID}>
          <StatCard
            icon={ShieldCheck}
            iconClassName="bg-brand-50 text-brand-700"
            label="Total policies"
            value={policies.length.toLocaleString("en-US")}
          />
          <StatCard
            icon={CircleCheck}
            iconClassName="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
            label="Active"
            value={countOf("active").toLocaleString("en-US")}
          />
          <StatCard
            icon={FileText}
            iconClassName="bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300"
            label="Drafts"
            value={countOf("draft").toLocaleString("en-US")}
          />
          <StatCard
            icon={CirclePause}
            iconClassName="bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground"
            label="Paused"
            value={countOf("paused").toLocaleString("en-US")}
          />
        </div>

        <div className={cn(DASHBOARD_CARD, "overflow-hidden")}>
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3.5 text-sm font-semibold text-foreground tabular-nums">
            {policies.length} {policies.length === 1 ? "policy" : "policies"}
            <span className="text-xs font-normal text-slate-500">
              Open a policy to view or edit its targets
            </span>
          </div>
          <Table className="rounded-none border-0">
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className="hover:bg-transparent">
                {COLUMNS.map((c) => (
                  <TableHead
                    key={c}
                    className="h-10 bg-slate-50/80 px-4 text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-slate-500 uppercase shadow-[inset_0_-1px_0_var(--border)]"
                  >
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {policies.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={COLUMNS.length} className="px-4 py-14">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <span className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <Clock className="size-5" aria-hidden />
                      </span>
                      <p className="max-w-sm text-sm whitespace-normal text-slate-500">
                        No SLA policies yet. Create one to start tracking
                        targets.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                policies.map((policy) => (
                  <PolicyRow key={policy.id} tenant={tenant} policy={policy} />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

function PolicyRow({ tenant, policy }: { tenant: string; policy: SlaPolicy }) {
  const href = `/${tenant}/sla/${policy.id}`;

  const urgent = policy.targets.find((t) => t.priority_scope === "urgent");

  const low = policy.targets.find((t) => t.priority_scope === "low");

  const calendar = policy.business_hours;
  const dayMins = slaDayMins(calendar ?? null);

  return (
    <ClickablePolicyRow href={href}>
      <TableCell className="max-w-60 px-4 py-3.5 align-middle whitespace-normal">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground capitalize">
            {policy.name}
          </span>

          {policy.is_default && (
            <Badge
              className={cn(
                BADGE_TONES.slate,
                "inline-flex h-5 shrink-0 items-center rounded-md border-none px-1.5 text-[10px] leading-none font-semibold tracking-wide uppercase ring-1 ring-slate-500/15 ring-inset",
              )}
            >
              Default
            </Badge>
          )}

          {policy.inUse && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="inline-flex h-5 shrink-0 items-center gap-1 rounded-md border-none bg-amber-50 px-1.5 text-[10px] leading-none font-semibold tracking-wide text-amber-700 uppercase ring-1 ring-amber-600/20 ring-inset">
                    <Lock className="size-3" aria-hidden />
                    In use
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  {POLICY_IN_USE_MESSAGE}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
          {policy.description}
        </p>
      </TableCell>

      <TableCell className="px-4 py-3.5 align-middle whitespace-normal">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            {calendar ? (
              <CalendarDays className="size-4" strokeWidth={1.75} aria-hidden />
            ) : (
              <Clock className="size-4" strokeWidth={1.75} aria-hidden />
            )}
          </span>

          <div>
            <p className="font-semibold text-foreground">
              {calendar ? "Business Hours" : "24/7"}
            </p>

            <p className="text-xs text-slate-500">
              {calendar
                ? `${formatWorkingDays(calendar.workingDays)}, ${formatWorkingHours(calendar)}`
                : "All days, 24 hours"}
            </p>
          </div>
        </div>
      </TableCell>

      <TableCell className="px-4 py-3.5 align-middle">
        <div className="flex flex-col gap-1.5">
          {[
            {
              target: urgent,
              label: "Urgent",
              className: "bg-red-50 text-red-700 ring-red-600/15",
              dot: "bg-red-500",
            },
            {
              target: low,
              label: "Low",
              className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
              dot: "bg-emerald-500",
            },
          ].map(
            ({ target, label, className, dot }) =>
              target && (
                <div
                  key={label}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <span className="font-semibold tabular-nums text-slate-900">
                    {formatDurationShort(
                      target.first_response_mins,
                      target.first_response_unit,
                      dayMins,
                    )}{" "}
                    /{" "}
                    {formatDurationShort(
                      target.resolution_mins,
                      target.resolution_unit,
                      dayMins,
                    )}
                  </span>

                  <Badge
                    className={cn(
                      "h-5 gap-1.5 rounded-md border-none px-1.5 text-[10px] font-semibold",
                      "ring-1 ring-inset",
                      className,
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", dot)} />
                    {label}
                  </Badge>
                </div>
              ),
          )}
        </div>
      </TableCell>

      <TableCell className="px-4 py-3.5 align-middle whitespace-normal">
        <p className="text-slate-900">
          {policy.applies_to === "Selected customers"
            ? `${policy.selected_customer_count} selected customer${
                policy.selected_customer_count === 1 ? "" : "s"
              }`
            : "All customers"}
        </p>

        <p className="text-xs text-slate-500">
          {policy.appliedTickets.toLocaleString("en-US")} ticket
          {policy.appliedTickets === 1 ? "" : "s"}
        </p>
      </TableCell>

      <TableCell className="px-4 py-3.5 align-middle">
        <p className="whitespace-nowrap text-slate-900">
          {formatUpdatedDate(policy.updated_at)}
        </p>

        {policy.updated_by_name && (
          <p className="mt-0.5 whitespace-nowrap text-xs text-slate-500">
            by {policy.updated_by_name}
          </p>
        )}
      </TableCell>
      <TableCell className="px-4 py-3.5 align-middle">
        <StatusBadge status={policy.status} />
      </TableCell>
    </ClickablePolicyRow>
  );
}

export default SlaPoliciesPage;
