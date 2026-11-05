import { connection } from "next/server";
import Link from "next/link";
import { Ban, Wrench } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";
import { getTimezones } from "@/features/onboarding/services/onboarding.service";
import { AuthShell } from "@/features/auth/components/auth-card";
import { PlatformStatusCard } from "@/features/platform-admin/components/platform-status-card";
import {
  getCachedPlatformSettings,
  getPlatformSettings,
} from "@/features/platform-admin/services/platform-settings.service";
import { APP_ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

import type { Metadata } from "next";

const TITLE = "Create your free help desk workspace";
const DESCRIPTION =
  "Set up a help desk workspace for your support team in minutes, with ticket queues, SLA policies and a customer portal. Start on the free plan.";

export async function generateMetadata(): Promise<Metadata> {
  const { platformName } = await getCachedPlatformSettings();

  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: APP_ROUTES.SETUP },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      url: APP_ROUTES.SETUP,
      siteName: platformName,
      title: `${TITLE} | ${platformName}`,
      description: DESCRIPTION,
      // Overriding openGraph drops the image inherited from the root segment.
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${TITLE} | ${platformName}`,
      description: DESCRIPTION,
      images: ["/opengraph-image"],
    },
  };
}

export default async function SetupPage() {
  // Without this the page is prerendered and the sign-up gate is baked in.
  await connection();

  const { settings } = await getPlatformSettings();

  if (settings.maintenanceMode || !settings.allowSignups) {
    return (
      <AuthShell>
        <PlatformStatusCard
          icon={settings.maintenanceMode ? Wrench : Ban}
          title={
            settings.maintenanceMode
              ? "We'll be back soon"
              : "Sign-ups are closed"
          }
          description={
            settings.maintenanceMode
              ? `${settings.platformName} is down for maintenance, so new workspaces can't be created right now.`
              : `${settings.platformName} isn't accepting new workspaces right now. Already have one? Log in instead.`
          }
          status={settings.maintenanceMode ? "Maintenance" : "Closed"}
          supportEmail={settings.supportEmail}
          action={
            <Link
              href={APP_ROUTES.LOGIN}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 w-full",
              )}
            >
              Log in
            </Link>
          }
        />
      </AuthShell>
    );
  }

  const timezones = await getTimezones();

  return (
    <AuthShell>
      <OnboardingWizard timezones={timezones} />
    </AuthShell>
  );
}
