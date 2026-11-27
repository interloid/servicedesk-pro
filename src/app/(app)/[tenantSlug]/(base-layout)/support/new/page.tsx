import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LifeBuoy } from "lucide-react";

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
    <div className="h-full overflow-y-auto p-4 font-sans text-slate-900 sm:p-6 lg:p-8 dark:text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 sm:gap-8">
        <div className="flex flex-col gap-4">
          <BackLink href={homeHref}>Help & Support</BackLink>
          <div className="flex flex-col gap-1.5">
            <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-brand-700 uppercase">
              <LifeBuoy className="size-3.5" strokeWidth={2} aria-hidden />
              Account
            </span>
            <h1 className="font-heading text-[1.75rem] leading-tight font-bold tracking-tight text-balance text-foreground sm:text-[2rem]">
              Create support request
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-[15px]">
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
