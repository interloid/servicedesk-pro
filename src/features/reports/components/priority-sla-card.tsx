"use client";

import React from "react";
import {
  CircleCheck,
  FileX2,
  Flame,
  Gauge,
  Info,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PrioritySlaMetric } from "../types/types";
import { ReportPanelHeading } from "./panel-heading";
import { REPORT_CARD } from "./styles";

interface PriorityStyle {
  icon: LucideIcon;
  /** Soft icon chip. */
  chip: string;
  bar: string;
}

const PRIORITY_STYLE: Record<string, PriorityStyle> = {
  Urgent: {
    icon: TriangleAlert,
    chip: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300",
    bar: "bg-red-500",
  },
  High: {
    icon: Flame,
    chip: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  Normal: {
    icon: Zap,
    chip: "bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300",
    bar: "bg-sky-500",
  },
  Low: {
    icon: CircleCheck,
    chip: "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300",
    bar: "bg-brand-700",
  },
};

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * A priority with nothing to judge yet: an empty-state row in place of a "—",
 * so it reads as "nothing happened" rather than as a missing figure.
 */
function EmptyPriorityTile({ item }: { item: PrioritySlaMetric }) {
  const noTickets = item.ticketsCount === 0;

  // Stacked rather than side by side: four tiles share one row, which leaves
  // no room for the icon beside the text.
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-slate-50/50 p-3 sm:p-4 dark:bg-muted/30">
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-muted"
        >
          <FileX2 className="size-4" strokeWidth={1.75} />
        </span>
        <p className="truncate text-sm font-semibold text-foreground">
          {item.level}
        </p>
      </div>

      <p className="mt-3 text-sm font-semibold text-foreground">
        {noTickets ? "No tickets yet" : "Awaiting reply"}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">
        {noTickets
          ? `No ${item.level.toLowerCase()} priority tickets in this period`
          : `${plural(item.ticketsCount, "ticket")} still within target`}
      </p>

      <div className="mt-auto pt-3">
        <div
          role="progressbar"
          aria-label={`${item.level} SLA met`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          className="h-2 w-full rounded-full bg-slate-100 dark:bg-muted"
        />
      </div>
    </div>
  );
}

function PriorityTile({ item }: { item: PrioritySlaMetric }) {
  const style = PRIORITY_STYLE[item.level] ?? PRIORITY_STYLE.Low;
  const Icon = style.icon;
  const pct = item.metPercentage;

  if (item.eligible === 0) return <EmptyPriorityTile item={item} />;

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-3 transition-all hover:-translate-y-px hover:shadow-[0_10px_28px_-12px_rgba(15,23,42,0.18)] sm:p-4">
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            style.chip,
          )}
        >
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <p className="truncate text-sm font-semibold text-foreground">
          {item.level}
        </p>
      </div>

      <p className="mt-3 text-2xl leading-tight font-bold tracking-tight text-foreground tabular-nums">
        {pct}
        <span className="ml-0.5 text-sm font-semibold text-slate-400">%</span>
      </p>
      <p className="truncate text-xs text-slate-500">
        {`${item.met} of ${plural(item.eligible, "ticket")}`}
      </p>

      <div className="mt-auto pt-3">
        <div
          role="progressbar"
          aria-label={`${item.level} SLA met`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? 0}
          className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-muted"
        >
          <div
            className={cn("h-full rounded-full", style.bar)}
            style={{ width: `${pct ?? 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function PrioritySlaCard({ items }: { items: PrioritySlaMetric[] }) {
  // Radix tooltips open on hover and focus only, and close on every click of
  // the trigger, so a tap on a phone never shows one. Drive it ourselves: a
  // tap toggles it, and tapping anywhere else still dismisses it.
  const [infoOpen, setInfoOpen] = React.useState(false);

  return (
    <Card className={REPORT_CARD}>
      <ReportPanelHeading
        icon={Gauge}
        title="SLA Attainment by Priority"
        description={<>First responses within each ticket&apos;s SLA target</>}
        after={
          <Tooltip open={infoOpen} onOpenChange={setInfoOpen}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="About SLA attainment by priority"
                onClick={(event) => {
                  // Skips Radix's own close-on-click.
                  event.preventDefault();
                  setInfoOpen((open) => !open);
                }}
                className="-m-1 rounded-md p-1 text-slate-400 transition-colors hover:text-brand-700"
              >
                <Info className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              Share of tickets raised in this period whose first public reply
              landed within their SLA target.
            </TooltipContent>
          </Tooltip>
        }
      />

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <PriorityTile key={item.level} item={item} />
        ))}
      </div>
    </Card>
  );
}
