"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  TEAM_DIALOG_CONTENT,
  TEAM_DIALOG_FOOTER,
  TEAM_DIALOG_TITLE,
  TEAM_MODAL_BUTTON,
  TEAM_MODAL_BUTTON_PRIMARY,
} from "@/features/team/components/modal-buttons";
import { cn } from "@/lib/utils";

import {
  closeSupportRequestAction,
  replySupportRequestAction,
  setSupportAccessAction,
} from "../support-actions";
import {
  formatSupportTime,
  isOpenSupportStatus,
  SUPPORT_ACCESS_HOURS,
  type SupportRequestDetail,
} from "../support";
import { SupportStatusBadge } from "./support-badges";
import { SupportReplyBox, SupportThread } from "./support-thread";

const CARD = "rounded-[14px] border border-border bg-card p-4 shadow-xs sm:p-5";

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

export function SupportRequestView({
  request,
}: {
  request: SupportRequestDetail;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmClose, setConfirmClose] = useState(false);
  const open = isOpenSupportStatus(request.status);

  function toggleAccess(allow: boolean) {
    startTransition(async () => {
      const result = await setSupportAccessAction({
        requestId: request.id,
        allow,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(
        allow
          ? `Support can view your workspace for ${SUPPORT_ACCESS_HOURS} hours.`
          : "Workspace access withdrawn.",
      );
      router.refresh();
    });
  }

  function close() {
    startTransition(async () => {
      const result = await closeSupportRequestAction({ requestId: request.id });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(`${request.number} closed.`);
      setConfirmClose(false);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className={cn(CARD, "flex min-w-0 flex-col gap-6")}>
        <SupportThread request={request} viewer="tenant" />
        <div className="border-t border-border pt-5">
          <SupportReplyBox
            requestId={request.id}
            placeholder="Add details or answer the support team…"
            disabledReason={
              request.status === "closed"
                ? "This request is closed. Create a new request if you still need help."
                : undefined
            }
            send={replySupportRequestAction}
            onSent={() => router.refresh()}
          />
        </div>
      </section>

      <aside className="flex min-w-0 flex-col gap-4">
        <section className={CARD}>
          <h2 className="text-sm font-semibold text-foreground">Details</h2>
          <div className="mt-1 divide-y divide-muted">
            <Fact label="Status">
              <SupportStatusBadge status={request.status} />
            </Fact>
            <Fact label="Opened by">{request.createdByName}</Fact>
            <Fact label="Opened">{formatSupportTime(request.createdAt)}</Fact>
            {request.resolvedAt && (
              <Fact label={request.status === "closed" ? "Closed" : "Resolved"}>
                {formatSupportTime(request.resolvedAt)}
              </Fact>
            )}
          </div>
        </section>

        <section className={cn(CARD, "flex flex-col gap-3")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                {request.accessActive ? (
                  <Eye className="size-4 text-primary" aria-hidden />
                ) : (
                  <EyeOff
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                )}
                Workspace access
              </h2>
              <p className="text-xs leading-normal text-muted-foreground">
                {request.accessActive
                  ? `Support can access your workspace and sign in as you until ${formatSupportTime(request.accessExpiresAt)}.`
                  : open
                    ? `Let support access your workspace and sign in as you for ${SUPPORT_ACCESS_HOURS} hours.`
                    : "Access ends when a request is resolved or closed."}
              </p>
            </div>
            <Switch
              aria-label="Allow support to access my workspace"
              checked={request.accessActive}
              disabled={isPending || (!open && !request.accessActive)}
              onCheckedChange={toggleAccess}
            />
          </div>
          <p className="text-xs leading-normal text-muted-foreground">
            Support acts with your access. Everything they open or change is
            recorded in your audit log as platform support. Turning this off
            signs them out at once.
          </p>
        </section>

        {request.status !== "closed" && (
          <Button
            variant="outline"
            className="h-10 gap-2 rounded-lg font-semibold shadow-none"
            disabled={isPending}
            onClick={() => setConfirmClose(true)}
          >
            <CircleCheck className="size-4" aria-hidden />
            Close request
          </Button>
        )}
      </aside>

      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent className={cn("sm:max-w-115", TEAM_DIALOG_CONTENT)}>
          <DialogHeader className="pr-6">
            <DialogTitle className={TEAM_DIALOG_TITLE}>
              Close {request.number}?
            </DialogTitle>
            <DialogDescription>
              Close it once your problem is solved. Support access ends, and
              you&apos;ll need a new request to get more help.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={cn(TEAM_DIALOG_FOOTER, "flex-row")}>
            <Button
              variant="outline"
              className={cn(TEAM_MODAL_BUTTON, "flex-1 sm:flex-none")}
              disabled={isPending}
              onClick={() => setConfirmClose(false)}
            >
              Cancel
            </Button>
            <Button
              className={cn(
                TEAM_MODAL_BUTTON,
                TEAM_MODAL_BUTTON_PRIMARY,
                "flex-1 sm:flex-none",
              )}
              disabled={isPending}
              onClick={close}
            >
              {isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              Close request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
