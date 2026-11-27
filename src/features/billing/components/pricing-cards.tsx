"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpCircle,
  Building2,
  Check,
  Clock,
  Crown,
  Gem,
  Info,
  Layers,
  Loader2,
  Rocket,
  RotateCcw,
  Sprout,
  Users,
  X,
  Zap,
} from "lucide-react";

import { FormattedPlan } from "../types";
import { toast } from "sonner";
import { changeTenantPlanAction } from "../billing-actions";
import { usePaymentRedirect } from "../hooks/use-payment-redirect";
import type { BillingDashboardData } from "../services/billing-dashboard.service";
import { usePlatformBrand } from "@/components/shared/platform-brand";
import { cn } from "@/lib/utils";

import { CancelSubscriptionDialog } from "./cancel-subscription";
import { DowngradeDialog } from "./downgrade-dialog";
import { MODAL_BUTTON, MODAL_BUTTON_PRIMARY } from "./modal-buttons";
import { ModalNotice } from "@/components/shared/modal-notice";
import { UndoScheduledChangeButton } from "./undo-scheduled-change-button";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

// The platform plan cards' icon and tint per position, cheapest first.
const PLAN_TONES = [
  { icon: Sprout, tint: "bg-slate-100 text-slate-600" },
  { icon: Rocket, tint: "bg-brand-50 text-brand-700" },
  { icon: Building2, tint: "bg-violet-50 text-violet-600" },
  { icon: Gem, tint: "bg-sky-50 text-sky-600" },
  { icon: Crown, tint: "bg-amber-50 text-amber-600" },
] as const;

/** A soft pill with a hairline ring, as on the platform tables. */
const PILL =
  "inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-semibold ring-1 ring-inset";

interface PricingCardsProps {
  tenantSlug: string;
  currentPlanCode: string;
  plans: FormattedPlan[];
  billingData?: BillingDashboardData | null;
}

