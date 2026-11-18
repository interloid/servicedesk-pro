import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/shared/back-link";
import { CreateSupportRequestForm } from "@/features/support/components/create-support-request-form";
import { getSupportActor } from "@/features/support/services/support.service";
import { TENANT_ROUTES, tenantPath } from "@/lib/tenancy";

export const metadata: Metadata = { title: "Create support request" };

export default async function NewSupportRequestPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  if (!(await getSupportActor())) notFound();

  const { tenantSlug } = await params;
  const homeHref = tenantPath(tenantSlug, TENANT_ROUTES.SUPPORT.HOME);
  const listHref = tenantPath(tenantSlug, TENANT_ROUTES.SUPPORT.REQUESTS);

  return (
    <div className="h-full overflow-y-auto p-4 font-sans text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 sm:gap-8">
        <div className="flex flex-col gap-4">
          <BackLink href={homeHref}>Help & Support</BackLink>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-balance text-foreground sm:text-[1.75rem]">
              Create support request
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Tell us what&apos;s wrong. You&apos;ll get replies on the
              request&apos;s page under{" "}
              <span className="font-semibold text-foreground">
                My support requests
              </span>
              .
            </p>
          </div>
        </div>

        <CreateSupportRequestForm
          requestsHref={homeHref}
          requestHref={listHref}
        />
      </div>
    </div>
  );
}
