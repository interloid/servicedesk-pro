import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { TenantStatus, UserStatus } from "../types";

// The tenant screens' badge: a soft fill, with no border or dot. Size and tones
// follow TEAM_STATUS_BADGE in features/team/components/team-table.tsx and
// AUDIT_ACTION_BADGE in features/audit/types/audit.ts.
export const BADGE_SIZE = "h-6 px-2.5 text-xs font-semibold";

const BADGE_TONES = {
  green:
    "border-none bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  blue: "border-none bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
  teal: "border-none bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
  violet:
    "border-none bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  amber:
    "border-none bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  red: "border-none bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  muted: "border-none bg-muted text-muted-foreground",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function ToneBadge({
  tone,
  className,
  children,
}: {
  tone: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Badge className={cn(BADGE_SIZE, BADGE_TONES[tone], className)}>
      {children}
    </Badge>
  );
}

const TENANT_STATUS_TONES: Record<TenantStatus, BadgeTone> = {
  active: "green",
  trialing: "blue",
  past_due: "amber",
  suspended: "muted",
  cancelled: "red",
};

const USER_STATUS_TONES: Record<UserStatus, BadgeTone> = {
  active: "green",
  invited: "amber",
  disabled: "muted",
};

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return (
    <ToneBadge tone={TENANT_STATUS_TONES[status]} className="capitalize">
      {status === "suspended" ? "Blocked" : status.replace("_", " ")}
    </ToneBadge>
  );
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return (
    <ToneBadge tone={USER_STATUS_TONES[status]} className="capitalize">
      {status}
    </ToneBadge>
  );
}
