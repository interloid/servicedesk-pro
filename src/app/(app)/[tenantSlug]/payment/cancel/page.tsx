import type { Metadata } from "next";

import { PaymentCancel } from "@/features/billing/components/payment-cancel";

export const metadata: Metadata = {
  title: "Payment cancelled",
  robots: { index: false, follow: false },
};

export default function PaymentCancelPage() {
  return <PaymentCancel />;
}
