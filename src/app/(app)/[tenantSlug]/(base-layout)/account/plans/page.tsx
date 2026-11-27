import React from "react";
import {
  getPlans,
  getTenantPlan,
} from "@/features/billing/services/billing.service";
import { PricingCards } from "@/features/billing/components/pricing-cards";
import { fetchTenantBillingData } from "@/features/billing/services/billing-dashboard.service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { Metadata } from "next";
import { BadgeDollarSign, Lock } from "lucide-react";

import { DashboardPageHeader } from "@/components/shared/dashboard-ui";

import {
  canManageTenantBilling,
  getTenantIdBySlug,
} from "@/features/tenancy/services/tenant-resolver";

export const metadata: Metadata = {
  title: "Plans & pricing",
};

export default async function TenantBillingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tenantId = user ? await getTenantIdBySlug(tenantSlug) : null;

  const canManageBilling =
    user && tenantId ? await canManageTenantBilling(user.id, tenantId) : false;

  const [plans, currentPlanId] = await Promise.all([
    getPlans(),
    getTenantPlan(tenantSlug),
  ]);

  let billingData = null;

  if (canManageBilling && tenantSlug) {
    try {
      billingData = await fetchTenantBillingData(tenantSlug);
    } catch (error) {
      console.error("Failed to load billing data for plans page:", error);
    }
  }

  return (
    <div className="min-h-full w-full p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <DashboardPageHeader
          eyebrow="Account"
          icon={BadgeDollarSign}
          title="Plans & pricing"
          description="One flat monthly price per plan, with agent seats included. Change or cancel anytime."
        />

        {!canManageBilling ? (
          <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <span className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Lock className="size-5" aria-hidden />
            </span>
            <p className="font-heading text-base font-bold text-foreground">
              You don&apos;t have permission to change plans.
            </p>

            <p className="-mt-2 text-sm text-slate-500">
              Ask a tenant admin or billing admin to manage subscriptions for
              this workspace.
            </p>
          </div>
        ) : plans.length === 0 ? (
          /* No plans */
          <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <span className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Lock className="size-5" aria-hidden />
            </span>
            <p className="font-heading text-base font-bold text-foreground">
              Plans aren&apos;t available right now.
            </p>

            <p className="-mt-2 text-sm text-slate-500">
              Please try again shortly. If the problem persists, contact
              support.
            </p>
          </div>
        ) : (
          /* Pricing cards */
          <div className="flex flex-wrap items-stretch justify-center gap-5 xl:gap-6">
            <PricingCards
              tenantSlug={tenantSlug}
              currentPlanCode={currentPlanId}
              plans={plans}
              billingData={billingData}
            />
          </div>
        )}
      </div>
    </div>
  );
}