export function PricingCards({
  tenantSlug,
  currentPlanCode,
  plans,
  billingData,
}: PricingCardsProps) {
  const router = useRouter();
  const { supportEmail } = usePlatformBrand();

  const [isTransitionPending, startTransition] = useTransition();
  const { redirecting, redirect } = usePaymentRedirect();
  const isPending = isTransitionPending || redirecting;
  const [loadingPlanCode, setLoadingPlanCode] = useState<string | null>(null);
  const [selectedPlanForSwitch, setSelectedPlanForSwitch] =
    useState<FormattedPlan | null>(null);
  const [downgradeTarget, setDowngradeTarget] = useState<FormattedPlan | null>(
    null,
  );
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isUndoConfirmOpen, setIsUndoConfirmOpen] = useState(false);
  const [downgradeOpen, setDowngradeOpen] = useState(false);

  // ONLY a cancellation that did not come from the app locks plan changes.
  //
  // billingStatus is "cancelled" for both kinds, which is why this used to
  // lock either way -- and locking an APP cancellation traps the customer in
  // a decision they are allowed to reverse: choosing a paid plan supersedes a
  // scheduled cancellation, resuming the same suspended agreement and
  // clearing the schedule. Disabling the buttons made the one route out of it
  // unreachable.
  //
  // The test is canReactivate rather than source === "paypal" so it also
  // covers the grace period running out, and the app cancel whose suspend
  // fell back to a real cancel: in every one of those the agreement is dead
  // at PayPal, which is the thing that actually blocks a plan change here.
  const cancellation = billingData?.cancellation ?? null;
  const isBillingLocked =
    billingData?.billingStatus === "cancelled" &&
    cancellation?.canReactivate === false;
  // A cancelled PayPal checkout is announced by /payment/cancel, which the
  // cancel_url points at: it drops that checkout, says so and sends
  // the buyer here. Nothing in the app has ever set ?status=cancelled, so the
  // effect that watched for it could not fire -- and its three state resets
  // were dead twice over, since arriving here from PayPal is a full page load
  // onto a freshly mounted component.

  const announceScheduled = (planName: string, effectiveAt: string | null) => {
    const when = effectiveAt
      ? new Date(effectiveAt).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "the end of your billing period";

    toast.success(`Switch to ${planName} scheduled`, {
      description: `You keep your current plan until ${when}.`,
    });
  };

  const executePlanSwitch = (plan: FormattedPlan) => {
    const scheduledToName = billingData?.scheduledChange?.planName
      ? billingData.scheduledChange.planName.trim().toLowerCase()
      : "";

    if (scheduledToName && plan.name.trim().toLowerCase() === scheduledToName) {
      toast.info(`Switch to ${plan.name} already scheduled`);
      setSelectedPlanForSwitch(null);
      setDowngradeTarget(null);
      return;
    }

    setLoadingPlanCode(plan.id);

    startTransition(async () => {
      let leaving = false;

      try {
        const res = await changeTenantPlanAction(tenantSlug, plan.id);

        if (!res.success) {
          toast.error(`Couldn't switch to ${plan.name}`, {
            description: res.error || undefined,
          });
          return;
        }

        if (res.approvalUrl) {
          // Redirecting to PayPal
          leaving = true;
          redirect(res.approvalUrl);
          return;
        }

        if (res.scheduled) {
          announceScheduled(plan.name, res.effectiveAt ?? null);
          setSelectedPlanForSwitch(null);
          router.refresh();
          return;
        }

        setSelectedPlanForSwitch(null);
        router.refresh();
      } catch (error) {
        console.error("Plan switch error:", error);
        toast.error(`Couldn't switch to ${plan.name}`, {
          description:
            error instanceof Error
              ? error.message
              : "Something went wrong while switching the plan.",
        });
      } finally {
        if (!leaving) setLoadingPlanCode(null);
      }
    });
  };

  const [isOpen, setIsOpen] = useState(false);
  const [prevSelectedPlan, setPrevSelectedPlan] = useState(
    selectedPlanForSwitch,
  );

  if (selectedPlanForSwitch !== prevSelectedPlan) {
    setPrevSelectedPlan(selectedPlanForSwitch);
    setIsOpen(Boolean(selectedPlanForSwitch));
  }

  const handleClose = () => {
    if (isPending) return;
    setIsOpen(false);
  };

  const handleAnimationEnd = () => {
    if (!isOpen) {
      setSelectedPlanForSwitch(null);
    }
  };

  const activeTarget = (currentPlanCode || "").trim().toLowerCase();

  const currentPlan =
    plans.find(
      (plan) =>
        (plan.id || "").trim().toLowerCase() === activeTarget ||
        (plan.code || "").trim().toLowerCase() === activeTarget,
    ) ?? null;

  const currentPrice = currentPlan?.priceValue ?? null;
  const freePlan = plans.find((plan) => plan.priceValue === 0);

  const canCancelCurrent =
    Boolean(billingData) &&
    currentPlan !== null &&
    currentPlan.priceValue > 0 &&
    freePlan !== undefined &&
    freePlan.id !== currentPlan.id;

  const isPendingCancellation = billingData?.billingStatus === "cancelled";
  const scheduledChange = billingData?.scheduledChange ?? null;
  const hasScheduledDowngrade =
    Boolean(scheduledChange) && !isPendingCancellation;

  const scheduledChangeDate = scheduledChange?.effectiveAt
    ? new Date(scheduledChange.effectiveAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const scheduledPlanObj = billingData?.scheduledChange?.planName
    ? plans.find(
        (plan) =>
          (plan.name || "").trim().toLowerCase() ===
          billingData.scheduledChange?.planName?.trim().toLowerCase(),
      )
    : null;

  const scheduledTargetIdentifier = (
    billingData?.scheduledChange?.planName ||
    (scheduledPlanObj
      ? scheduledPlanObj.id || scheduledPlanObj.code || scheduledPlanObj.name
      : "") ||
    ""
  )
    .trim()
    .toLowerCase();

  const selectedSwitchLabel = !selectedPlanForSwitch
    ? ""
    : currentPrice === null
      ? `Switch to ${selectedPlanForSwitch.name}`
      : selectedPlanForSwitch.priceValue < currentPrice
        ? `Downgrade to ${selectedPlanForSwitch.name}`
        : `Upgrade to ${selectedPlanForSwitch.name}`;

  const openSwitchDialog = (plan: FormattedPlan) => {
    if (isBillingLocked) {
      toast.error("Can't change this subscription", {
        description:
          "It was ended at PayPal. Contact support to set up a new one.",
      });
      return;
    }

    if (currentPrice !== null && plan.priceValue < currentPrice) {
      setDowngradeTarget(plan);
      setDowngradeOpen(true);
      return;
    }

    setSelectedPlanForSwitch(plan);
  };

  const openCancelDialog = () => {
    setIsCancelOpen(true);
  };

  const usedSeats = billingData?.seats?.used ?? 0;
  const totalSeats = billingData?.seats?.total ?? 0;

  const renewalDate =
    billingData?.renewalDate && billingData.renewalDate !== "N/A"
      ? billingData.renewalDate
      : null;

  const currentPlanRate = billingData?.plan?.rateValue ?? 0;
  const target = selectedPlanForSwitch;

  const isUpgradeTarget =
    currentPrice !== null &&
    target !== null &&
    target.priceValue > currentPrice;

  const upgradeAmount =
    isUpgradeTarget && target
      ? Math.round(Math.max(0, target.priceValue - currentPlanRate) * 100) / 100
      : 0;

  const dialogTiming = (() => {
    if (!target) {
      return { headline: "", body: "", deferred: false };
    }

    return {
      headline: isUpgradeTarget
        ? `Confirm your ${target.name} upgrade`
        : `Confirm your ${target.name} subscription`,

      body: isUpgradeTarget
        ? `You'll pay $${upgradeAmount.toFixed(2)} today to upgrade from ${
            currentPlan?.name ?? "your current plan"
          } ($${currentPlanRate.toFixed(2)}/month) to ${
            target.name
          } ($${target.priceValue.toFixed(2)}/month). Your ${
            target.name
          } plan will be activated immediately, and you'll be charged ${
            target.price
          }${target.priceSuffix} from your next billing cycle.`
        : `You'll be redirected to PayPal to approve your ${
            target.name
          } subscription at ${
            target.price
          }${target.priceSuffix}. Once PayPal approval is complete, your ${
            target.name
          } plan will be activated.`,

      deferred: false,
    };
  })();

  return (
    <>
      <div className="flex flex-wrap items-stretch justify-center gap-5 xl:gap-6">
        {plans.map((plan, planIdx) => {
          const planId = (plan.id || "").trim().toLowerCase();
          const planCode = (plan.code || "").trim().toLowerCase();
          const planName = (plan.name || "").trim().toLowerCase();

          const isCurrent =
            Boolean(activeTarget) &&
            (planId === activeTarget || planCode === activeTarget);

          const isScheduledTarget =
            hasScheduledDowngrade &&
            scheduledTargetIdentifier !== "" &&
            (planId === scheduledTargetIdentifier ||
              planCode === scheduledTargetIdentifier ||
              planName === scheduledTargetIdentifier);

          const isLoadingThis =
            isPending && loadingPlanCode?.toLowerCase() === planId;

          const isDowngrade =
            currentPrice !== null && plan.priceValue < currentPrice;

          const previousPlan = planIdx > 0 ? plans[planIdx - 1] : null;

          const prevFeatureMap = new Map<string, string | number | undefined>();

          plans.slice(0, planIdx).forEach((previous) => {
            previous.features?.forEach((feature) => {
              const key = feature.label.toLowerCase().split(":")[0].trim();
              prevFeatureMap.set(
                key,
                feature.value as string | number | undefined,
              );
            });
          });

          const rawFeatures = plan.features || [];

          const additionalFeatures = rawFeatures.filter((feature) => {
            const key = feature.label.toLowerCase().split(":")[0].trim();
            if (!prevFeatureMap.has(key)) return true;

            const previousValue = prevFeatureMap.get(key);
            if (
              feature.value !== undefined &&
              feature.value !== previousValue
            ) {
              return true;
            }
            return false;
          });

          const tone = PLAN_TONES[planIdx % PLAN_TONES.length];
          const PlanIcon = tone.icon;

          const ctaLabel = isCurrent
            ? "Manage plan"
            : currentPrice === null
              ? `Choose ${plan.name}`
              : isDowngrade
                ? `Downgrade to ${plan.name}`
                : `Upgrade to ${plan.name}`;

          return (
            <Card
              key={plan.id}
              className={cn(
                "relative flex min-h-136 w-full flex-col gap-0 rounded-xl border! border-border! bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-0 transition-all sm:w-[calc(50%-0.625rem)] xl:w-[calc(33.333%-1rem)]",
                isCurrent
                  ? "border-brand-700/50! ring-1 ring-brand-700/30"
                  : isScheduledTarget
                    ? "border-amber-500/60! ring-1 ring-amber-500/30"
                    : "hover:-translate-y-px hover:shadow-[0_10px_28px_-12px_rgba(15,23,42,0.18)]",
              )}
            >
              {isCurrent && (
                <div className="absolute right-4 top-4 z-10 sm:right-5 sm:top-5">
                  <Badge
                    className={cn(
                      PILL,
                      "border-none bg-brand-50 text-brand-700 shadow-none ring-brand-700/20 hover:bg-brand-50 dark:bg-brand-950/60 dark:text-brand-300",
                    )}
                  >
                    <Crown className="h-3.5 w-3.5" />
                    <span>Current plan</span>
                  </Badge>
                </div>
              )}

              {isScheduledTarget && !isCurrent && (
                <div className="absolute right-4 top-4 z-10 sm:right-5 sm:top-5">
                  <Badge
                    className={cn(
                      PILL,
                      "border-none bg-amber-50 text-amber-800 shadow-none ring-amber-600/20 hover:bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300",
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Upcoming plan</span>
                  </Badge>
                </div>
              )}

              <div className="flex h-full flex-1 flex-col">
                <div className="min-h-25">
                  <div className="flex items-center gap-3 pr-28">
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full",
                        tone.tint,
                      )}
                    >
                      <PlanIcon className="size-5" strokeWidth={1.75} />
                    </span>
                    <h3 className="font-heading text-lg leading-tight font-bold tracking-tight text-foreground">
                      {plan.name}
                    </h3>
                  </div>

                  <p className="mt-3 min-h-10 text-sm leading-5 text-slate-500">
                    {plan.description}
                  </p>
                </div>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-[2rem] leading-none font-bold tracking-tight text-foreground tabular-nums">
                    {plan.price}
                  </span>

                  <span className="text-sm font-medium text-slate-500">
                    {plan.priceSuffix}
                  </span>
                </div>

                <div className="mt-5 flex min-h-11.5 items-center gap-2.5 rounded-lg bg-slate-50 px-3.5 py-2.5 dark:bg-muted/40">
                  <Users className="h-4 w-4 shrink-0 text-slate-400" />

                  <span className="text-xs font-semibold text-foreground">
                    {plan.seatLimitText} agent seats included
                  </span>
                </div>

                <div
                  className={cn(
                    "mt-6 flex-1 border-t pt-5",
                    isCurrent
                      ? "border-t-brand-accent/50!"
                      : isScheduledTarget
                        ? "border-t-amber-500/50!"
                        : "border-t-border",
                  )}
                >
                  {previousPlan ? (
                    <>
                      <div className="flex items-start gap-2.5 rounded-lg px-1 py-2">
                        <Layers className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

                        <p className="text-xs font-medium text-foreground">
                          Everything in {previousPlan.name}, plus:
                        </p>
                      </div>

                      <ul className="mt-3.5 space-y-3">
                        {(additionalFeatures.length > 0
                          ? additionalFeatures
                          : [
                              {
                                label: "Additional capabilities included",
                                value: "",
                              },
                            ]
                        ).map((feature, index) => (
                          <li key={index} className="flex items-start gap-2.5">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 stroke-[2.5] text-brand-700" />

                            <span className="text-xs font-medium text-slate-600">
                              {feature.label}

                              {typeof feature.value === "string" ||
                              typeof feature.value === "number"
                                ? `: ${feature.value}`
                                : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <ul className="space-y-3">
                      {rawFeatures.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2.5">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 stroke-[2.5] text-brand-700" />

                          <span className="text-xs font-medium text-slate-600">
                            {feature.label}

                            {typeof feature.value === "string" ||
                            typeof feature.value === "number"
                              ? `: ${feature.value}`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-2.5">
                  {isCurrent ? (
                    <>
                      {isPendingCancellation || hasScheduledDowngrade ? (
                        <>
                          <div className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-200! bg-amber-50/80 px-3 py-3 text-center text-xs font-medium text-amber-900 dark:border-amber-900/40! dark:bg-amber-950/40 dark:text-amber-200">
                            <Clock className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                            <span>
                              {isPendingCancellation
                                ? renewalDate
                                  ? `Ends on ${renewalDate}`
                                  : "Ends at the end of this period"
                                : `Changes to ${scheduledChange?.planName} on ${
                                    scheduledChangeDate ??
                                    renewalDate ??
                                    "your renewal date"
                                  }`}
                            </span>
                          </div>

                          <Button
                            variant="outline"
                            disabled={isPending || isBillingLocked}
                            onClick={() => setIsUndoConfirmOpen(true)}
                            className="h-10 w-full gap-2 rounded-lg border border-brand-700/40! bg-card text-sm font-semibold text-brand-700 shadow-none hover:bg-brand-50 hover:text-brand-700 dark:text-brand-300 dark:hover:bg-brand-950/30"
                          >
                            <RotateCcw className="h-4 w-4" />
                            {isPendingCancellation
                              ? "Reactivate my plan"
                              : "Keep my current plan"}
                          </Button>
                        </>
                      ) : (
                        canCancelCurrent && (
                          <Button
                            variant="ghost"
                            disabled={isPending || isBillingLocked}
                            onClick={openCancelDialog}
                            className="h-10 w-full rounded-lg border border-red-200! bg-card text-sm font-semibold text-red-600 shadow-none hover:bg-red-50 hover:text-red-700 dark:border-red-900/50! dark:hover:bg-red-950/30"
                          >
                            Cancel subscription
                          </Button>
                        )
                      )}
                    </>
                  ) : isScheduledTarget ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled
                      className="h-10 w-full gap-2 rounded-lg border-amber-300! bg-amber-50/70 text-sm font-semibold text-amber-800 shadow-none dark:border-amber-900/40! dark:bg-amber-950/40 dark:text-amber-200"
                    >
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>
                        Effective on{" "}
                        {scheduledChangeDate ??
                          renewalDate ??
                          "your renewal date"}
                      </span>
                    </Button>
                  ) : (
                    /* Wrap in Tooltip when billing is locked / plan updates are disabled */
                    <TooltipProvider>
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              isBillingLocked && "cursor-not-allowed w-full",
                            )}
                          >
                            <Button
                              type="button"
                              variant={isDowngrade ? "outline" : "default"}
                              disabled={isPending || isBillingLocked}
                              onClick={() => openSwitchDialog(plan)}
                              className={cn(
                                "h-10 w-full gap-2 rounded-lg text-sm font-semibold shadow-none transition-colors",
                                isBillingLocked &&
                                  "pointer-events-none opacity-60",
                                isDowngrade
                                  ? "bg-card text-foreground hover:bg-accent hover:text-brand-700"
                                  : "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90",
                              )}
                            >
                              {isLoadingThis && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              )}
                              <span>{ctaLabel}</span>
                            </Button>
                          </span>
                        </TooltipTrigger>

                        {isBillingLocked && (
                          <TooltipContent
                            side="bottom"
                            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900"
                          >
                            To change or update your plan, please contact our
                            support team at {supportEmail}.
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <AlertDialog
        open={isOpen}
        onOpenChange={(open) => !open && handleClose()}
      >
        <AlertDialogContent
          onAnimationEnd={handleAnimationEnd}
          className="
            w-[calc(100%-2rem)]
            data-[size=default]:max-w-110
            data-[size=default]:sm:max-w-125
            rounded-xl
            border
            border-border
            bg-background
            p-0
            shadow-[0_24px_48px_-16px_rgba(15,23,42,0.25)]
            ring-0
            max-h-[calc(100dvh-2rem)]
            overflow-y-auto
          "
        >
          <AlertDialogHeader className="block px-5 pt-5 pb-4 text-left">
            <div className="flex items-center justify-between gap-4 pr-8">
              <div className="flex min-w-0 items-center gap-3.5">
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"
                >
                  <ArrowUpCircle className="size-5" strokeWidth={1.75} />
                </span>
                <AlertDialogTitle className="font-heading text-lg font-bold tracking-tight text-foreground">
                  {selectedSwitchLabel
                    ? `${selectedSwitchLabel}?`
                    : "Switch Plan"}
                </AlertDialogTitle>
              </div>

              <AlertDialogCancel
                disabled={isPending}
                onClick={handleClose}
                className="
                  absolute
                  right-4
                  top-4
                  z-20
                  flex
                  size-8
                  items-center
                  justify-center
                  rounded-md
                  border-0
                  bg-transparent
                  p-0
                  text-muted-foreground
                  shadow-none
                  hover:bg-transparent
                  hover:text-foreground
                  focus:outline-none
                  focus:ring-2
                  focus:ring-current/20
                  disabled:pointer-events-none
                "
                aria-label="Close"
              >
                <X className="size-4" />
              </AlertDialogCancel>
            </div>

            <AlertDialogDescription asChild>
              <div className="mt-4 space-y-3">
                {dialogTiming?.headline && (
                  <ModalNotice
                    icon={Zap}
                    title={`Takes effect: ${dialogTiming.headline}`}
                  >
                    {dialogTiming.body}
                  </ModalNotice>
                )}

                {isUpgradeTarget && (
                  <>
                    {upgradeAmount > 0 && target && (
                      <div className="w-full rounded-xl border border-border px-4 py-3.5 text-left">
                        <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
                          Price breakdown
                        </p>

                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-muted-foreground">
                              {target.name} plan
                            </span>

                            <span className="font-semibold text-foreground tabular-nums">
                              ${target.priceValue?.toFixed(2)}/mo
                            </span>
                          </div>

                          {currentPlan && (
                            <div className="flex items-center justify-between gap-4 text-sm">
                              <span className="text-brand-700">
                                {currentPlan.name} already paid this period
                              </span>

                              <span className="font-semibold text-brand-700 tabular-nums">
                                -${currentPlanRate.toFixed(2)}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-4 border-t border-border pt-2 text-sm">
                            <span className="font-semibold text-foreground">
                              Amount due today
                            </span>

                            <span className="font-bold text-foreground tabular-nums">
                              ${upgradeAmount?.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                            <span>From next month</span>

                            <span>${target.priceValue?.toFixed(2)}/mo</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <ModalNotice icon={Info} tone="neutral">
                      You&apos;ll be taken to PayPal to approve the new
                      subscription. Nothing changes until you complete that
                      step.
                    </ModalNotice>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="mx-0 mb-0 gap-3 border-t border-border bg-slate-50/60 px-5 py-4 sm:justify-end dark:bg-muted/30">
            <AlertDialogCancel
              disabled={isPending}
              onClick={handleClose}
              className={cn(MODAL_BUTTON, "mt-0 bg-card")}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                if (selectedPlanForSwitch) {
                  executePlanSwitch(selectedPlanForSwitch);
                }
              }}
              className={cn(MODAL_BUTTON, MODAL_BUTTON_PRIMARY)}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DowngradeDialog
        tenantSlug={tenantSlug}
        open={downgradeOpen}
        onOpenChange={(open) => {
          setDowngradeOpen(open);

          if (!open) {
            // Clear the target after the dialog has started closing.
            setTimeout(() => {
              setDowngradeTarget(null);
            }, 200);
          }
        }}
        targetPlan={downgradeTarget}
        currentPlan={currentPlan}
        usedSeats={usedSeats}
        totalSeats={totalSeats}
        renewalDate={renewalDate}
        scheduledToPlan={billingData?.scheduledChange?.planName ?? null}
      />

      {billingData && (
        <CancelSubscriptionDialog
          tenantSlug={tenantSlug}
          open={isCancelOpen}
          onOpenChange={setIsCancelOpen}
          billingData={billingData}
          freePlan={freePlan ?? null}
        />
      )}

      {(isPendingCancellation || hasScheduledDowngrade) && (
        <AlertDialog
          open={isUndoConfirmOpen}
          onOpenChange={setIsUndoConfirmOpen}
        >
          <AlertDialogContent
            className="
              w-[calc(100%-2rem)]
              max-w-md
              rounded-xl
              border
              border-border
              bg-background
              p-5
              shadow-[0_24px_48px_-16px_rgba(15,23,42,0.25)]
              ring-0
            "
          >
            <AlertDialogHeader className="flex-row items-start gap-3.5 pr-6 text-left">
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"
              >
                <RotateCcw className="size-5" strokeWidth={1.75} />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <AlertDialogTitle className="font-heading text-lg font-bold tracking-tight text-foreground">
                  {isPendingCancellation
                    ? "Reactivate Subscription?"
                    : "Cancel Scheduled Plan Switch?"}
                </AlertDialogTitle>

                <AlertDialogDescription className="text-sm leading-relaxed text-slate-500">
                  {isPendingCancellation
                    ? `This will reactivate your subscription so it stays active past ${
                        renewalDate ?? "your current billing period"
                      }. You will continue to be billed on your normal renewal schedule.`
                    : `This will cancel your scheduled change to ${
                        scheduledChange?.planName ?? "the new plan"
                      }. You will remain on your current ${
                        currentPlan?.name ?? ""
                      } plan.`}
                </AlertDialogDescription>
              </div>
            </AlertDialogHeader>
            <AlertDialogCancel
              disabled={isPending}
              className="absolute right-4 top-4 h-8 w-8 rounded-full border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground focus:ring-0 focus:ring-offset-0"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </AlertDialogCancel>

            <AlertDialogFooter className="-mx-5 -mb-5 mt-1 flex flex-col-reverse gap-3 border-t border-border bg-slate-50/60 px-5 py-4 sm:flex-row sm:justify-end dark:bg-muted/30">
              <AlertDialogCancel
                disabled={isPending}
                className={cn(MODAL_BUTTON, "mt-0 w-full bg-card sm:w-auto")}
              >
                Go back
              </AlertDialogCancel>

              <AlertDialogAction asChild disabled={isPending}>
                <UndoScheduledChangeButton
                  tenantSlug={tenantSlug}
                  onDone={() => setIsUndoConfirmOpen(false)}
                  label={
                    isPendingCancellation
                      ? "Confirm reactivation"
                      : "Keep current plan"
                  }
                  className={cn(
                    MODAL_BUTTON,
                    MODAL_BUTTON_PRIMARY,
                    "w-full sm:w-auto",
                  )}
                />
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
