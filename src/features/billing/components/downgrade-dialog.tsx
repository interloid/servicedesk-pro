"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownCircle,
  CalendarClock,
  Loader2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { FormattedPlan } from "../types";
import { changeTenantPlanAction } from "../billing-actions";
import { cn } from "@/lib/utils";
import { MODAL_BUTTON, MODAL_BUTTON_PRIMARY } from "./modal-buttons";
import { ModalNotice } from "@/components/shared/modal-notice";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePaymentRedirect } from "../hooks/use-payment-redirect";
// Destructive: red on white behind a pale red border, as on the platform's
// confirm dialogs. Important borders: globals.css sets border-border on
// everything, outside any layer.
const CONFIRM_DANGER =
  "border-red-200! bg-card text-red-600 hover:border-red-300! hover:bg-red-50 hover:text-red-700 disabled:opacity-60 dark:border-red-900/50! dark:hover:bg-red-950/30";

interface DowngradeDialogProps {
  tenantSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPlan: FormattedPlan | null;
  currentPlan: FormattedPlan | null;
  usedSeats: number;
  totalSeats: number;
  renewalDate: string | null;
  scheduledToPlan?: string | null;
}

export function DowngradeDialog({
  tenantSlug,
  open,
  onOpenChange,
  targetPlan,
  currentPlan,
  usedSeats,
  totalSeats,
  renewalDate,
  scheduledToPlan,
}: DowngradeDialogProps) {
  const router = useRouter();
  const [isTransitionPending, startTransition] = useTransition();
  const { redirecting, redirect } = usePaymentRedirect();
  const isPending = isTransitionPending || redirecting;

  const isFreeTarget = targetPlan?.priceValue === 0;
  const targetSeatLimit = targetPlan?.seatLimit ?? 0;

  const seatsAtRisk = targetPlan ? Math.max(0, usedSeats - targetSeatLimit) : 0;

  const currentPlanLabel = currentPlan?.name ?? "your current plan";
  const targetName = targetPlan?.name ?? "";
  const targetPrice = targetPlan?.price ?? "";
  const targetSuffix = targetPlan?.priceSuffix ?? "";

  const timing = (() => {
    if (!targetPlan) {
      return {
        headline: "",
        body: "",
        deferred: false,
      };
    }

    return renewalDate
      ? {
          headline: "End of billing period",
          body: isFreeTarget
            ? `You keep ${currentPlanLabel} - including its features and agent seats - until ${renewalDate}. No further charges are made, and the switch to the Free plan applies when your billing period ends.`
            : `You keep ${currentPlanLabel} - including its features and agent seats - until ${renewalDate}. PayPal may ask you to confirm the change; nothing is charged today, and your existing subscription bills ${targetPrice}${targetSuffix} from ${renewalDate}.`,
          deferred: true,
        }
      : {
          headline: "Immediately",
          body: isFreeTarget
            ? "It takes effect right now, and no further charges will be made."
            : `Your existing PayPal subscription moves to ${targetName} straight away - PayPal may ask you to confirm it - and you'll be billed the ${targetName} rate of ${targetPrice}${targetSuffix} from your next cycle.`,
          deferred: false,
        };
  })();

  /**
   * Close the dialog directly.
   *
   * The previous implementation faded the notice first and then
   * closed the dialog after 100ms. Now the complete dialog closes
   * together using the AlertDialog's own animation.
   */
  const handleClose = () => {
    if (isPending) return;

    onOpenChange(false);
  };

  const handleConfirm = () => {
    if (!targetPlan || isPending) return;

    if (
      scheduledToPlan &&
      targetPlan.name.trim().toLowerCase() ===
        scheduledToPlan.trim().toLowerCase()
    ) {
      toast.info(`Downgrade to ${targetPlan.name} already scheduled`);

      onOpenChange(false);
      return;
    }

    startTransition(async () => {
      try {
        const res = await changeTenantPlanAction(tenantSlug, targetPlan.id);

        if (!res.success) {
          toast.error(`Couldn't downgrade to ${targetPlan.name}`, {
            description: res.error || undefined,
          });
          return;
        }

        if (res.approvalUrl) {
          redirect(res.approvalUrl);
          return;
        }

        if (res.scheduled) {
          const when = res.effectiveAt
            ? new Date(res.effectiveAt).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : (renewalDate ?? "the end of your billing period");

          toast.success(`Downgrade to ${targetPlan.name} scheduled`, {
            description: `You keep your current plan until ${when}.`,
          });

          onOpenChange(false);
          router.refresh();
          return;
        }

        onOpenChange(false);
        router.refresh();
      } catch (error) {
        console.error("Downgrade error:", error);

        toast.error(`Couldn't downgrade to ${targetPlan.name}`, {
          description:
            error instanceof Error
              ? error.message
              : "Something went wrong while downgrading the plan.",
        });
      }
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) {
          onOpenChange(next);
        }
      }}
    >
      <AlertDialogContent
        className="
          w-[calc(100%-2rem)]
          data-[size=default]:max-w-110
          data-[size=default]:sm:max-w-125
          overflow-hidden
          rounded-xl
          border
          border-border
          bg-background
          p-0
          shadow-[0_24px_48px_-16px_rgba(15,23,42,0.25)]
          ring-0
        "
      >
        <AlertDialogHeader className="block px-5 pt-5 pb-4 text-left">
          <div className="flex w-full items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <span
                aria-hidden
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full",
                  isFreeTarget
                    ? "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300"
                    : "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300",
                )}
              >
                <ArrowDownCircle className="size-5" strokeWidth={1.75} />
              </span>
              <AlertDialogTitle className="font-heading text-lg font-bold tracking-tight text-foreground">
                Downgrade to {targetName}?
              </AlertDialogTitle>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="
                -mr-1.5
                shrink-0
                rounded-md
                p-1.5
                text-muted-foreground
                transition-colors
                duration-200
                ease-out
                hover:text-foreground
                disabled:pointer-events-none
                disabled:opacity-50
                motion-safe:active:scale-[0.98]
              "
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <AlertDialogDescription asChild>
            <div className="mt-4 space-y-3">
              <ModalNotice
                icon={timing.deferred ? CalendarClock : Zap}
                title={`Takes effect: ${timing.headline}`}
              >
                {timing.body}
              </ModalNotice>

              {targetPlan && seatsAtRisk > 0 && (
                <ModalNotice
                  icon={XCircle}
                  tone="amber"
                  title={`Agent seat usage: ${usedSeats} of ${totalSeats} seats`}
                >
                  {targetPlan.name} includes {targetSeatLimit} agent seats.
                  You&apos;ll need to free up {seatsAtRisk} seat
                  {seatsAtRisk === 1 ? "" : "s"} before this change applies.
                </ModalNotice>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="mx-0 mb-0 gap-3 border-t border-border bg-slate-50/60 px-5 py-4 sm:justify-end dark:bg-muted/30">
          <AlertDialogCancel
            disabled={isPending}
            onClick={(e) => {
              // Prevent Radix from closing immediately.
              e.preventDefault();

              handleClose();
            }}
            className={cn(MODAL_BUTTON, "mt-0 bg-card")}
          >
            Keep my plan
          </AlertDialogCancel>

          <AlertDialogAction
            variant="outline"
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            className={cn(
              MODAL_BUTTON,
              isFreeTarget ? CONFIRM_DANGER : MODAL_BUTTON_PRIMARY,
            )}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}

            {isPending ? "Processing..." : "Confirm downgrade"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
