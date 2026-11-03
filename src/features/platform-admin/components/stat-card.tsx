import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { PLATFORM_CARD } from "./platform-ui";

/** Same layout as the tenant audit page's stat cards. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  iconClassName = "bg-primary/10 text-primary",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  iconClassName?: string;
}) {
  return (
    <div className={cn(PLATFORM_CARD, "flex items-center gap-4 p-4 sm:p-5")}>
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl",
          iconClassName,
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-bold tracking-tight break-words text-foreground tabular-nums">
          {value}
        </p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
