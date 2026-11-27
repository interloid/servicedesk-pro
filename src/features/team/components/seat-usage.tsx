import { Armchair } from "lucide-react";

import { DASHBOARD_CARD } from "@/components/shared/dashboard-ui";
import { cn } from "@/lib/utils";
import type { TeamSeats, TeamStatusCounts } from "@/features/team/types/team";

/**
 * Warning colours for the badge and the note under the bar, so "nearly out of
 * seats" reads from across the room instead of only from the number.
 */
function seatTone(seats: TeamSeats) {
  const ratio = seats.limit > 0 ? seats.used / seats.limit : 0;

  if (seats.limit > 0 && ratio >= 1) {
    return {
      badge:
        "bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-950/60 dark:text-red-300",
      text: "text-red-600 dark:text-red-400",
    };
  }

  if (seats.limit > 0 && ratio >= 0.8) {
    return {
      badge:
        "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300",
      text: "text-amber-700 dark:text-amber-400",
    };
  }

  return {
    badge:
      "bg-brand-50 text-brand-700 ring-brand-700/15 dark:bg-brand-700/20 dark:text-brand-100",
    text: "text-muted-foreground",
  };
}

interface Segment {
  key: string;
  label: string;
  count: number;
  /** Colour of the bar segment and, unless `dot` is set, the legend dot. */
  fill: string;
  /** Legend dot colour when it shouldn't follow the bar. */
  dot?: string;
}

interface SeatUsageProps {
  seats: TeamSeats;
  counts: TeamStatusCounts;
}

export function SeatUsage({ seats, counts }: SeatUsageProps) {
  const hasLimit = seats.limit > 0;
  const isFull = hasLimit && seats.seatsLeft === 0;
  const isOver = hasLimit && seats.used > seats.limit;
  const tone = seatTone(seats);

  // Without a limit there is no "free" part, so the bar is split across the
  // seats in use instead of across the plan.
  const scale = hasLimit ? Math.max(seats.limit, seats.used) : seats.used;

  // One bar split by what fills it: invites use a seat too, which a single
  // "7 of 100" fill never said. Disabled members don't, so they sit in the
  // legend only.
  const segments: Segment[] = [
    {
      key: "active",
      label: "Active",
      count: counts.Active,
      fill: isOver
        ? "bg-red-500"
        : isFull
          ? "bg-red-500 opacity-30"
          : "bg-brand-700 dark:bg-emerald-400",
      // Active people are fine however full the plan is, so the dot stays green.
      dot: "bg-brand-700 dark:bg-emerald-400",
    },
    {
      key: "invited",
      label: "Invited",
      count: counts.Invited,
      fill: "bg-amber-500 dark:bg-amber-400",
    },
  ];

  if (hasLimit) {
    segments.push({
      key: "free",
      label: "Remaining",
      count: seats.seatsLeft,
      fill: "bg-slate-200 dark:bg-slate-700",
    });
  }

  const summary = [
    `${counts.Active} active`,
    `${counts.Invited} invited`,
    hasLimit ? `${seats.seatsLeft} free` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <section
      className={cn(DASHBOARD_CARD, "flex flex-col gap-4 p-5")}
      aria-label="Team seats"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-700/20">
            <Armchair className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-heading text-base leading-snug font-bold tracking-tight text-foreground">
              Team seats
            </span>
            <span className="text-sm text-slate-500 tabular-nums">
              {hasLimit
                ? `${seats.used} of ${seats.limit} used`
                : `${seats.used} used`}
            </span>
          </div>
        </div>
        {hasLimit && (
          <span
            className={cn(
              "inline-flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-semibold whitespace-nowrap tabular-nums ring-1 ring-inset",
              tone.badge,
            )}
          >
            {isFull ? "Full" : `${seats.seatsLeft} left`}
          </span>
        )}
      </div>

      <div
        role="img"
        aria-label={`Seats: ${summary}.`}
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-muted"
      >
        {scale > 0 &&
          segments
            .filter((segment) => segment.count > 0)
            .map((segment) => (
              <span
                key={segment.key}
                // A floor of 4px keeps one invite on a 100-seat plan visible.
                className={`h-full min-w-1 ${segment.fill}`}
                style={{ width: `${(segment.count / scale) * 100}%` }}
              />
            ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:flex sm:flex-wrap sm:gap-x-5">
          {segments.map((segment) => (
            <li key={segment.key} className="flex items-center gap-2">
              <span
                className={`size-2.5 shrink-0 rounded-full ${segment.dot ?? segment.fill}`}
                aria-hidden
              />
              <span className="text-slate-500">{segment.label}</span>
              <span className="ml-auto font-semibold text-foreground tabular-nums sm:ml-0">
                {segment.count}
              </span>
            </li>
          ))}
          <li
            className="flex items-center gap-2"
            title="Disabled members don't use a seat."
          >
            <span
              className="size-2.5 shrink-0 rounded-full border-[1.5px] border-slate-400! dark:border-slate-500!"
              aria-hidden
            />
            <span className="text-slate-500">Disabled</span>
            <span className="ml-auto font-semibold text-foreground tabular-nums sm:ml-0">
              {counts.Disabled}
            </span>
          </li>
        </ul>

        {(isFull || !hasLimit) && (
          <p className={`text-xs font-medium ${tone.text}`}>
            {isFull
              ? "No seats left - upgrade your plan or remove someone to invite more."
              : "Seat limits follow your plan."}
          </p>
        )}
      </div>
    </section>
  );
}
