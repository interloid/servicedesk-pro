"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/shared/page-loader";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  confirmOrderPaymentAction,
  confirmSubscriptionActivationAction,
} from "@/features/billing/billing-actions";

/** How long the buyer gets to read the card before PayPal takes over. */
const HANDOFF_SECONDS = 4;

function PaymentSuccessContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(5);
  const [planName, setPlanName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A confirmed downgrade: PayPal now bills the cheaper plan from the next
  // cycle, but nothing was charged today and the plan does not move yet.
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  // An upgrade whose difference is paid but whose NEW MONTHLY RATE PayPal
  // still needs the buyer to confirm. Holding the url here (instead of
  // redirecting from inside the confirm callback) keeps the hand-off visible:
  // the buyer reads what is about to happen before they are sent to PayPal.
  const [rateApprovalUrl, setRateApprovalUrl] = useState<string | null>(null);
  // Counted down in the open, in the button itself, so the hand-off is
  // something the buyer watches coming rather than a page that vanishes
  // under them mid-sentence.
  const [handOffIn, setHandOffIn] = useState(HANDOFF_SECONDS);
  const subscriptionId = searchParams.get("subscription_id");
  const token = searchParams.get("token");
  const paymentId = subscriptionId ?? token;
  const missingPaymentId = !paymentId;
  // One-time upgrade payments arrive as PayPal order ids (token); recurring
  // ones as subscription ids, which PayPal prefixes with "I-".
  const isOrderLike =
    paymentId !== null && paymentId.length > 0 && !paymentId.startsWith("I-");
  const [checking, setChecking] = useState(true);
  const confirmedRef = useRef(false);
  const tenantSlug = params.tenantSlug as string;
  const targetRedirectUrl = `/${tenantSlug}/account/billing`;
  // Two ways to end up unverified, one meaning for the reader: the
  // confirmation failed, or PayPal returned the buyer with no id to confirm.
  const unverified = Boolean(error) || (missingPaymentId && !planName);
  const needsRateApproval = rateApprovalUrl !== null;
  const isSuccess = !checking && !unverified && !needsRateApproval;
  const isScheduled = scheduledFor !== null;

  const effectiveDate =
    scheduledFor && !Number.isNaN(new Date(scheduledFor).getTime())
      ? new Date(scheduledFor).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

  useEffect(() => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;

    // When the id is missing (PayPal sometimes lands here without a token),
    // the activation action resolves the tenant's open checkout itself.
    const confirm = isOrderLike
      ? confirmOrderPaymentAction
      : confirmSubscriptionActivationAction;

    confirm(tenantSlug, paymentId ?? "")
      .then((res) => {
        if (!res.success) {
          if (missingPaymentId) return;
          setError(res.error ?? "Could not verify your payment.");
          return;
        }

        if ("scheduled" in res && res.scheduled) {
          setScheduledFor(res.effectiveAt ?? "");
        }

        // The difference is paid, but PayPal will not raise a recurring rate
        // on the merchant's word alone: a price increase always comes back
        // with an approve link, and the plan stays on the OLD rate until the
        // buyer confirms it. Sending them there is what finishes the upgrade
        // -- skipping it leaves a captured payment on an unchanged plan.
        if ("approvalUrl" in res && res.approvalUrl) {
          setPlanName(res.planName ?? "your new plan");
          setRateApprovalUrl(res.approvalUrl);
          return;
        }

        setPlanName(res.planName ?? "your new plan");
      })
      .catch(() => {
        if (!missingPaymentId) setError("Could not verify your payment.");
      })
      .finally(() => {
        setChecking(false);
      });
  }, [tenantSlug, missingPaymentId, paymentId, isOrderLike]);

  // The confirmation is not optional and is not deferred: the difference has
  // been charged, and until PayPal has the buyer's approval the agreement
  // keeps billing the OLD rate. So the hand-off happens on its own, straight
  // after the capture, rather than waiting behind a button the buyer can walk
  // past. The short pause is only so they can read why they are moving.
  useEffect(() => {
    if (!rateApprovalUrl) return;

    if (handOffIn <= 0) {
      window.location.assign(rateApprovalUrl);
      return;
    }

    const tick = setTimeout(() => setHandOffIn((left) => left - 1), 1000);

    return () => clearTimeout(tick);
  }, [rateApprovalUrl, handOffIn]);

  // Success moves on by itself. An unverified payment stays on screen: the
  // buyer may have been charged and needs the id above for support.
  useEffect(() => {
    if (checking || rateApprovalUrl || unverified) return;

    if (countdown <= 0) {
      router.push(targetRedirectUrl);
      return;
    }

    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);

    return () => clearTimeout(timer);
  }, [
    checking,
    countdown,
    rateApprovalUrl,
    unverified,
    router,
    targetRedirectUrl,
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-background">
      <Card className="w-full max-w-md gap-0 rounded-xl border border-border bg-card py-0 text-center shadow-[0_24px_48px_-24px_rgba(15,23,42,0.25)] ring-0">
        <CardHeader className="flex flex-col items-center px-6 pt-8 pb-5">
          <div
            className={`mb-4 flex size-14 items-center justify-center rounded-full ring-8 ${
              needsRateApproval
                ? "bg-amber-50 ring-amber-50/50 dark:bg-amber-950/50 dark:ring-amber-950/20"
                : "bg-brand-50 ring-brand-50/50 dark:bg-brand-950/50 dark:ring-brand-950/20"
            }`}
          >
            {checking ? (
              <LoaderCircle className="size-7 animate-spin text-brand-700" />
            ) : needsRateApproval ? (
              <ShieldCheck
                className="size-7 text-amber-600 dark:text-amber-400"
                strokeWidth={1.75}
              />
            ) : (
              <CheckCircle2
                className="size-7 text-brand-700 dark:text-brand-300"
                strokeWidth={1.75}
              />
            )}
          </div>
          <CardTitle className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
            {checking
              ? "Checking Payment"
              : unverified
                ? "Payment Not Confirmed"
                : needsRateApproval
                  ? "Confirming Your New Rate"
                  : isScheduled
                    ? "Plan Change Confirmed"
                    : "Payment Successful!"}
          </CardTitle>
          <CardDescription className="mt-1 text-sm leading-relaxed text-slate-500">
            {checking
              ? "Confirming with PayPal..."
              : (error ??
                (unverified
                  ? "We couldn't verify a pending payment or subscription on this device. Check your account page to see if your plan was already activated."
                  : needsRateApproval
                    ? `Your payment went through. We're taking you to PayPal now to confirm the new monthly rate for ${
                        planName ?? "your new plan"
                      } - this is the last step, and you won't be charged again today.`
                    : isScheduled
                      ? `Your switch to ${planName} is confirmed, and nothing was charged today. You keep your current plan${
                          effectiveDate ? ` until ${effectiveDate}` : ""
                        }.`
                      : "Thank you for your payment! You can manage your subscription and billing information in your account settings."))}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-6 pb-6">
          <div className="space-y-3 rounded-lg border border-border bg-slate-50/80 p-4 text-left dark:bg-muted/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-500">
                Subscription ID
              </span>
              <span className="font-mono font-semibold text-foreground">
                {paymentId ? paymentId : "-"}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-500">Status</span>
              {unverified ? (
                <Badge
                  variant="outline"
                  className="h-6 rounded-md border-none bg-amber-50 px-2 font-semibold text-amber-800 ring-1 ring-amber-600/20 ring-inset dark:bg-amber-950/60 dark:text-amber-300"
                >
                  Unverified
                </Badge>
              ) : needsRateApproval ? (
                <Badge
                  variant="outline"
                  className="h-6 rounded-md border-none bg-amber-50 px-2 font-semibold text-amber-800 ring-1 ring-amber-600/20 ring-inset dark:bg-amber-950/60 dark:text-amber-300"
                >
                  Awaiting confirmation
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="h-6 rounded-md border-none bg-emerald-50 px-2 font-semibold text-emerald-700 ring-1 ring-emerald-600/15 ring-inset dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  {isScheduled ? "Scheduled" : "Active"}
                </Badge>
              )}
            </div>
          </div>

          {needsRateApproval ? (
            <p className="text-xs text-slate-500 tabular-nums">
              {handOffIn > 0 ? (
                <>
                  Taking you to PayPal in{" "}
                  <span className="font-bold text-foreground">{handOffIn}</span>{" "}
                  {handOffIn === 1 ? "second" : "seconds"}...
                </>
              ) : (
                "Opening PayPal..."
              )}
            </p>
          ) : (
            !checking &&
            !unverified && (
              <p className="text-xs text-slate-500 tabular-nums">
                Redirecting to your billing page in{" "}
                <span className="font-bold text-foreground">{countdown}</span>{" "}
                seconds...
              </p>
            )
          )}
        </CardContent>

        <CardFooter className="flex-col gap-2 rounded-b-xl border-t border-border bg-slate-50/60 px-6 py-4 dark:bg-muted/30">
          {needsRateApproval ? (
            /* One way on. The button is here for anyone whose redirect is
               blocked, not as an alternative to it. */
            <Button
              onClick={() => window.location.assign(rateApprovalUrl)}
              className="h-10 w-full rounded-lg bg-brand-accent font-semibold text-brand-accent-foreground shadow-none hover:bg-brand-accent/90"
            >
              {handOffIn > 0
                ? `Continue to PayPal (${handOffIn})`
                : "Taking you to PayPal…"}
            </Button>
          ) : (
            <Button
              onClick={() => router.push(targetRedirectUrl)}
              disabled={checking || isSuccess}
              className="h-10 w-full rounded-lg bg-brand-accent font-semibold text-brand-accent-foreground shadow-none hover:bg-brand-accent/90 disabled:cursor-not-allowed"
            >
              {checking
                ? "Checking payment…"
                : isSuccess
                  ? "Redirecting automatically…"
                  : "Go to Account & Billing"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

export function PaymentSuccess() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
