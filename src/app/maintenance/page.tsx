import type { Metadata } from "next";
import { Wrench } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { AuthShell } from "@/features/auth/components/auth-card";
import { PlatformStatusCard } from "@/features/platform-admin/components/platform-status-card";
import { getCachedPlatformSettings } from "@/features/platform-admin/services/platform-settings.service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Down for maintenance",
  robots: { index: false, follow: false },
};

/**
 * What the proxy serves for every workspace and portal URL while maintenance
 * mode is on. The address stays the visitor's own, so a refresh brings their
 * page back once maintenance ends.
 */
export default async function MaintenancePage() {
  const { platformName, supportEmail } = await getCachedPlatformSettings();

  return (
    <AuthShell>
      <PlatformStatusCard
        icon={Wrench}
        title="We'll be back soon"
        description={`${platformName} is down for maintenance. Please check back shortly.`}
        status="Maintenance"
        supportEmail={supportEmail}
        action={
          <a
            href={`mailto:${supportEmail}`}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-11 w-full",
            )}
          >
            Contact support
          </a>
        }
      />
    </AuthShell>
  );
}
