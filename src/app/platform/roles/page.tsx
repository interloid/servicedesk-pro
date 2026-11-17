import type { Metadata } from "next";

import { RolesManager } from "@/features/platform-admin/components/roles-manager";
import { requirePlatformAdmin } from "@/features/platform-admin/services/platform-access";
import { getPlatformRoles } from "@/features/platform-admin/services/platform-roles.service";

export const metadata: Metadata = {
  title: "Roles",
  description: "The roles workspaces can give their team members.",
  robots: { index: false, follow: false },
};

export default async function PlatformRolesPage() {
  // A layout doesn't re-run on client navigation, and this page reads every tenant.
  await requirePlatformAdmin();

  return <RolesManager roles={await getPlatformRoles()} />;
}
