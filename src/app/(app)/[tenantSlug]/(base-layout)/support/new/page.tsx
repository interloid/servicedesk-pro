import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

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
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Link
            href={homeHref}
            className="flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Help & Support
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            Create support request
          </h1>
          <p className="text-sm text-muted-foreground">
            Tell us what&apos;s wrong. You&apos;ll get replies on the
            request&apos;s page under My support requests.
          </p>
        </div>

        <CreateSupportRequestForm
          requestsHref={homeHref}
          requestHref={listHref}
        />
      </div>
    </div>
  );
}
