import type { Metadata } from "next";

import { requirePlatformAdmin } from "@/features/platform-admin/services/platform-access";

import { PlatformPageHeader } from "@/features/platform-admin/components/platform-ui";
import { UsersTable } from "@/features/platform-admin/components/users-table";
import { getPlatformUsers } from "@/features/platform-admin/services/platform-data.service";

export const metadata: Metadata = {
  title: "Users",
  description: "All platform users across workspaces.",
  robots: { index: false, follow: false },
};

export default async function PlatformUsersPage() {
  // A layout doesn't re-run on client navigation, and this page reads every tenant.
  await requirePlatformAdmin();

  const users = await getPlatformUsers();

  return (
    // Exactly the height the shell leaves, so only the table's rows scroll.
    <div data-no-page-scrollbar className="flex h-full min-h-0 flex-col gap-6">
      <PlatformPageHeader
        title="Users"
        description="Every staff membership across all workspaces. Customers are not listed."
      />

      <UsersTable users={users} />
    </div>
  );
}
