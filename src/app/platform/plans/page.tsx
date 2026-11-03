import type { Metadata } from "next";

import { PlansManager } from "@/features/platform-admin/components/plans-manager";
import { requirePlatformAdmin } from "@/features/platform-admin/services/platform-access";
import { getPlatformPlans } from "@/features/platform-admin/services/platform-plans.service";

export const metadata: Metadata = {
  title: "Plans & Features",
  description: "Plans, what they include and who is on them.",
  robots: { index: false, follow: false },
};

export default async function PlatformPlansPage() {
  // A layout doesn't re-run on client navigation, and this page reads every tenant.
  await requirePlatformAdmin();

  return <PlansManager plans={await getPlatformPlans()} />;
}
