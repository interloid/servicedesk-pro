import type { CSSProperties } from "react";
import { Layers, Loader2, Server, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type CheckItem = { label: string; icon: LucideIcon };

const ROW = 48; // px, each service row
const GAP = 10; // px, between rows

/**
 * The loading view for screens that wait on Supabase (System Health, Logs):
 * this server → Supabase → the actual things being checked, with teal pulses
 * running along each connector and a "Checking" spinner per row, staggered so
 * the checks read as running in turn. Drawn in code in the brand colours; on a
 * phone it shows just the list, and with reduced motion it holds still.
 */
export function ServicesCheckLoader({
  caption,
  items,
}: {
  caption: string;
  items: CheckItem[];
}) {
  const height = items.length * ROW + (items.length - 1) * GAP;
  const mid = height / 2;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 md:min-h-0">
      <div className="flex w-full max-w-2xl items-center justify-center">
        {/* This server */}
        <Node
          icon={Server}
          label="This server"
          className="bg-brand-700 text-white shadow-[0_10px_24px_-10px_rgba(15,118,110,0.6)]"
        />

        {/* Server → Supabase: one line with a pulse running along it. */}
        <div className="relative mx-2 hidden h-px w-14 bg-slate-200 sm:block">
          <span className="absolute top-1/2 left-0 size-1.5 -translate-y-1/2 rounded-full bg-brand-600 motion-safe:animate-[sdp-travel_1.6s_ease-in-out_infinite]" />
        </div>

        <Node
          icon={Layers}
          label="Supabase"
          className="bg-brand-50 text-brand-700 ring-1 ring-brand-700/15"
        />

        {/* Supabase → each check: curved connectors with flowing dashes. */}
        <svg
          aria-hidden
          viewBox={`0 0 80 ${height}`}
          preserveAspectRatio="none"
          className="mx-1 hidden w-16 shrink-0 sm:block"
          style={{ height }}
        >
          {items.map((item, index) => {
            const y = index * (ROW + GAP) + ROW / 2;
            const d = `M0 ${mid} C 40 ${mid}, 40 ${y}, 80 ${y}`;
            return (
              <g key={item.label}>
                <path d={d} fill="none" stroke="#e2e8f0" strokeWidth={1.5} />
                <path
                  d={d}
                  fill="none"
                  stroke="var(--brand-600)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray="8 120"
                  className="motion-safe:animate-[sdp-flow_1.8s_linear_infinite]"
                  style={{ animationDelay: `${index * 0.3}s` } as CSSProperties}
                />
              </g>
            );
          })}
        </svg>

        {/* The checks themselves. */}
        <ul
          className="ml-4 flex w-full max-w-xs flex-col sm:ml-0 sm:w-60"
          style={{ gap: GAP }}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <li
                key={item.label}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                style={{ height: ROW }}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {item.label}
                </span>
                <span
                  className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-brand-700 motion-safe:animate-[sdp-skeleton_1.6s_ease-in-out_infinite]"
                  style={{ animationDelay: `${index * 0.3}s` } as CSSProperties}
                >
                  <Loader2
                    className="size-3.5 motion-safe:animate-spin"
                    aria-hidden
                  />
                  Checking
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-2.5">
        <p className="text-sm font-medium text-slate-600">{caption}</p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-brand-700/10">
          <div className="h-full w-2/5 rounded-full bg-brand-600 motion-safe:animate-[progress-sweep_1.4s_cubic-bezier(0.65,0,0.35,1)_infinite]" />
        </div>
        <p className="text-xs text-slate-400">
          Supabase can take a few seconds to answer.
        </p>
      </div>
    </div>
  );
}

/** A labelled round-cornered tile in the diagram. */
function Node({
  icon: Icon,
  label,
  className,
}: {
  icon: LucideIcon;
  label: string;
  className: string;
}) {
  return (
    <div className="hidden shrink-0 flex-col items-center gap-2 sm:flex">
      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-2xl",
          className,
        )}
      >
        <Icon className="size-6" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </div>
  );
}
