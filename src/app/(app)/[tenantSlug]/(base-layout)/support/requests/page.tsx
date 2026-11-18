import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";

import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
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
    <div className="h-full overflow-y-auto p-4 font-sans text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full flex-col gap-6">
        <div className="flex flex-col gap-2">
          <BackLink href={tenantPath(tenantSlug, TENANT_ROUTES.SUPPORT.HOME)}>
            Help & Support
          </BackLink>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold tracking-tight">
                My support requests
              </h1>
              <p className="text-sm text-muted-foreground">
                Every request your workspace has sent to platform support.
              </p>
            </div>
            <Button
              asChild
              className="h-10 w-full gap-2 rounded-lg bg-brand-accent px-4 text-sm font-semibold text-brand-accent-foreground shadow-none hover:bg-brand-accent/90 sm:w-auto"
            >
              <Link href={tenantPath(tenantSlug, TENANT_ROUTES.SUPPORT.NEW)}>
                <MessageSquarePlus className="size-4" aria-hidden />
                Create support request
              </Link>
            </Button>
          </div>
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
