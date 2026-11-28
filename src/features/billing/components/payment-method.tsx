"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  CreditCard,
  X,
  Loader2,
  ExternalLink,
  Shield,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MODAL_BUTTON, MODAL_BUTTON_PRIMARY } from "./modal-buttons";
import { ModalNotice } from "@/components/shared/modal-notice";
import { updatePaymentMethodAction } from "../billing-actions";

interface UpdatePaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceType?: "card" | "paypal" | "none";
  paypalEmail?: string;
  paypalPayerName?: string;
  invoiceId?: string;
  tenantSlug?: string;
  onSynced?: () => void;
}

export function UpdatePaymentModal({
  open,
  onOpenChange,
  sourceType = "none",
  paypalEmail,
  paypalPayerName,
  invoiceId,
  tenantSlug,
  onSynced,
}: UpdatePaymentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentToPayPal, setSentToPayPal] = useState(false);

  const isWallet = sourceType === "paypal";

  const handleUpdatePayment = async () => {
    if (!tenantSlug) {
      setError("Tenant slug is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await updatePaymentMethodAction(tenantSlug);

      if (!result.success) {
        setError(result.error || "Failed to update payment method.");
        return;
      }

      if (result.manageUrl) {
        // Opened in a new tab rather than navigated to: PayPal's Automatic
        // Payments screen has no way back to this app, and the customer needs
        // this page still open to refresh once they are done.
        window.open(result.manageUrl, "_blank", "noopener,noreferrer");
        setSentToPayPal(true);
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      console.error("Update payment method error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    setSentToPayPal(false);
    onOpenChange(false);
    onSynced?.();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-9998 bg-black/40 backdrop-blur-xs" />
        <DialogPrimitive.Content
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 9999,
          }}
          className="w-[calc(100%-2rem)] max-w-120 overflow-hidden rounded-xl border border-border bg-popover p-5 text-foreground shadow-[0_24px_48px_-16px_rgba(15,23,42,0.25)] outline-none"
        >
          <div className="mb-5 flex items-start gap-3.5">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"
            >
              <CreditCard className="size-5" strokeWidth={1.75} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-heading text-lg leading-tight font-bold tracking-tight text-foreground">
                  {isWallet
                    ? "Manage your PayPal payment"
                    : "Update payment method"}
                </h2>

                <DialogPrimitive.Close className="-mt-1 -mr-1.5 shrink-0 rounded-md p-1.5 text-slate-400 transition-colors duration-200 ease-out hover:text-foreground focus:outline-none motion-safe:active:scale-[0.98]">
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </div>
              <p className="text-sm leading-relaxed text-slate-500">
                {invoiceId
                  ? `We'll retry invoice ${invoiceId} once the new details go through.`
                  : "Any pending charges are retried automatically."}
              </p>
            </div>
          </div>

          {isWallet && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-muted">
                <Wallet className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {paypalPayerName ?? "PayPal account"}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {paypalEmail ?? "Billed through your PayPal account"}
                </p>
              </div>
              <span className="inline-flex h-6 shrink-0 items-center rounded-md bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/15 ring-inset dark:bg-emerald-950/60 dark:text-emerald-300">
                Current
              </span>
            </div>
          )}

          <div className="space-y-4">
            <ModalNotice
              icon={Wallet}
              title={
                sentToPayPal
                  ? "Finish in the PayPal tab"
                  : "Change it in PayPal"
              }
            >
              {sentToPayPal
                ? "Choose a different funding source for this subscription on PayPal, then return here and select Done to refresh your payment details."
                : "You can change the funding source for your active subscription through PayPal. We will open PayPal’s automatic payments settings, where you can update your card or bank account. Your plan, workspace, and subscription will remain unchanged, and your card details will never be stored on our servers."}
            </ModalNotice>

            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <Shield className="h-4 w-4 text-brand-700" />
              <span>PCI DSS compliant - powered by PayPal</span>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200! bg-red-50 p-3 dark:border-red-900/60! dark:bg-red-950/40">
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <div className="-mx-5 -mb-5 flex flex-col-reverse gap-3 border-t border-border bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-end dark:bg-muted/30">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
                className={cn(MODAL_BUTTON, "bg-card")}
              >
                Cancel
              </Button>
              {sentToPayPal ? (
                <Button
                  type="button"
                  onClick={handleDone}
                  className={cn(MODAL_BUTTON, MODAL_BUTTON_PRIMARY)}
                >
                  Done
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleUpdatePayment}
                  className={cn(MODAL_BUTTON, MODAL_BUTTON_PRIMARY)}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Opening PayPal...
                    </>
                  ) : (
                    <>
                      Open PayPal
                      <ExternalLink className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
