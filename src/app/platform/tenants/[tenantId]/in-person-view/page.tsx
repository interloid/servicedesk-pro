import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PLATFORM_CARD } from "@/features/platform-admin/components/platform-ui";
import { WorkspaceView } from "@/features/platform-admin/components/workspace-view";
import { requirePlatformAdmin } from "@/features/platform-admin/services/platform-access";
import { impersonationTarget } from "@/features/platform-admin/services/platform-impersonation.service";
import {
  activeAccessRequestId,
  openWorkspaceView,
} from "@/features/platform-admin/services/platform-support.service";
import { cn } from "@/lib/utils";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = {
  title: "Support access",
  robots: { index: false, follow: false },
};

/**
 * Read-only troubleshooting view of a workspace, reached from the Tenants page.
 * Only while the workspace has granted access on one of its support requests;
 * openWorkspaceView records each visit in their audit log before returning data.
 */
export default async function TenantInPersonViewPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const admin = await requirePlatformAdmin();
  const { tenantId } = await params;

  if (!isUuid(tenantId)) notFound();

  const requestId = await activeAccessRequestId(tenantId);
  const snapshot = requestId
    ? await openWorkspaceView(admin, requestId)
    : "no-access";

  if (snapshot === null) notFound();

  if (snapshot === "no-access") {
    return (
      <div className="flex flex-col gap-6">
        <Link
          href="/platform/tenants"
          className="flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Tenants
        </Link>
        <div
          className={cn(
            PLATFORM_CARD,
            "mx-auto flex w-full max-w-lg flex-col items-center gap-3 p-8 text-center",
          )}
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300">
            <EyeOff className="size-7" aria-hidden />
          </span>
          <h1 className="text-lg font-semibold">No workspace access</h1>
          <p className="text-sm text-muted-foreground">
            This workspace hasn&apos;t granted access on an open support
            request, or the access has expired. Ask them to switch on workspace
            access from their request.
          </p>
          <Button asChild variant="outline" className="h-10 rounded-lg">
            <Link href="/platform/tenants">Back to Tenants</Link>
          </Button>
        </div>
      </div>
    );
  }

  const target = await impersonationTarget(snapshot.request.id);

  return <WorkspaceView snapshot={snapshot} signInAsName={target?.name} />;
}
