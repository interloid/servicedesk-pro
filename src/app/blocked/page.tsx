import type { Metadata } from "next";
import { CreditCard, ShieldX } from "lucide-react";

import { AuthShell } from "@/features/auth/components/auth-card";
import { BlockedActions } from "@/features/platform-admin/components/blocked-actions";
import { PlatformStatusCard } from "@/features/platform-admin/components/platform-status-card";
import { getCachedPlatformSettings } from "@/features/platform-admin/services/platform-settings.service";
import { isValidTenantSlug, tenantPath } from "@/lib/tenancy";

export const metadata: Metadata = {
  title: "Workspace blocked",
  robots: { index: false, follow: false },
};

/**
 * What the proxy serves for a blocked workspace's URLs. The admin's reason isn't
 * shown: it may be an internal note. The query only comes from the proxy's
 * rewrite; typed by hand it changes this wording and grants nothing.
 */
export default async function BlockedPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug, reason } = await props.searchParams;
  const { platformName, supportEmail } = await getCachedPlatformSettings();
  const payment = reason === "payment";

  return (
    <AuthShell>
      <PlatformStatusCard
        icon={payment ? CreditCard : ShieldX}
        title={payment ? "Payment needed" : "Workspace blocked"}
        description={
          payment
            ? "This workspace is blocked because its subscription was cancelled after failed payments. An admin can restore it by subscribing again."
            : `This workspace has been blocked by ${platformName}. Contact support to find out more.`
        }
        status="Blocked"
        supportEmail={supportEmail}
        action={
          <BlockedActions
            billingHref={
              payment && typeof slug === "string" && isValidTenantSlug(slug)
                ? tenantPath(slug, "/account/billing")
                : null
            }
          />
        }
      />
    </AuthShell>
  );
}
