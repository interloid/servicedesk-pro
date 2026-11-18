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
 * "84 of 100 messages left today" with a small bar: brand colour normally,
 * amber under a fifth, red when used up.
 */
export function ChatUsageMeter({ usage }: { usage: ChatUsage | null }) {
  const remaining = remainingOf(usage);

  if (!usage || remaining === null) {
    // Holds the line's height while the first reading loads.
    return <span className="h-4" aria-hidden />;
  }

  const share = usage.limit > 0 ? remaining / usage.limit : 0;
  const resets = resetTime(usage);
  const tone =
    remaining === 0
      ? "bg-destructive"
      : share <= 0.2
        ? "bg-amber-500"
        : "bg-brand-accent";

  return (
    <span
      className="inline-flex min-w-0 items-center gap-2"
      title={resets ? `Your allowance refills at ${resets}` : undefined}
    >
      <span
        role="meter"
        aria-label="Messages left today"
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={remaining}
        className="relative h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted"
      >
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500",
            tone,
          )}
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      </span>
      <span
        className={cn(
          "truncate tabular-nums",
          remaining === 0 && "font-medium text-destructive",
          remaining > 0 &&
            share <= 0.2 &&
            "font-medium text-amber-700 dark:text-amber-400",
        )}
      >
        {remaining === 0
          ? `Daily limit reached${resets ? ` · back at ${resets}` : ""}`
          : `${remaining} of ${usage.limit} messages left today`}
      </span>
    </span>
  );
}
