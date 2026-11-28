import type { Metadata } from "next";

import { PaymentSuccess } from "@/features/billing/components/payment-success";

export const metadata: Metadata = {
  title: "Payment confirmation",
  robots: { index: false, follow: false },
};

export default function PaymentSuccessPage() {
  return <PaymentSuccess />;
}
