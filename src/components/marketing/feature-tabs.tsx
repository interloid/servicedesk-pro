"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, Globe, Lock, Minus, ShieldCheck, Timer } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Landing page feature showcase: three tabs, each with a short description and
 * a product preview built from the app's own Table / Input components. The
 * portal tab has a live address preview. Presentational only; nothing here
 * talks to the server.
 *
 * Content mirrors the product (summary.md): SLA targets per priority with
 * business hours and holidays; a portal per workspace on its own subdomain;
 * five roles and a Business-plan audit log.
 */

const TABS = [
  {
    key: "sla",
    label: "Queue & SLA Tracking",
    icon: Timer,
    title: "Every ticket carries its own clock",
    body: "An SLA policy sets first-response and resolution targets for each priority. The clock counts only your business hours, skips holidays, and pauses outside opening times, so the queue always shows what is due next.",
    points: [
      "Targets per priority, in your workspace's time zone",
      "A warning before a target is missed, an alert when it is",
      "Saved views such as Unassigned or Breaching soon",
    ],
  },
  {
    key: "portal",
    label: "Branded Subdomain Portal",
    icon: Globe,
    title: "A customer portal on your own address",
    body: "Every workspace gets a portal where its customers raise requests, follow replies and rate the help they received. Customers only ever see their own requests.",
    points: [
      "Your logo and colours on Pro and Business",
      "Magic-link or password sign-in",
      "Guest requests without an account",
    ],
  },
  {
    key: "access",
    label: "Role-Based Access & Audit Logs",
    icon: ShieldCheck,
    title: "The right access for every person",
    body: "Admins, managers, agents and billing admins each see only what their role allows, and customers stay in the portal. On the Business plan, the audit log records who changed what, and when.",
    points: [
      "Five roles, from workspace admin to customer",
      "Billing admins see billing and plans only",
      "Audit log of ticket, team, policy and plan changes",
    ],
  },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function toSubdomain(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "yourcompany"
  );
}

