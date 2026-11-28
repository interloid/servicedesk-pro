"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Crown,
  ExternalLink,
  Eye,
  FileText,
  Inbox,
  RefreshCw,
  UserRound,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { MdCurrencyExchange } from "react-icons/md";
import {
  DASHBOARD_CARD,
  DashboardPageHeader,
} from "@/components/shared/dashboard-ui";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { pageWindow } from "@/lib/pagination";
import type { BillingDashboardData } from "../services/billing-dashboard.service";
import InvoiceModal from "./invoice-model";
import { UpdatePaymentModal } from "./payment-method";
import { ModalNotice } from "@/components/shared/modal-notice";
import { UndoScheduledChangeButton } from "./undo-scheduled-change-button";
import { ResumeUpgradeApprovalButton } from "./resume-upgrade-approval-button";
import { MODAL_BUTTON, MODAL_BUTTON_PRIMARY } from "./modal-buttons";
import type { PillTone } from "../types";
import {
  DashboardCard,
  DetailRow,
  NoticeBanner,
  PayPalMark,
  StatTile,
  StatusPill,
  StatusText,
} from "./reuse";

type Invoice = BillingDashboardData["invoices"][number];

// Billing history pages through invoices newest first, one page at a time.
const INVOICES_PER_PAGE = 5;

// Micro-interactions: every button gives a small press response, and its icon
// leans the way the action takes you. All motion sits behind `motion-safe`, so
// it disappears for anyone who asked their OS to reduce motion.
const BUTTON_MICRO = "duration-200 ease-out motion-safe:active:scale-[0.98]";
const MICRO_ICON = "transition-transform duration-200 ease-out";
const ICON_NUDGE_RIGHT = `${MICRO_ICON} motion-safe:group-hover/button:translate-x-0.5`;
const ICON_NUDGE_LEFT = `${MICRO_ICON} motion-safe:group-hover/button:-translate-x-0.5`;
const ICON_POP = `${MICRO_ICON} motion-safe:group-hover/button:scale-110`;

const PRIMARY_BUTTON = `h-10 gap-2 rounded-lg bg-brand-accent px-4 text-sm font-semibold text-brand-accent-foreground shadow-none hover:bg-brand-accent/90 ${BUTTON_MICRO}`;
const OUTLINE_BUTTON = `h-10 gap-2 rounded-lg bg-card px-4 text-sm font-semibold shadow-none ${BUTTON_MICRO}`;
const SECONDARY_BUTTON = `h-10 gap-2 rounded-lg px-4 text-sm font-semibold shadow-none ${BUTTON_MICRO}`;
const PAGINATION_BUTTON = `size-10 shrink-0 rounded-lg bg-card p-0 shadow-none sm:size-9 ${BUTTON_MICRO}`;

interface BillingDashboardProps {
  tenantSlug: string;
  initialData?: BillingDashboardData | null;
}

// Invoice numbers are sequential per tenant ("INV-002"), so within one day the
// higher number is the newer invoice.
function newestFirst(invoices: Invoice[]): Invoice[] {
  const sequence = (id: string) => Number(id.replace(/\D/g, "")) || 0;

  return [...invoices].sort((a, b) => {
    const byDate = new Date(b.date).getTime() - new Date(a.date).getTime();
    return byDate !== 0 ? byDate : sequence(b.id) - sequence(a.id);
  });
}

