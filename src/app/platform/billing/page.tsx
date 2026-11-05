import type { Metadata } from "next";
import {
  PLATFORM_STAT_GRID,
  PlatformPageHeader,
} from "@/features/platform-admin/components/platform-ui";
import { Ban, CircleDollarSign, CreditCard, TriangleAlert } from "lucide-react";

import { StatCard } from "@/features/platform-admin/components/stat-card";
import { SubscriptionsTable } from "@/features/platform-admin/components/subscriptions-table";
import { formatCurrency } from "@/features/platform-admin/format";
import { requirePlatformAdmin } from "@/features/platform-admin/services/platform-access";
import { getPlatformBilling } from "@/features/platform-admin/services/platform-billing.service";

export const metadata: Metadata = {
  title: "Subscriptions & Billing",
  description: "Every workspace's subscription, payments and cancellations.",
  robots: { index: false, follow: false },
};

export default async function PlatformBillingPage() {
  // A layout doesn't re-run on client navigation, and this page reads every tenant.
  await requirePlatformAdmin();

  const { subscriptions, metrics } = await getPlatformBilling();

  return (
    // Exactly the height the shell leaves, so only the table's rows scroll.
    <div data-no-page-scrollbar className="flex h-full min-h-0 flex-col gap-6">
      <PlatformPageHeader
        title="Subscriptions & Billing"
        description="Every workspace's subscription, payments and cancellations."
      />

      <div className={PLATFORM_STAT_GRID}>
        <StatCard
          label="MRR"
          value={formatCurrency(metrics.mrr)}
          hint={`${metrics.paying} paying`}
          icon={CircleDollarSign}
        />
        <StatCard
          label="Past due"
          value={String(metrics.pastDue)}
          hint="Payment failed"
          icon={CreditCard}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="Cancelling"
          value={String(metrics.cancelling)}
          hint={`${formatCurrency(metrics.mrrAtRisk)} MRR at risk`}
          icon={TriangleAlert}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="Cancelled"
          value={String(metrics.cancelledLast30Days)}
          hint="Last 30 days"
          icon={Ban}
          iconClassName="bg-red-50 text-red-600"
        />
      </div>

      <SubscriptionsTable subscriptions={subscriptions} />
    </div>
  );
}
