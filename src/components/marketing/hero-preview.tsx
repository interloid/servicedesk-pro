import {
  BarChart3,
  Inbox,
  Lock,
  Search,
  Settings,
  Timer,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Landing page hero: a browser window showing a workspace's ticket queue and
 * one open ticket. Decorative sample data (hidden from assistive tech); the
 * fields mirror the real product -- #number, customer company, priority, the
 * SLA timer text the ticket views show, assignee initials.
 */

type Sla = "warn" | "ok" | "breach";
type Priority = "Urgent" | "High" | "Normal" | "Low";

const QUEUE: {
  id: string;
  subject: string;
  company: string;
  priority: Priority;
  sla: string;
  tone: Sla;
  assignee: string;
}[] = [
  {
    id: "#4821",
    subject: "Checkout fails on mobile Safari",
    company: "Northwind Traders",
    priority: "Urgent",
    sla: "12m left",
    tone: "warn",
    assignee: "SO",
  },
  {
    id: "#4817",
    subject: "Refund not received after 5 days",
    company: "Acme Retail",
    priority: "High",
    sla: "1h 40m left",
    tone: "ok",
    assignee: "PK",
  },
  {
    id: "#4809",
    subject: "SSO login loops for new hires",
    company: "Globex Corp",
    priority: "High",
    sla: "Breached",
    tone: "breach",
    assignee: "MR",
  },
  {
    id: "#4802",
    subject: "Invoice PDF shows the wrong VAT number",
    company: "Initech",
    priority: "Normal",
    sla: "6h 05m left",
    tone: "ok",
    assignee: "AL",
  },
  {
    id: "#4798",
    subject: "Can't add a second workspace admin",
    company: "Umbrella Health",
    priority: "Low",
    sla: "1d 2h left",
    tone: "ok",
    assignee: "",
  },
];

const SLA_PILL: Record<Sla, string> = {
  warn: "bg-warning-soft text-warning-strong",
  ok: "bg-success-soft text-success-strong",
  breach: "bg-destructive-soft text-destructive-strong",
};

const SLA_DOT: Record<Sla, string> = {
  warn: "bg-warning",
  ok: "bg-success",
  breach: "bg-destructive",
};

const PRIORITY: Record<Priority, string> = {
  Urgent: "text-destructive-strong",
  High: "text-warning-strong",
  Normal: "text-info-strong",
  Low: "text-muted-foreground",
};

const NAV = [Inbox, Timer, Users, BarChart3, Settings];

export function HeroPreview({ host }: { host: string }) {
  return (
    <div
      aria-hidden
      className="relative mx-auto w-full max-w-6xl rounded-xl border border-slate-200 bg-card text-left shadow-[0_24px_60px_-15px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5"
    >
      {/* Browser chrome */}
      <div className="flex h-10 items-center gap-3 rounded-t-xl border-b border-slate-200 bg-slate-50 px-4">
        <div className="flex shrink-0 gap-1.5">
          <span className="size-2.5 rounded-full bg-slate-300" />
          <span className="size-2.5 rounded-full bg-slate-300" />
          <span className="size-2.5 rounded-full bg-slate-300" />
        </div>
        <div className="mx-auto flex h-6 w-full max-w-sm min-w-0 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-card px-3 text-[11px] text-slate-500">
          <Lock className="size-3 shrink-0 text-success" />
          <span className="truncate font-mono">
            <span className="font-medium text-slate-700">acme.{host}</span>
            /tickets
          </span>
        </div>
        <div className="hidden w-10.5 shrink-0 sm:block" />
      </div>

      <div className="grid min-h-[22rem] grid-cols-1 md:grid-cols-[minmax(0,1fr)_17rem] lg:grid-cols-[3.25rem_minmax(0,1fr)_19rem]">
        {/* App sidebar */}
        <div className="hidden flex-col items-center gap-2 border-r border-slate-100 py-4 lg:flex">
          <span className="mb-2 flex size-7 items-center justify-center rounded-md bg-brand-accent text-[11px] font-bold text-brand-accent-foreground">
            A
          </span>
          {NAV.map((Icon, index) => (
            <span
              key={index}
              className={cn(
                "flex size-8 items-center justify-center rounded-md",
                index === 0
                  ? "bg-brand-accent/10 text-brand-accent"
                  : "text-slate-400",
              )}
            >
              <Icon className="size-4" />
            </span>
          ))}
        </div>

        {/* Queue */}
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Ticket queue
              </p>
              <p className="text-[11px] text-muted-foreground">
                24 open · 2 due within the hour
              </p>
            </div>
            <div className="hidden h-7 w-44 items-center gap-1.5 rounded-md border border-slate-200 px-2 text-[11px] text-slate-400 sm:flex">
              <Search className="size-3.5" />
              Search this view
            </div>
          </div>

          <div className="flex gap-4 border-b border-slate-100 px-4 text-[11px] font-medium">
            <span className="border-b-2 border-brand-accent py-2 text-foreground">
              All open <span className="text-muted-foreground">24</span>
            </span>
            <span className="py-2 text-muted-foreground">Mine 6</span>
            <span className="py-2 text-muted-foreground">Unassigned 3</span>
            <span className="hidden py-2 text-muted-foreground sm:inline">
              Breaching soon 2
            </span>
          </div>

          <ul className="divide-y divide-slate-100">
            {QUEUE.map((ticket, index) => (
              <li
                key={ticket.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5",
                  index === 0 &&
                    "bg-brand-accent/[0.04] shadow-[inset_2px_0_0_var(--brand-accent)]",
                )}
              >
                <span className="hidden size-3.5 shrink-0 rounded-[4px] border border-slate-300 sm:block" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {ticket.id}
                    </span>
                    <span className="truncate text-xs font-medium text-foreground">
                      {ticket.subject}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {ticket.company}
                    <span className="mx-1 text-slate-300">·</span>
                    <span
                      className={cn("font-medium", PRIORITY[ticket.priority])}
                    >
                      {ticket.priority}
                    </span>
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                    SLA_PILL[ticket.tone],
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      SLA_DOT[ticket.tone],
                    )}
                  />
                  {ticket.sla}
                </span>
                <span
                  className={cn(
                    "hidden size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold sm:flex",
                    ticket.assignee
                      ? "bg-slate-100 text-slate-600"
                      : "border border-dashed border-slate-300",
                  )}
                >
                  {ticket.assignee}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Ticket detail */}
        <div className="hidden min-w-0 flex-col gap-3 border-l border-slate-100 bg-slate-50/60 p-4 md:flex">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground tabular-nums">
                #4821
              </span>
              <span className="rounded-full bg-info-soft px-1.5 py-px text-[10px] font-semibold text-info-strong">
                Open
              </span>
            </div>
            <p className="mt-1 text-sm leading-snug font-semibold text-foreground">
              Checkout fails on mobile Safari
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Dana Whitfield · Northwind Traders
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-card p-3">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              SLA · Urgent
            </p>
            {[
              {
                label: "First response",
                value: "12m left",
                width: "86%",
                bar: "bg-warning",
              },
              {
                label: "Resolution",
                value: "3h 40m left",
                width: "18%",
                bar: "bg-success",
              },
            ].map((row) => (
              <div key={row.label} className="mt-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-600">{row.label}</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {row.value}
                  </span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-slate-100">
                  <div
                    className={cn("h-full rounded-full", row.bar)}
                    style={{ width: row.width }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 bg-card p-3 text-[11px] leading-relaxed text-slate-600">
            <p className="font-semibold text-foreground">Dana Whitfield</p>
            Payment page spins forever on iPhone. Desktop works fine. Started
            after this morning&apos;s release.
          </div>

          <div className="rounded-lg border border-note-border bg-note p-3 text-[11px] leading-relaxed text-note-foreground">
            <p className="font-semibold">Internal note · Sam O.</p>
            Reproduced on iOS 18. Looping in @priya from payments.
          </div>
        </div>
      </div>
    </div>
  );
}