export default function BillingDashboard({
  tenantSlug,
  initialData,
}: BillingDashboardProps) {
  const router = useRouter();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isUpdatePaymentOpen, setIsUpdatePaymentOpen] = useState(false);
  const [isPlanDetailsOpen, setIsPlanDetailsOpen] = useState(false);
  const [invoicePage, setInvoicePage] = useState(1);
  const [dismissedBanners, setDismissedBanners] = useState<string[]>([]);
  const [isRefreshing, startRefresh] = useTransition();
  const handleRefresh = () => {
    startRefresh(() => {
      router.refresh();
    });
  };
  const dismissBanner = (id: string) =>
    setDismissedBanners((current) =>
      current.includes(id) ? current : [...current, id],
    );

  if (!initialData) {
    return (
      <div className="p-4 font-sans sm:p-6 lg:p-8">
        <div
          className={cn(
            DASHBOARD_CARD,
            "mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-12 text-center",
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <CreditCard className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-heading text-base font-bold text-foreground">
              We couldn&apos;t load your billing details.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Billing isn&apos;t set up yet for {tenantSlug}. Try again in a
              moment, or contact support if this keeps happening.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const data = initialData;
  const plansHref = `/${tenantSlug}/account/plans`;

  const usedSeats = data.seats?.used ?? 0;
  const totalSeats = data.seats?.total ?? 0;
  const unusedSeats = data.seats?.unused ?? 0;
  const seatPercentage = totalSeats > 0 ? (usedSeats / totalSeats) * 100 : 0;
  const seatPercentageLabel =
    seatPercentage > 0 && seatPercentage < 1
      ? "<1%"
      : `${Math.round(seatPercentage)}%`;

  const pendingUpgrade = data.pendingUpgrade ?? null;
  const scheduledChange = data.scheduledChange;
  const hasRenewalDate = data.renewalDate !== "N/A";

  // The payment source comes straight from what PayPal reported.
  const paymentSourceType = data.paymentMethod?.sourceType ?? "none";
  const paypalEmail = data.paymentMethod?.email;
  const paypalPayerName = data.paymentMethod?.payerName;
  const hasPayPalWallet = paymentSourceType === "paypal";
  const isFreeTier = (data.plan?.rateValue ?? 0) === 0;

  const invoices = newestFirst(data.invoices ?? []);
  const pageCount = Math.max(1, Math.ceil(invoices.length / INVOICES_PER_PAGE));
  // A refresh can drop invoices out from under the page we're on, so clamp
  // while rendering rather than letting the table come up empty.
  const currentPage = Math.min(invoicePage, pageCount);
  const pageStart = (currentPage - 1) * INVOICES_PER_PAGE;
  const visibleInvoices = invoices.slice(
    pageStart,
    pageStart + INVOICES_PER_PAGE,
  );

  // The invoice behind "Last payment": the newest paid invoice for that amount.
  const lastPaymentInvoice = data.lastPayment
    ? (invoices.find(
        (inv) =>
          inv.status === "Paid" && inv.amount === data.lastPayment?.amount,
      ) ?? invoices.find((inv) => inv.status === "Paid"))
    : undefined;

  // past_due: PayPal could not collect a recurring charge. The plan is kept
  // until the grace period ends (reconcile-subscriptions downgrades then), so
  // it must read as a failure with that deadline -- never as a green "Active".
  const isPastDue = data.billingStatus === "past_due";
  // Billing dates are UTC, as the renewal date is. A fixed zone also keeps
  // the server render and the browser's in step (no hydration mismatch).
  const graceEndsLabel = data.paymentTrouble?.graceEndsAt
    ? new Date(data.paymentTrouble.graceEndsAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;

  const planStatus: { label: string; tone: PillTone } =
    data.billingStatus === "cancelled"
      ? { label: `Ends ${data.renewalDate}`, tone: "amber" }
      : data.billingStatus === "trialing"
        ? { label: "Trial", tone: "sky" }
        : isPastDue
          ? { label: "Payment failed", tone: "red" }
          : { label: "Active", tone: "emerald" };

  const effectiveDateLabel = scheduledChange
    ? new Date(scheduledChange.effectiveAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

  // Cancelling books a downgrade to Free at period end, so the subscription is
  // both "cancelled" and carrying a scheduled change. That is one event, not
  // two: the cancellation notice owns it, and the downgrade detail rides along
  // in its hover hint instead of claiming a banner of its own.
  const isPendingCancellation = data.billingStatus === "cancelled";
  const currentPlanName = data.plan?.name ?? "your plan";
  // Undoing a cancellation means resuming a suspended PayPal agreement. When
  // PayPal itself ended it, or the system did after an unpaid grace period,
  // there is no agreement left to resume. Defaults to true so an older row
  // with no recorded source keeps the button it has always had.
  const canReactivate = data.cancellation?.canReactivate ?? true;
  const cancellationSource = data.cancellation?.source ?? null;

  // Why it cannot be undone, in the customer's own terms. The two reasons are
  // not interchangeable: one is something they did at PayPal, the other is
  // something that happened to them because payments stopped. Telling a
  // customer they cancelled when their card simply expired reads as an
  // accusation, so the wording follows the recorded source.
  const cannotReactivateReason =
    cancellationSource === "system"
      ? "This subscription ended because we couldn't collect payment, so it can't be reactivated."
      : cancellationSource === "paypal"
        ? "You cancelled this subscription in PayPal, so it can't be reactivated here."
        : "This subscription has already cancelled at PayPal, so it can't be reactivated.";

  const showScheduledChangeBanner =
    Boolean(scheduledChange) && !isPendingCancellation;

  // The same date means different things, so it must not always be called a
  // billing date:
  //   cancelling -> nothing is charged again; it is the day access ends
  //   switching  -> the new plan starts, and is billed, that day
  //   normal     -> the next charge
  const renewalLabel = isPendingCancellation
    ? "Access until"
    : scheduledChange
      ? "New plan starts"
      : "Next billing date";

  const planDetails: Array<{ label: string; value: ReactNode }> = [
    {
      label: "Price",
      value: `$${(data.plan?.rateValue ?? 0).toFixed(2)} / month`,
    },
    { label: "Seat limit", value: `${totalSeats} seats` },
    { label: "Seats in use", value: `${usedSeats} of ${totalSeats}` },
    {
      label: renewalLabel,
      value: hasRenewalDate ? data.renewalDate : "-",
    },
    {
      label: "Next payment",
      value: data.amountDue?.next ?? "$0.00",
    },
    {
      label: "Auto-renew",
      value: (
        <StatusText tone={data.autoRenew ? "emerald" : "slate"}>
          {data.autoRenew ? "On" : "Off"}
        </StatusText>
      ),
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 font-sans text-foreground sm:p-6 lg:p-8">
      <div className="mx-auto flex flex-col gap-6">
        <DashboardPageHeader
          eyebrow="Account"
          icon={CreditCard}
          title="Billing"
          description="Manage your subscription, seats and payment details."
          action={
            <Button
              className={cn(PRIMARY_BUTTON, "w-full sm:w-fit")}
              onClick={() => router.push(plansHref)}
            >
              <MdCurrencyExchange />
              Change plan
            </Button>
          }
        />

        {isPastDue ? (
          <NoticeBanner
            tone="red"
            icon={CreditCard}
            title="Your last payment failed."
            description={
              graceEndsLabel
                ? `Update your payment method by ${graceEndsLabel} to keep ${currentPlanName}. After that date the workspace moves to the Free plan.`
                : `PayPal is retrying the charge. Update your payment method to keep ${currentPlanName}.`
            }
            action={
              <Button
                variant="outline"
                className={cn(
                  OUTLINE_BUTTON,
                  "h-9 w-full border-red-300! bg-white text-xs text-red-900 hover:bg-red-100 sm:w-auto",
                )}
                onClick={() => setIsUpdatePaymentOpen(true)}
              >
                Update payment method
              </Button>
            }
          />
        ) : null}

        {isPendingCancellation &&
        !dismissedBanners.includes("pending-cancellation") ? (
          <NoticeBanner
            tone="amber"
            icon={Clock}
            title={
              <span className="inline-flex flex-wrap items-center gap-1.5">
                Your {currentPlanName} plan ends on {effectiveDateLabel}.
              </span>
            }
            description={
              canReactivate
                ? `You'll keep ${currentPlanName} and all its features until then.`
                : `${cannotReactivateReason} You'll keep ${currentPlanName} and all its features until ${effectiveDateLabel} - after that, choose a plan to subscribe again.`
            }
            action={
              /* Reactivate resumes the SAME PayPal agreement, which only
                 works while that agreement is suspended. Once PayPal has
                 cancelled it there is nothing to resume, so the way back is a
                 new subscription, not this button. */
              canReactivate ? (
                <UndoScheduledChangeButton
                  tenantSlug={tenantSlug}
                  label="Reactivate"
                  className={cn(
                    OUTLINE_BUTTON,
                    "h-9 w-full border-amber-300! bg-white text-xs text-amber-900 hover:bg-amber-100 sm:w-auto",
                  )}
                />
              ) : undefined
            }
            onDismiss={() => dismissBanner("pending-cancellation")}
          />
        ) : null}

        {showScheduledChangeBanner &&
          scheduledChange &&
          !dismissedBanners.includes("scheduled-change") && (
            <NoticeBanner
              tone="amber"
              icon={CalendarClock}
              title={
                <>
                  Your plan will change to{" "}
                  <span className="text-orange-700">
                    {scheduledChange.planName}
                  </span>{" "}
                  on{" "}
                  <span className="text-orange-700">{effectiveDateLabel}</span>.
                </>
              }
              description={
                <>
                  Your subscription will switch to {scheduledChange.planName} at{" "}
                  {scheduledChange.planRate}. You keep{" "}
                  {data.plan?.name ?? "your current plan"} and all of its
                  features until then.
                </>
              }
              action={
                <UndoScheduledChangeButton
                  tenantSlug={tenantSlug}
                  label="Cancel change"
                  showIcon={false}
                  className={cn(
                    OUTLINE_BUTTON,
                    "h-9 w-full border-amber-300! bg-white text-xs text-amber-900 hover:bg-amber-100 sm:w-auto",
                  )}
                />
              }
              onDismiss={() => dismissBanner("scheduled-change")}
            />
          )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <DashboardCard
            icon={Crown}
            iconTone="teal"
            label="Current plan"
            aside={
              <StatusPill tone={planStatus.tone} label={planStatus.label} />
            }
            footer={
              <Button
                variant="outline"
                className={OUTLINE_BUTTON}
                onClick={() => setIsPlanDetailsOpen(true)}
              >
                View plan details
              </Button>
            }
          >
            <div className="rounded-xl bg-linear-to-br from-brand-soft to-transparent px-4 py-3.5 ring-1 ring-brand-accent/10 ring-inset">
              <p className="truncate text-[11px] font-semibold tracking-[0.08em] text-brand-ink uppercase">
                {data.plan?.name ?? "N/A"} plan
              </p>
              <p className="mt-1.5 text-sm text-slate-500">
                <span className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums">
                  ${(data.plan?.rateValue ?? 0).toFixed(2)}
                </span>{" "}
                / month
              </p>
            </div>
            {data.plan?.description && (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                {data.plan.description}
              </p>
            )}
            <div className="flex-1" aria-hidden />
            <dl className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
              <DetailRow
                icon={UserRound}
                label="Seat limit"
                value={`${totalSeats} seats`}
              />
              <DetailRow
                icon={CalendarDays}
                label={renewalLabel}
                value={hasRenewalDate ? data.renewalDate : "-"}
              />
            </dl>
          </DashboardCard>

          <DashboardCard
            icon={CalendarDays}
            iconTone="blue"
            label="Next payment"
            footer={
              lastPaymentInvoice && (
                <Button
                  variant="outline"
                  className={SECONDARY_BUTTON}
                  onClick={() => setSelectedInvoice(lastPaymentInvoice)}
                >
                  <Eye className={ICON_POP} />
                  View invoice
                </Button>
              )
            }
          >
            {pendingUpgrade ? (
              <>
                <p className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums">
                  ${pendingUpgrade.amountDue.toFixed(2)}
                </p>
                <p className="mt-0.5 text-sm text-slate-500 sm:text-base">
                  one-time upgrade
                </p>
                <div className="mt-4 space-y-1 text-sm">
                  <StatusText tone="amber">
                    {pendingUpgrade.awaitingConfirmation
                      ? `Confirm your new rate to finish upgrading to ${pendingUpgrade.planName}`
                      : `Awaiting payment for your upgrade to ${pendingUpgrade.planName}`}
                  </StatusText>
                  {pendingUpgrade.awaitingConfirmation ? (
                    <>
                      <p className="pl-4 text-xs text-slate-500">
                        PayPal needs you to approve $
                        {pendingUpgrade.planRate.toFixed(2)}/mo before the plan
                        switches over. You stay on{" "}
                        {data.plan?.name ?? "your current plan"} until then.
                      </p>
                      <p className="pl-4 text-xs text-emerald-700">
                        Your ${pendingUpgrade.amountDue.toFixed(2)} payment is
                        already received - this won&apos;t charge you again.
                      </p>
                      <div className="pl-4 pt-2">
                        <ResumeUpgradeApprovalButton tenantSlug={tenantSlug} />
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="pl-4 text-xs text-slate-500">
                        Then ${pendingUpgrade.planRate.toFixed(2)}/mo, starting
                        with your next billing cycle.
                      </p>
                      <p className="pl-4 text-xs text-emerald-700">
                        The difference only - your{" "}
                        {data.plan?.name ?? "current"} payment for this period
                        already counts towards it.
                      </p>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums">
                  {data.amountDue?.next ?? "$0.00"}
                </p>
                {hasRenewalDate && (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-slate-500">
                    <CalendarDays
                      className="size-4 text-slate-400"
                      aria-hidden
                    />
                    Renews {data.renewalDate}
                  </p>
                )}
                <div
                  className={cn(
                    "mt-4 space-y-1 rounded-xl border px-3.5 py-3 text-sm",
                    data.autoRenew
                      ? "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                      : "border-border bg-slate-50/70 dark:bg-muted/30",
                  )}
                >
                  <StatusText tone={data.autoRenew ? "emerald" : "slate"}>
                    <RefreshCw className="size-3.5" aria-hidden />
                    Auto-renew is {data.autoRenew ? "on" : "off"}
                  </StatusText>
                  <p className="text-xs leading-relaxed text-slate-500">
                    {data.autoRenew
                      ? "Your subscription will automatically renew using your saved payment method."
                      : isFreeTier
                        ? "Your plan is free, so nothing will be charged."
                        : "No further payments will be taken."}
                  </p>
                </div>
              </>
            )}
            <div className="flex-1" aria-hidden />
            <div className="mt-5 border-t border-border pt-4 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <p className="flex items-center gap-2.5 whitespace-nowrap text-slate-500">
                  <Clock className="size-4 text-slate-400" aria-hidden />
                  Last payment
                </p>

                <p className="font-semibold text-foreground tabular-nums sm:text-right">
                  {data.lastPayment
                    ? `${data.lastPayment.amount} · Paid ${data.lastPayment.date}`
                    : "No payments yet."}
                </p>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard
            icon={CreditCard}
            iconTone="violet"
            label="Payment method"
            footer={
              <Button
                variant="outline"
                disabled={isFreeTier}
                className={OUTLINE_BUTTON}
                onClick={() => setIsUpdatePaymentOpen(true)}
              >
                {hasPayPalWallet ? "Manage PayPal" : "Update payment method"}
                {hasPayPalWallet && (
                  <ExternalLink className={ICON_NUDGE_RIGHT} />
                )}
              </Button>
            }
          >
            {hasPayPalWallet ? (
              <>
                <div className="flex items-center gap-3.5 rounded-xl border border-border bg-linear-to-br from-sky-50/70 to-card px-4 py-3.5 dark:from-sky-950/30">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-card shadow-sm ring-1 ring-slate-200 dark:ring-border">
                    <PayPalMark className="size-6" />
                  </span>
                  <div className="min-w-0 text-sm">
                    <p className="font-heading text-lg leading-tight font-bold text-foreground">
                      PayPal
                    </p>
                    {paypalPayerName && (
                      <p className="mt-0.5 truncate text-slate-700">
                        {paypalPayerName}
                      </p>
                    )}
                    <p className="break-all text-slate-500">
                      {paypalEmail ?? "Billed through your PayPal account"}
                    </p>
                  </div>
                </div>

                <div className="flex-1" aria-hidden />
                <p className="mt-5 border-t border-border pt-4 text-xs text-slate-500">
                  Used for subscription billing and automatic payments.
                </p>
              </>
            ) : isFreeTier ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center dark:border-border dark:bg-muted/20">
                <span className="flex size-10 items-center justify-center rounded-xl bg-card text-slate-400 shadow-sm ring-1 ring-slate-200 dark:ring-border">
                  <CreditCard className="size-5" aria-hidden />
                </span>
                <p className="font-heading text-base font-bold text-foreground">
                  Free plan
                </p>
                <p className="max-w-xs text-sm text-slate-500">
                  No charges for this plan, so no payment method is needed.
                </p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 px-4 py-6 text-center dark:border-amber-900/60 dark:bg-amber-950/20">
                <span className="flex size-10 items-center justify-center rounded-xl bg-card text-amber-600 shadow-sm ring-1 ring-amber-200 dark:ring-amber-900/60">
                  <CreditCard className="size-5" aria-hidden />
                </span>
                <p className="font-heading text-base font-bold text-foreground">
                  No payment method on file
                </p>
                <p className="max-w-xs text-sm text-slate-500">
                  Add a payment method to avoid service interruptions.
                </p>
              </div>
            )}
          </DashboardCard>

          <DashboardCard
            icon={Users}
            iconTone="amber"
            label="Team members"
            footer={
              <Button
                variant="outline"
                className={OUTLINE_BUTTON}
                onClick={() => router.push(`/${tenantSlug}/settings/team`)}
              >
                <UsersRound className={ICON_POP} />
                Manage team
              </Button>
            }
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm text-slate-500">
                <span className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums">
                  {usedSeats}
                </span>{" "}
                / {totalSeats} seats used
              </p>
              <span className="inline-flex h-6 items-center rounded-md bg-brand-soft px-2 text-xs font-semibold text-brand-ink tabular-nums">
                {seatPercentageLabel}
              </span>
            </div>
            <Progress
              value={seatPercentage}
              aria-label="Seats used"
              className="mt-3 h-2.5 rounded-full bg-slate-100 dark:bg-muted [&>div]:rounded-full [&>div]:bg-brand-accent"
            />
            <p className="mt-2 text-xs text-slate-500">
              {unusedSeats} available
            </p>
            <div className="flex-1" aria-hidden />
            <dl className="mt-5 grid grid-cols-3 gap-2">
              <StatTile label="Admins" value={data.agents?.admins ?? 0} />
              <StatTile label="Agents" value={data.agents?.regular ?? 0} />
              <StatTile label="Available" value={unusedSeats} />
            </dl>
          </DashboardCard>
        </div>

        <section className={cn(DASHBOARD_CARD, "overflow-hidden rounded-2xl")}>
          <header className="flex flex-col gap-3 border-b border-border px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink"
              >
                <FileText className="size-4" strokeWidth={1.75} />
              </span>

              <h2 className="font-heading text-sm leading-snug font-bold tracking-tight text-foreground">
                Billing history
              </h2>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600 tabular-nums dark:bg-muted">
                {invoices.length}
                <span className="sr-only">
                  {" "}
                  invoice{invoices.length === 1 ? "" : "s"}
                </span>
              </span>
            </div>

            <Button
              variant="outline"
              className={cn(SECONDARY_BUTTON, "bg-card")}
              onClick={handleRefresh}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
            </Button>
          </header>

          {invoices.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 dark:border-border dark:bg-muted/30">
                <Inbox className="size-5" aria-hidden />
              </span>
              <p className="max-w-sm text-sm text-slate-500">
                No invoices yet. They&apos;ll appear here after your first
                payment.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden w-full overflow-x-auto md:block">
                <Table className="min-w-200 table-fixed">
                  <colgroup>
                    <col className="w-[14%]" />
                    <col className="w-[14%]" />
                    <col className="w-[30%]" />
                    <col className="w-[12%]" />
                    <col className="w-[13%]" />
                    <col className="w-[17%]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="border-border bg-slate-50/80 hover:bg-slate-50/80 dark:bg-muted">
                      {[
                        "Invoice ID",
                        "Date",
                        "Plan details",
                        "Amount",
                        "Status",
                      ].map((heading) => (
                        <TableHead
                          key={heading}
                          className="h-10 px-4 text-left text-[11px] font-semibold tracking-[0.06em] text-slate-500 uppercase"
                        >
                          {heading}
                        </TableHead>
                      ))}
                      <TableHead className="h-10 px-4 text-right text-[11px] font-semibold tracking-[0.06em] text-slate-500 uppercase">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-sm">
                    {visibleInvoices.map((inv) => (
                      <TableRow
                        key={inv.id}
                        className="border-border transition-colors hover:bg-slate-50/60 dark:hover:bg-muted/30"
                      >
                        <TableCell className="px-4 py-3.5 font-mono text-xs font-semibold whitespace-nowrap text-foreground">
                          {inv.id}
                        </TableCell>
                        <TableCell className="px-4 py-3.5 whitespace-nowrap text-slate-600 tabular-nums">
                          {inv.date}
                        </TableCell>
                        <TableCell className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {inv.planName}
                            </span>
                            <span className="inline-flex h-5 shrink-0 items-center rounded-md bg-slate-100 px-1.5 text-[10px] font-semibold tracking-wide text-slate-600 uppercase ring-1 ring-slate-500/15 ring-inset">
                              {inv.invoiceType === "one_time"
                                ? "One-time"
                                : "Monthly"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {inv.invoiceType === "one_time"
                              ? inv.periodStart
                              : `${inv.periodStart} \u2013 ${inv.periodEnd}`}
                            {inv.seats > 0 && (
                              <>
                                {" · "}
                                {inv.seats} seat{inv.seats === 1 ? "" : "s"}
                              </>
                            )}
                          </p>
                        </TableCell>
                        <TableCell className="px-4 py-3.5 font-semibold whitespace-nowrap text-foreground tabular-nums">
                          {inv.amount}
                        </TableCell>
                        <TableCell className="px-4 py-3.5 whitespace-nowrap">
                          <StatusPill
                            tone={
                              inv.status === "Paid"
                                ? "emerald"
                                : inv.status === "Failed"
                                  ? "red"
                                  : inv.status === "Refunded"
                                    ? "slate"
                                    : "amber"
                            }
                            label={inv.status}
                          />
                        </TableCell>
                        <TableCell className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(inv)}
                            className="group/view inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors duration-200 ease-out outline-none hover:bg-accent hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:active:scale-[0.98]"
                          >
                            View details
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pageCount > 1 &&
                      Array.from({
                        length: INVOICES_PER_PAGE - visibleInvoices.length,
                      }).map((_, index) => (
                        <TableRow
                          key={`filler-${index}`}
                          aria-hidden
                          className="border-transparent hover:bg-transparent"
                        >
                          <TableCell colSpan={6} className="px-4 py-3.5">
                            <div className="invisible flex items-center gap-2">
                              <span className="font-medium">&nbsp;</span>
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold">
                                &nbsp;
                              </span>
                            </div>
                            <p className="invisible mt-0.5 text-xs">&nbsp;</p>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>

              {/* Phones get one card per invoice instead of a sideways-scrolling table. */}
              <ul className="divide-y divide-border md:hidden">
                {visibleInvoices.map((inv) => (
                  <li key={inv.id} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {inv.planName}
                          </span>
                          <span className="inline-flex h-5 shrink-0 items-center rounded-md bg-slate-100 px-1.5 text-[10px] font-semibold tracking-wide text-slate-600 uppercase ring-1 ring-slate-500/15 ring-inset">
                            {inv.invoiceType === "one_time"
                              ? "One-time"
                              : "Monthly"}
                          </span>
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {inv.id} · {inv.date}
                        </p>
                      </div>
                      <p className="shrink-0 font-heading text-base font-bold text-foreground tabular-nums">
                        {inv.amount}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <StatusPill
                        tone={
                          inv.status === "Paid"
                            ? "emerald"
                            : inv.status === "Failed"
                              ? "red"
                              : inv.status === "Refunded"
                                ? "slate"
                                : "amber"
                        }
                        label={inv.status}
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors duration-200 ease-out outline-none hover:bg-accent hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:active:scale-[0.98]"
                      >
                        <Eye className="size-4" aria-hidden />
                        View details
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {invoices.length > 0 && (
            <nav
              aria-label="Billing history pages"
              className="flex flex-col gap-3 border-t border-border bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:bg-muted/20"
            >
              <p className="text-center text-sm text-slate-500 tabular-nums sm:text-left">
                Showing{" "}
                <span className="font-semibold text-slate-700">
                  {pageStart + 1}&ndash;{pageStart + visibleInvoices.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700">
                  {invoices.length}
                </span>{" "}
                invoice{invoices.length === 1 ? "" : "s"}
              </p>

              {pageCount > 1 && (
                <div className="flex items-center justify-between gap-2 sm:justify-end sm:gap-2">
                  <Button
                    variant="outline"
                    aria-label="Previous page"
                    disabled={currentPage === 1}
                    onClick={() => setInvoicePage(currentPage - 1)}
                    className={PAGINATION_BUTTON}
                  >
                    <ChevronLeft className={cn("size-4", ICON_NUDGE_LEFT)} />
                  </Button>
                  <span
                    aria-live="polite"
                    className="flex-1 whitespace-nowrap text-center text-xs font-semibold text-slate-600 sm:hidden"
                  >
                    Page {currentPage} of {pageCount}
                  </span>

                  <ul className="hidden items-center gap-1 sm:flex">
                    {pageWindow(currentPage, pageCount).map((page, index) =>
                      page === "gap" ? (
                        <li
                          key={`gap-${index}`}
                          aria-hidden
                          className="px-1 text-xs text-slate-400"
                        >
                          &hellip;
                        </li>
                      ) : (
                        <li key={page}>
                          <Button
                            variant={page === currentPage ? "default" : "ghost"}
                            aria-label={`Page ${page}`}
                            aria-current={
                              page === currentPage ? "page" : undefined
                            }
                            onClick={() => setInvoicePage(page)}
                            className={cn(
                              "size-9 shrink-0 rounded-lg p-0 text-sm font-semibold tabular-nums shadow-none",
                              BUTTON_MICRO,
                              page === currentPage
                                ? "bg-brand-700/10 text-brand-700 hover:bg-brand-700/15 dark:text-brand-300"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                            )}
                          >
                            {page}
                          </Button>
                        </li>
                      ),
                    )}
                  </ul>

                  <Button
                    variant="outline"
                    aria-label="Next page"
                    disabled={currentPage === pageCount}
                    onClick={() => setInvoicePage(currentPage + 1)}
                    className={PAGINATION_BUTTON}
                  >
                    <ChevronRight className={cn("size-4", ICON_NUDGE_RIGHT)} />
                  </Button>
                </div>
              )}
            </nav>
          )}
        </section>
      </div>

      <Dialog open={isPlanDetailsOpen} onOpenChange={setIsPlanDetailsOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100%-2rem)] max-w-md gap-4 rounded-xl p-5 sm:max-w-md"
        >
          <DialogHeader className="flex-row items-start gap-3.5 text-left">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"
            >
              <Crown className="size-5" strokeWidth={1.75} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex w-full items-start justify-between gap-3">
                <DialogTitle className="flex flex-wrap items-center gap-2 font-heading text-lg font-bold tracking-tight text-foreground">
                  {data.plan?.name ?? "Current plan"}
                  <StatusPill tone={planStatus.tone} label={planStatus.label} />
                </DialogTitle>

                <button
                  type="button"
                  onClick={() => setIsPlanDetailsOpen(false)}
                  className="-mt-1 -mr-1.5 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors duration-200 ease-out hover:text-foreground motion-safe:active:scale-[0.98]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <DialogDescription className="text-sm leading-relaxed text-slate-500">
                {data.plan?.description}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
              Plan summary
            </p>
            <dl className="divide-y divide-border rounded-xl border border-border text-sm">
              {planDetails.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <dt className="text-slate-500">{row.label}</dt>
                  <dd className="text-right font-semibold text-foreground tabular-nums">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {scheduledChange && (
            <ModalNotice icon={CalendarClock} tone="amber">
              Changes to {scheduledChange.planName} ({scheduledChange.planRate})
              on {effectiveDateLabel}.
            </ModalNotice>
          )}

          <DialogFooter className="-mx-5 -mb-5 mt-1 gap-3 rounded-b-xl border-t border-border bg-slate-50/60 px-5 py-4 sm:justify-end dark:bg-muted/30">
            <Button
              variant="outline"
              className={cn(MODAL_BUTTON, "bg-card")}
              onClick={() => setIsPlanDetailsOpen(false)}
            >
              Close
            </Button>

            <Button
              className={cn(MODAL_BUTTON, MODAL_BUTTON_PRIMARY)}
              onClick={() => router.push(plansHref)}
            >
              <MdCurrencyExchange className={ICON_POP} />
              Change plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedInvoice && (
        <InvoiceModal
          isOpen={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          invoice={selectedInvoice}
          account={{ name: data.accountName, tenantId: data.tenantId }}
        />
      )}
      <UpdatePaymentModal
        open={isUpdatePaymentOpen}
        onOpenChange={setIsUpdatePaymentOpen}
        sourceType={paymentSourceType}
        paypalEmail={paypalEmail}
        paypalPayerName={paypalPayerName}
        invoiceId={data.suspensionReason?.invoiceId}
        tenantSlug={tenantSlug}
        onSynced={() => router.refresh()}
      />
    </div>
  );
}
