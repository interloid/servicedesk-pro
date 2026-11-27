import BillingDashboard from "@/features/billing/components/billing-dashboard";
import { fetchTenantBillingData } from "@/features/billing/services/billing-dashboard.service";
import {
  canManageTenantBilling,
  getTenantIdBySlug,
} from "@/features/tenancy/services/tenant-resolver";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

import type { Metadata } from "next";
import { Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Billing",
};

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function Page({ params }: PageProps) {
  const { tenantSlug } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tenantId = user ? await getTenantIdBySlug(tenantSlug) : null;

  if (!tenantId) return notFound();

  // "Not allowed" gets the same card the plans page shows; only a workspace
  // that does not exist is a 404. A failed load renders the dashboard's own
  // "couldn't load" state instead of a 404 as well.
  const canManageBilling = user
    ? await canManageTenantBilling(user.id, tenantId)
    : false;

  if (!canManageBilling) {
    return (
      <div className="min-h-full w-full p-4 sm:p-6 lg:p-8">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <span className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Lock className="size-5" aria-hidden />
          </span>
          <p className="font-heading text-base font-bold text-foreground">
            You don&apos;t have permission to view billing.
          </p>

          <p className="-mt-2 text-sm text-slate-500">
            Ask a tenant admin or billing admin to manage billing for this
            workspace.
          </p>
        </div>
      </div>
    );
  }

  const billingData = await fetchTenantBillingData(tenantSlug).catch(
    (error: unknown) => {
      console.error("Failed to load billing data:", error);
      return null;
    },
  );

  return <BillingDashboard tenantSlug={tenantSlug} initialData={billingData} />;
}