export function FeatureTabs({ host }: { host: string }) {
  const [active, setActive] = useState<TabKey>("sla");
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const index = TABS.findIndex((tab) => tab.key === active);
  const tab = TABS[index];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    let next: number | null = null;
    if (event.key in step) {
      next = (index + step[event.key] + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = TABS.length - 1;
    }
    if (next === null) return;
    event.preventDefault();
    setActive(TABS[next].key);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-8">
      <div
        role="tablist"
        aria-label="Product features"
        onKeyDown={onKeyDown}
        className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-[#FAFAFA] p-1.5 sm:grid-cols-3"
      >
        {TABS.map((item, i) => {
          const selected = item.key === active;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              ref={(node) => {
                tabRefs.current[i] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.key}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(item.key)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-brand-accent/30",
                selected
                  ? // Emerald accent on the leading edge: left when the tabs
                    // stack (phones), top once they sit in a row.
                    "bg-white text-foreground shadow-[inset_3px_0_0_0_var(--brand-700),0_6px_16px_-6px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 sm:shadow-[inset_0_2px_0_0_var(--brand-700),0_6px_16px_-6px_rgba(15,23,42,0.18)]"
                  : "text-slate-500 hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  selected ? "text-brand-accent" : "text-slate-400",
                )}
                aria-hidden
              />
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${active}`}
        className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-12"
      >
        <div className="lg:pt-2">
          <h3 className="text-2xl font-bold text-foreground">{tab.title}</h3>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            {tab.body}
          </p>
          <ul className="mt-6 flex flex-col gap-3 border-t border-border pt-6">
            {tab.points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 text-sm text-slate-700"
              >
                <Check
                  className="mt-0.5 size-4 shrink-0 text-brand-accent"
                  strokeWidth={2.5}
                  aria-hidden
                />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          {active === "sla" && <SlaPreview />}
          {active === "portal" && <PortalPreview host={host} />}
          {active === "access" && <AccessPreview />}
        </div>
      </div>
    </div>
  );
}

const PREVIEW_CARD = "rounded-xl border border-border bg-white";
const PREVIEW_HEAD =
  "flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4";
const TH = "h-9 bg-[#FAFAFA] px-5 text-xs font-semibold text-slate-500";
const TD = "px-5 py-3 text-sm";

function SlaPreview() {
  const targets = [
    {
      priority: "Urgent",
      first: "15m",
      resolve: "4h",
      tone: "text-destructive-strong",
    },
    {
      priority: "High",
      first: "1h",
      resolve: "8h",
      tone: "text-warning-strong",
    },
    {
      priority: "Normal",
      first: "4h",
      resolve: "1d",
      tone: "text-info-strong",
    },
    { priority: "Low", first: "1d", resolve: "3d", tone: "text-slate-500" },
  ];

  return (
    <div className={PREVIEW_CARD}>
      <div className={PREVIEW_HEAD}>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Standard support
          </p>
          <p className="text-xs text-slate-500">SLA policy · all customers</p>
        </div>
        <span className="rounded-md bg-success-soft px-2 py-0.5 text-xs font-semibold text-success-strong">
          Active
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={TH}>Priority</TableHead>
            <TableHead className={TH}>First response</TableHead>
            <TableHead className={TH}>Resolution</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {targets.map((row) => (
            <TableRow key={row.priority} className="hover:bg-transparent">
              <TableCell className={cn(TD, "font-semibold", row.tone)}>
                {row.priority}
              </TableCell>
              <TableCell className={cn(TD, "text-slate-700 tabular-nums")}>
                {row.first}
              </TableCell>
              <TableCell className={cn(TD, "text-slate-700 tabular-nums")}>
                {row.resolve}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <dl className="grid grid-cols-2 gap-px border-t border-border bg-border text-xs sm:grid-cols-4">
        {[
          { term: "Hours", value: "Mon–Fri, 09:00–18:30" },
          { term: "Time zone", value: "Europe/London" },
          { term: "Holidays", value: "8 this year" },
          { term: "Warn", value: "30m before breach" },
        ].map((item) => (
          <div key={item.term} className="bg-white px-5 py-3">
            <dt className="text-slate-500">{item.term}</dt>
            <dd className="mt-0.5 font-medium text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function PortalPreview({ host }: { host: string }) {
  const inputId = useId();
  const [company, setCompany] = useState("Acme");
  const subdomain = toSubdomain(company);
  const displayName = company.trim() || "Your company";

  return (
    <div className={PREVIEW_CARD}>
      <div className="border-b border-border px-5 py-4">
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-foreground"
        >
          Try your portal address
        </label>
        <Input
          id={inputId}
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          maxLength={40}
          placeholder="Company name"
          autoComplete="off"
          className="mt-2 h-10 rounded-lg bg-white px-3 text-sm"
        />
      </div>

      <div className="p-5">
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex h-8 items-center gap-1.5 border-b border-border bg-[#FAFAFA] px-3 text-xs text-slate-500">
            <Lock className="size-3 shrink-0 text-success" aria-hidden />
            <span className="truncate font-mono" aria-live="polite">
              <span className="font-semibold text-brand-accent">
                {subdomain}
              </span>
              .{host}/portal
            </span>
          </div>
          <div className="flex items-center justify-between bg-brand-accent px-4 py-3 text-brand-accent-foreground">
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white/20 text-xs">
                {displayName.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{displayName}</span>
            </span>
            <span className="shrink-0 text-xs opacity-80">Help centre</span>
          </div>
          <div className="space-y-2 p-4">
            <p className="text-xs font-semibold text-slate-500">
              Your requests
            </p>
            {[
              {
                id: "#1042",
                subject: "Can't download last month's invoice",
                state: "Awaiting your reply",
                tone: "bg-warning-soft text-warning-strong",
              },
              {
                id: "#1037",
                subject: "Add two seats to our plan",
                state: "Solved",
                tone: "bg-success-soft text-success-strong",
              },
            ].map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {request.id}
                  </span>
                  <span className="truncate text-sm text-foreground">
                    {request.subject}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                    request.tone,
                  )}
                >
                  {request.state}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type Access = "yes" | "view" | "no";

const ROLES = ["Admin", "Manager", "Agent", "Billing"] as const;

// Mirrors the role rules in src/lib/tenancy.ts and the per-page gates.
const PERMISSIONS: {
  area: string;
  access: [Access, Access, Access, Access];
}[] = [
  { area: "Tickets & customers", access: ["yes", "yes", "yes", "no"] },
  { area: "SLA policies", access: ["yes", "yes", "view", "no"] },
  { area: "Team & roles", access: ["yes", "yes", "no", "no"] },
  { area: "Branding", access: ["yes", "yes", "no", "no"] },
  { area: "Audit log", access: ["yes", "yes", "no", "no"] },
  { area: "Billing & plans", access: ["yes", "no", "no", "yes"] },
];

const AUDIT = [
  {
    time: "09:42",
    actor: "Priya Kapoor",
    action: "Changed priority on #4821",
    detail: "High → Urgent",
  },
  {
    time: "09:31",
    actor: "Sam Okafor",
    action: "Invited a team member",
    detail: "maya@acme.com as Agent",
  },
  {
    time: "09:10",
    actor: "Priya Kapoor",
    action: "Updated SLA policy",
    detail: "Standard support",
  },
];

function AccessCell({ value }: { value: Access }) {
  if (value === "yes") {
    return (
      <Check
        className="mx-auto size-4 text-brand-accent"
        strokeWidth={2.5}
        aria-label="Full access"
      />
    );
  }
  if (value === "view") {
    return (
      <span className="block text-center text-xs font-medium text-slate-500">
        View
      </span>
    );
  }
  return (
    <Minus className="mx-auto size-4 text-slate-300" aria-label="No access" />
  );
}

function AccessPreview() {
  return (
    <div className="flex flex-col gap-4">
      <div className={PREVIEW_CARD}>
        <div className={PREVIEW_HEAD}>
          <p className="text-sm font-semibold text-foreground">
            Role permissions
          </p>
          <p className="text-xs text-slate-500">
            Customers use the portal only
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={TH}>Area</TableHead>
              {ROLES.map((role) => (
                <TableHead key={role} className={cn(TH, "px-3 text-center")}>
                  {role}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERMISSIONS.map((row) => (
              <TableRow key={row.area} className="hover:bg-transparent">
                <TableCell
                  className={cn(TD, "py-2.5 font-medium text-foreground")}
                >
                  {row.area}
                </TableCell>
                {row.access.map((value, i) => (
                  <TableCell key={ROLES[i]} className="px-3 py-2.5">
                    <AccessCell value={value} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className={PREVIEW_CARD}>
        <div className={PREVIEW_HEAD}>
          <p className="text-sm font-semibold text-foreground">Audit log</p>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            Business plan
          </span>
        </div>
        <ul className="divide-y divide-border">
          {AUDIT.map((entry) => (
            <li
              key={entry.time}
              className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 px-5 py-3"
            >
              <span className="text-xs text-slate-400 tabular-nums">
                {entry.time}
              </span>
              <span className="min-w-0 text-sm">
                <span className="font-medium text-foreground">
                  {entry.actor}
                </span>{" "}
                <span className="text-slate-600">{entry.action}</span>
                <span className="block truncate text-xs text-slate-500">
                  {entry.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
