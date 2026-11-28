"use client";

import { useEffect, useState } from "react";
import { MoonStar } from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";
import { formatOpeningLong } from "@/features/tickets/lib/sla";
import {
  ClosedReason,
  SlaCalendar,
  closedReason,
  nextWorkingStart,
  usableCalendar,
} from "@/features/tickets/lib/sla-calendar";

const REASONS = {
  holiday: "Today is a holiday.",
  non_working_day: "Today is a non-working day.",
  before_hours: "It's before business hours.",
  after_hours: "It's outside business hours.",
} as const;

export interface SupportClosed {
  reason: ClosedReason;
  opensAt: number | null;
  /** Noon of the viewer's day, for "today" / "tomorrow" in the opening. */
  today: number;
}

/** The closed state at this moment, as a string so equal states compare equal. */
function snapshot(cal: SlaCalendar | null): string {
  const now = Date.now();
  const reason = closedReason(now, cal);
  if (!reason) return "";
  const d = new Date(now);
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  return `${reason}|${nextWorkingStart(now, cal) ?? ""}|${today.getTime()}`;
}

/**
 * Whether the ticket's business hours are closed right now; null while open
 * or on a 24/7 policy. Checked each minute, but the state only changes when
 * the answer does (at opening, closing, or a new day), so a caller as large
 * as the ticket page re-renders a few times a day, not every minute.
 */
export function useSupportClosed(
  calendar: SlaCalendar | null | undefined,
): SupportClosed | null {
  const cal = usableCalendar(calendar);
  const [key, setKey] = useState(() => snapshot(cal));

  useEffect(() => {
    if (!cal) return;
    const id = setInterval(() => setKey(snapshot(cal)), 60_000);
    return () => clearInterval(id);
  }, [cal]);

  if (!cal || !key) return null;
  const [reason, opensAt, today] = key.split("|");
  return {
    reason: reason as ClosedReason,
    opensAt: opensAt ? Number(opensAt) : null,
    today: Number(today),
  };
}

/**
 * Above the composer while support is closed: replies are held until the
 * next opening, which this names.
 */
export function SupportClosedNotice({ closed }: { closed: SupportClosed }) {
  const { reason, opensAt, today } = closed;
  // The opening is shown in the viewer's time zone, which the server can't
  // know, so it's left out of the server render.
  const mounted = useMounted();
  return (
    <div
      role="status"
      suppressHydrationWarning
      className="mb-3 flex items-start gap-3 rounded-xl border border-amber-200 border-l-4 border-l-amber-400 bg-amber-50 px-3.5 py-3 dark:border-amber-900/50 dark:border-l-amber-500 dark:bg-amber-950/30"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
        <MoonStar className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 text-xs">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          Support is currently closed
        </p>
        <p
          className="mt-0.5 leading-relaxed text-amber-800 dark:text-amber-200/90"
          suppressHydrationWarning
        >
          {REASONS[reason]}
          {mounted && opensAt !== null
            ? ` Our team will resume ${formatOpeningLong(opensAt, today)}. Replies are disabled until then.`
            : " Replies are disabled until business hours resume."}
        </p>
      </div>
    </div>
  );
}
