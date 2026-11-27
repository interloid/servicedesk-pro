"use client";

import type { ChatUsage } from "@/features/chatbot/chatbot";
import { cn } from "@/lib/utils";

export function remainingOf(usage: ChatUsage | null): number | null {
  return usage ? Math.max(0, usage.limit - usage.used) : null;
}

export function resetTime(usage: ChatUsage | null): string | null {
  if (!usage?.resetsAt) return null;

  const at = new Date(usage.resetsAt);
  const sameDay = at.toDateString() === new Date().toDateString();

  return at.toLocaleString(undefined, {
    ...(sameDay ? {} : { weekday: "short" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The daily allowance, kept quiet: "84 left today" in faint text while there
 * is plenty, with a small bar and amber once under a fifth, red when used up.
 * The full sentence is in the tooltip and for screen readers.
 */
export function ChatUsageMeter({ usage }: { usage: ChatUsage | null }) {
  const remaining = remainingOf(usage);

  if (!usage || remaining === null) {
    // Holds the line's height while the first reading loads.
    return <span className="h-3.5" aria-hidden />;
  }

  const share = usage.limit > 0 ? remaining / usage.limit : 0;
  const resets = resetTime(usage);
  const low = remaining > 0 && share <= 0.2;
  const full = `${remaining} of ${usage.limit} messages left today`;

  return (
    <span
      role="meter"
      aria-label="Messages left today"
      aria-valuemin={0}
      aria-valuemax={usage.limit}
      aria-valuenow={remaining}
      aria-valuetext={full}
      title={resets ? `${full} · refills at ${resets}` : full}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 tabular-nums",
        remaining === 0
          ? "font-medium text-destructive"
          : low
            ? "font-medium text-amber-700 dark:text-amber-400"
            : "text-muted-foreground/70",
      )}
    >
      {remaining === 0 || low ? (
        <span
          aria-hidden
          className="relative h-1 w-8 shrink-0 overflow-hidden rounded-full bg-muted"
        >
          <span
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500",
              remaining === 0 ? "bg-destructive" : "bg-amber-500",
            )}
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </span>
      ) : null}
      {remaining === 0
        ? `Limit reached${resets ? ` · back at ${resets}` : ""}`
        : `${remaining} left today`}
    </span>
  );
}
