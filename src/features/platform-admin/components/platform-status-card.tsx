import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ToneBadge } from "./status-badge";

/** The blocked-state result card, for screens the platform settings turn on. */
export function PlatformStatusCard({
  icon: Icon,
  title,
  description,
  status,
  supportEmail,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  status: string;
  supportEmail: string;
  action: React.ReactNode;
}) {
  return (
    <Card className="w-full max-w-md border-border text-center shadow-lg">
      <CardHeader className="flex flex-col items-center pb-4">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
          <Icon className="size-8 text-red-600 dark:text-red-400" aria-hidden />
        </div>
        <CardTitle className="text-2xl font-bold">{title}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-3 rounded-lg border bg-muted/50 p-4 text-left">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-medium text-muted-foreground">Status</span>
            <ToneBadge tone="red">{status}</ToneBadge>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-medium text-muted-foreground">Support</span>
            <span className="min-w-0 truncate font-semibold text-foreground">
              {supportEmail}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t pt-4">{action}</CardFooter>
    </Card>
  );
}
