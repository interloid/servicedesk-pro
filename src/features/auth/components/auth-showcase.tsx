import { BellRing, Clock3, Globe2, LayoutPanelTop } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The branded right-hand panel of the split sign-in / sign-up layout (lg and
 * up only). Purely decorative: the queue below is sample data, not a live feed.
 * Its fields mirror the real product: ticket #number, the customer's company,
 * where the ticket came from (raised in the portal, or created by an agent),
 * priority, and the SLA timer text the ticket views show.
 */

const COPY = {
  signin: {
    eyebrow: "Live SLA tracking",
    live: true,
    headline: "Pick up right where your queue left off.",
    body: "Every ticket carries a live clock, so your team always knows what to answer next.",
  },
  signup: {
    eyebrow: "Workspace setup",
    live: false,
    headline: "Set up your service desk in minutes.",
    body: "Configure your support queues, business hours, and SLA policies for your team.",
  },
} as const;

const CAPABILITIES = [
  {
    icon: Globe2,
    title: "Time-zone-aware SLAs",
    detail: "Business hours and holidays",
  },
  {
    icon: LayoutPanelTop,
    title: "Customer portal",
    detail: "Self-service requests",
  },
  {
    icon: BellRing,
    title: "Automated escalations",
    detail: "Warnings before a breach",
  },
];

type SlaTone = "warn" | "ok" | "breach";

const SAMPLE_QUEUE: {
  id: string;
  subject: string;
  company: string;
  channel: "Portal" | "Agent";
  opened: string;
  priority: "Urgent" | "High";
  sla: string;
  tone: SlaTone;
}[] = [
  {
    id: "#4821",
    subject: "Checkout fails on mobile Safari",
    company: "Northwind Traders",
    channel: "Portal",
    opened: "18m ago",
    priority: "Urgent",
    sla: "12m left",
    tone: "warn",
  },
  {
    id: "#4817",
    subject: "Refund not received after 5 days",
    company: "Acme Retail",
    channel: "Portal",
    opened: "2h ago",
    priority: "High",
    sla: "1h 40m left",
    tone: "ok",
  },
  {
    id: "#4809",
    subject: "SSO login loops for new hires",
    company: "Globex Corp",
    channel: "Agent",
    opened: "5h ago",
    priority: "High",
    sla: "Breached",
    tone: "breach",
  },
];

const SLA_BADGE: Record<SlaTone, string> = {
  warn: "bg-amber-300/15 text-amber-200 ring-amber-300/30",
  ok: "bg-brand-300/10 text-brand-200 ring-brand-300/25",
  breach: "bg-rose-400/15 text-rose-200 ring-rose-300/30",
};

const SLA_DOT: Record<SlaTone, string> = {
  warn: "bg-amber-300",
  ok: "bg-brand-300",
  breach: "bg-rose-400",
};

const PRIORITY_BADGE = {
  Urgent: "bg-white/12 text-white ring-white/20",
  High: "bg-white/8 text-white/75 ring-white/15",
} as const;

export function AuthShowcase({
  variant,
  className,
}: {
  variant: keyof typeof COPY;
  className?: string;
}) {
  const copy = COPY[variant];

  return (
    <aside
      aria-label="Product highlights"
      className={cn(
        "relative isolate hidden overflow-hidden bg-brand-950 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-center lg:px-12 lg:py-14 xl:px-20",
        className,
      )}
    >
      {/* Grid texture, faded out toward the edges. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 45%, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 45%, black 30%, transparent 80%)",
        }}
      />
      <div
        aria-hidden
        className="absolute -top-32 -right-24 -z-10 size-[28rem] rounded-full bg-teal-400/20 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -left-24 -z-10 size-[26rem] rounded-full bg-brand-500/10 blur-3xl"
      />

      <div className="mx-auto flex w-full max-w-lg flex-col gap-9">
        <div className="flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-teal-100 uppercase ring-1 ring-white/15">
            <span className="relative flex size-2" aria-hidden>
              {copy.live && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-300 opacity-60 motion-reduce:animate-none" />
              )}
              <span className="relative inline-flex size-2 rounded-full bg-brand-300" />
            </span>
            {copy.eyebrow}
          </span>
          <p className="font-heading text-3xl leading-tight font-bold tracking-tight text-balance xl:text-4xl">
            {copy.headline}
          </p>
          <p className="max-w-md text-base leading-relaxed text-teal-50/75">
            {copy.body}
          </p>
        </div>

        {/* Sample SLA queue: illustrative only, hidden from assistive tech. */}
        <div
          aria-hidden
          className="overflow-hidden rounded-2xl border border-white/15! bg-white/[0.06] shadow-2xl shadow-black/20 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10! px-5 py-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clock3 className="size-4 text-teal-200" />
              Priority queue
            </div>
            <span className="text-[11px] font-medium text-teal-100/70">
              <span className="font-semibold text-rose-200">1 breached</span>
              <span className="mx-1.5 text-white/30">·</span>
              <span className="font-semibold text-amber-200">1 due soon</span>
            </span>
          </div>

          <ul className="flex flex-col divide-y divide-white/10!">
            {SAMPLE_QUEUE.map((ticket) => (
              <li key={ticket.id} className="flex flex-col gap-1.5 px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-baseline gap-2.5">
                    <span className="text-[11px] text-teal-100/55 tabular-nums">
                      {ticket.id}
                    </span>
                    <span className="truncate text-sm font-medium text-white/95">
                      {ticket.subject}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1",
                      PRIORITY_BADGE[ticket.priority],
                    )}
                  >
                    {ticket.priority}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2 text-xs text-teal-50/60">
                    <span className="truncate">{ticket.company}</span>
                    <span className="shrink-0 rounded border border-white/20! px-1.5 py-px text-[10px] font-medium text-teal-50/70">
                      {ticket.channel}
                    </span>
                    <span className="shrink-0 text-white/30">·</span>
                    <span className="shrink-0 tabular-nums">
                      {ticket.opened}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1",
                      SLA_BADGE[ticket.tone],
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
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Workspace capabilities. */}
        {/* One row per capability (icon, title, detail on a single line), so
            nothing wraps in the narrow three-column layout this replaced. */}
        <ul className="flex flex-col divide-y divide-white/10! rounded-xl border border-white/15! bg-white/[0.03]">
          {CAPABILITIES.map(({ icon: Icon, title, detail }) => (
            <li key={title} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-300/10 text-brand-300 ring-1 ring-brand-300/20">
                <Icon className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white/90">
                {title}
              </span>
              <span className="shrink-0 text-right text-[11px] whitespace-nowrap text-teal-50/55">
                {detail}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
