import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  SUPPORT_STATUS_BADGE,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_LABELS_PLATFORM,
  type SupportStatus,
} from "../support";

const SIZE = "h-6 px-2.5 text-xs font-semibold";

export function SupportStatusBadge({
  status,
  side = "tenant",
}: {
  status: SupportStatus;
  side?: "tenant" | "platform";
}) {
  return (
    <Badge className={cn(SIZE, SUPPORT_STATUS_BADGE[status])}>
      {side === "platform"
        ? SUPPORT_STATUS_LABELS_PLATFORM[status]
        : SUPPORT_STATUS_LABELS[status]}
    </Badge>
  );
}
