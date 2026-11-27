"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { XCircle, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/shared/page-loader";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { abortPlanSwitchAction } from "@/features/billing/billing-actions";

type CancelState = "checking" | "restored" | "noop" | "error";

function PaymentCancelContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(5);
  const [state, setState] = useState<CancelState>("checking");
  const [planName, setPlanName] = useState<string | null>(null);
  const abortedRef = useRef(false);
  const tenantSlug = params.tenantSlug as string;
  const targetRedirectUrl = `/${tenantSlug}/account/plans`;
  // What PayPal appends to the cancel URL: the order id as `token` for an
  // upgrade payment, `ba_token` (and sometimes `subscription_id`) for an
  // agreement approval. Only the checkout these identify is dropped -- a
  // stale tab or bookmark must never undo a scheduled cancellation.
  const token = searchParams.get("token");
  const baToken = searchParams.get("ba_token");
  const paypalSubscriptionId = searchParams.get("subscription_id");

  useEffect(() => {
    if (abortedRef.current) return;
    abortedRef.current = true;

    abortPlanSwitchAction(tenantSlug, {
      checkoutOnly: true,
      token,
      baToken,
      paypalSubscriptionId,
    })
      .then((res) => {
        if (res.success) {
          if (res.restored) {
            setState("restored");
            setPlanName(res.planName ?? null);
          } else {
            setState("noop");
          }
        } else {
          setState("error");
        }
      })
      .catch(() => {
        setState("error");
      });
  }, [tenantSlug, token, baToken, paypalSubscriptionId]);

  // One timeout per tick, so the redirect is a side effect of render and not
  // of a state updater, and leaving the page (the button) stops the timer.
  // Held while the abort is still running, so the plans page never shows the
  // pending switch the abort is about to drop.
  useEffect(() => {
    if (state === "checking") return;

    if (countdown <= 0) {
      router.push(targetRedirectUrl);
      return;
    }

    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);

    return () => clearTimeout(timer);
  }, [state, countdown, router, targetRedirectUrl]);

  const title =
    state === "checking"
      ? "Checking Plan Status"
      : state === "restored"
        ? "Plan Change Cancelled"
        : state === "noop"
          ? "Payment Not Completed"
          : "Something Went Wrong";

  const description =
    state === "checking"
      ? "Making sure your previous plan is safe..."
      : state === "restored"
        ? `Your plan change was cancelled and your previous plan${planName ? ` (${planName})` : ""} has been restored. No charges were made and nothing was cancelled.`
        : state === "noop"
          ? "Your plan change was cancelled or could not be processed. No charges were made and your plan is unchanged."
          : "We couldn't confirm the plan status. Please check your account plans page - your current plan is safe.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-background">
      <Card className="w-full max-w-md gap-0 rounded-xl border border-border bg-card py-0 text-center shadow-[0_24px_48px_-24px_rgba(15,23,42,0.25)] ring-0">
        <CardHeader className="flex flex-col items-center px-6 pt-8 pb-5">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-red-50 ring-8 ring-red-50/50 dark:bg-red-950/50 dark:ring-red-950/20">
            {state === "checking" ? (
              <LoaderCircle className="size-7 animate-spin text-red-600 dark:text-red-400" />
            ) : (
              <XCircle
                className="size-7 text-red-600 dark:text-red-400"
                strokeWidth={1.75}
              />
            )}
          </div>
          <CardTitle className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
            {title}
          </CardTitle>
          <CardDescription className="mt-1 text-sm leading-relaxed text-slate-500">
            {description}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-6 pb-6">
          <p className="text-xs text-slate-500 tabular-nums">
            Redirecting to your account plan in{" "}
            <span className="font-bold text-foreground">{countdown}</span>{" "}
            seconds...
          </p>
        </CardContent>

        <CardFooter className="rounded-b-xl border-t border-border bg-slate-50/60 px-6 py-4 dark:bg-muted/30">
          <Button
            onClick={() => router.push(targetRedirectUrl)}
            className="h-10 w-full rounded-lg bg-brand-accent font-semibold text-brand-accent-foreground shadow-none hover:bg-brand-accent/90"
          >
            Go to Account & Plan
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PaymentCancelContent />
    </Suspense>
  );
}
