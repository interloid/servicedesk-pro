import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { KpiTooltip } from "./kpi-tooltip";
import { PLATFORM_CARD } from "./platform-ui";

/**
 * A KPI card in the overview's style: a round tinted icon on the left, then
 * the figure in the heading face, its label and an optional hint. Content is
 * top-aligned and the label and hint keep to one line each, so figures line
 * up across a row at every width; cut-off text shows in a tooltip. Same props
 * as before, so every caller keeps its own icon colours.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  iconClassName = "bg-brand-50 text-brand-700",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  iconClassName?: string;
}) {
  return (
    <KpiTooltip label={label} hint={hint}>
      <div
        className={cn(
          PLATFORM_CARD,
          "flex items-start gap-4 p-5 transition-all hover:-translate-y-px hover:shadow-[0_10px_28px_-12px_rgba(15,23,42,0.18)]",
        )}
      >
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full",
            iconClassName,
          )}
        >
          <Icon className="size-5.5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-[1.625rem] leading-tight font-bold tracking-tight break-words text-foreground tabular-nums">
            {value}
          </p>
          <p
            data-kpi-text
            className="truncate text-sm leading-snug font-medium text-slate-600"
          >
            {label}
          </p>
          {hint && (
            <p
              data-kpi-text
              className="truncate text-xs leading-snug text-slate-400"
            >
              {hint}
            </p>
          )}
        </div>
      </div>
    </KpiTooltip>
  );
}
