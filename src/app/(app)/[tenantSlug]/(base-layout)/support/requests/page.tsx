import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LifeBuoy, MessageSquarePlus } from "lucide-react";

import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import {
  DASHBOARD_BUTTON,
  DashboardPageHeader,
} from "@/components/shared/dashboard-ui";
import { cn } from "@/lib/utils";
import { MySupportRequests } from "@/features/support/components/my-support-requests";
import {
  getSupportActor,
  listMySupportRequests,
} from "@/features/support/services/support.service";
import { TENANT_ROUTES, tenantPath } from "@/lib/tenancy";

export const metadata: Metadata = { title: "My support requests" };

export default async function MySupportRequestsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  if (!(await getSupportActor())) notFound();

  const { tenantSlug } = await params;
  const requests = await listMySupportRequests();

  return (
    <div className="h-full overflow-y-auto p-4 font-sans text-slate-900 sm:p-6 lg:p-8 dark:text-foreground">
      <div className="mx-auto flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4">
          <BackLink href={tenantPath(tenantSlug, TENANT_ROUTES.SUPPORT.HOME)}>
            Help & Support
          </BackLink>
          <DashboardPageHeader
            eyebrow="Account"
            icon={LifeBuoy}
            title="My support requests"
            description="Every request your workspace has sent to platform support."
            action={
              <Button
                asChild
                className={cn(
                  DASHBOARD_BUTTON,
                  "w-full gap-2 bg-brand-accent text-sm text-brand-accent-foreground hover:bg-brand-accent/90 sm:w-auto",
                )}
              >
                <Link href={tenantPath(tenantSlug, TENANT_ROUTES.SUPPORT.NEW)}>
                  <MessageSquarePlus className="size-4" aria-hidden />
                  Create support request
                </Link>
              </Button>
            }
          />
        </div>

        <MySupportRequests
          requests={requests}
          requestHref={tenantPath(tenantSlug, TENANT_ROUTES.SUPPORT.REQUESTS)}
          searchable
        />
      </div>
    </div>
  );
}
