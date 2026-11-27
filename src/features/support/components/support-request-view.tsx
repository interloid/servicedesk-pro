"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  Eye,
  EyeOff,
  Info,
  Loader2,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  TEAM_DIALOG_CONTENT,
  TEAM_DIALOG_FOOTER,
  TEAM_MODAL_BUTTON,
  TEAM_MODAL_BUTTON_PRIMARY,
} from "@/features/team/components/modal-buttons";
import {
  DIALOG_FOOTER_BAND,
  DialogIconHeader,
} from "@/features/team/components/dialog-icon-header";
import {
  DASHBOARD_BUTTON,
  DASHBOARD_CARD,
} from "@/components/shared/dashboard-ui";
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

const CARD = cn(DASHBOARD_CARD, "p-4 sm:p-5");

/** A panel heading: round teal icon, title in the heading face, one line. */
function PanelHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100">
        <Icon className="size-4.5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="font-heading text-base leading-snug font-bold tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </div>
    </div>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span className="text-slate-500">{label}</span>
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
        toast.error(
          allow
            ? "Couldn't grant workspace access"
            : "Couldn't withdraw workspace access",
          { description: result.message },
        );
        return;
      }

      toast.success(
        allow ? "Workspace access granted" : "Workspace access withdrawn",
        {
          description: allow
            ? `Support can view your workspace for ${SUPPORT_ACCESS_HOURS} hours.`
            : undefined,
        },
      );
      router.refresh();
    });
  }

  function close() {
    startTransition(async () => {
      const result = await closeSupportRequestAction({ requestId: request.id });

      if (!result.ok) {
        toast.error(`Couldn't close ${request.number}`, {
          description: result.message,
        });
        return;
      }

      toast.success(`${request.number} closed`);
      setConfirmClose(false);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className={cn(CARD, "flex min-w-0 flex-col gap-5")}>
        <div className="-mx-4 -mt-4 border-b border-border px-4 py-3.5 sm:-mx-5 sm:-mt-5 sm:px-5">
          <PanelHeading
            icon={MessageSquare}
            title="Conversation"
            description="Your messages with the platform support team."
          />
        </div>
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
          <PanelHeading icon={Info} title="Details" />
          <div className="mt-3 divide-y divide-border">
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
              <h2 className="flex items-center gap-2 font-heading text-base leading-snug font-bold tracking-tight text-foreground">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full",
                    request.accessActive
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100"
                      : "bg-slate-100 text-slate-500 dark:bg-muted",
                  )}
                >
                  {request.accessActive ? (
                    <Eye className="size-4.5" strokeWidth={1.75} aria-hidden />
                  ) : (
                    <EyeOff
                      className="size-4.5"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  )}
                </span>
                Workspace access
              </h2>
              <p className="mt-1 text-xs leading-normal text-slate-500">
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
          <p className="rounded-lg border border-border bg-slate-50/60 px-3.5 py-3 text-xs leading-normal text-slate-600 dark:bg-muted/30 dark:text-muted-foreground">
            Support acts with your access. Everything they open or change is
            recorded in your audit log as platform support. Turning this off
            signs them out at once.
          </p>
        </section>

        {request.status !== "closed" && (
          <Button
            variant="outline"
            className={cn(
              DASHBOARD_BUTTON,
              "gap-2 bg-card hover:bg-slate-50 dark:hover:bg-muted",
            )}
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
          <DialogIconHeader
            icon={CircleCheck}
            title={<>Close {request.number}?</>}
            description={
              <>
                Close it once your problem is solved. Support access ends, and
                you&apos;ll need a new request to get more help.
              </>
            }
          />
          <DialogFooter
            className={cn(TEAM_DIALOG_FOOTER, DIALOG_FOOTER_BAND, "flex-row")}
          >
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
