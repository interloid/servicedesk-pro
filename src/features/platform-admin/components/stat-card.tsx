import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { KpiTooltip } from "./kpi-tooltip";
import {
  KPI_HINT,
  KPI_ICON,
  KPI_LABEL,
  KPI_TILE,
  KPI_VALUE,
  PLATFORM_CARD,
} from "./platform-ui";

/**
 * The KPI tile every dashboard shares: what it measures on the first line with
 * a small tinted icon on the right, the figure below it, then an optional hint.
 * Text gets the card's full width (the icon no longer takes a column), and
 * label, figure and hint sit at the same height in every card of a row at every
 * width. A label or hint that is cut off shows in full in a tooltip. Same props
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
      <div className={cn(PLATFORM_CARD, KPI_TILE)}>
        <div className="flex items-start justify-between gap-3">
          <p data-kpi-text className={KPI_LABEL}>
            {label}
          </p>
          <span className={cn(KPI_ICON, iconClassName)}>
            <Icon className="size-4" strokeWidth={1.9} aria-hidden />
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className={KPI_VALUE}>{value}</p>
          {hint && (
            <p data-kpi-text className={KPI_HINT}>
              {hint}
            </p>
          )}
        </div>
      </div>
    </KpiTooltip>
  );
}
