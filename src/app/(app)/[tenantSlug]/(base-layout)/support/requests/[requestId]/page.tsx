import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LifeBuoy } from "lucide-react";

import { BackLink } from "@/components/shared/back-link";
import { SupportRequestView } from "@/features/support/components/support-request-view";
import {
  getMySupportRequest,
  getSupportActor,
} from "@/features/support/services/support.service";
import { TENANT_ROUTES, tenantPath } from "@/lib/tenancy";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = { title: "Support request" };

export default async function SupportRequestPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; requestId: string }>;
}) {
  if (!(await getSupportActor())) notFound();

  const { tenantSlug, requestId } = await params;

  if (!isUuid(requestId)) notFound();

  const request = await getMySupportRequest(requestId);

  if (!request) notFound();

  return (
    <div className="h-full overflow-y-auto p-4 font-sans text-slate-900 sm:p-6 lg:p-8 dark:text-foreground">
      <div className="mx-auto flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4">
          <BackLink
            href={tenantPath(tenantSlug, TENANT_ROUTES.SUPPORT.REQUESTS)}
          >
            My support requests
          </BackLink>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-brand-700 uppercase">
              <LifeBuoy className="size-3.5" strokeWidth={2} aria-hidden />
              Account
            </span>
            <h1 className="flex flex-wrap items-baseline gap-x-2 font-heading text-[1.75rem] leading-tight font-bold tracking-tight text-foreground sm:text-[2rem]">
              <span className="text-slate-400 tabular-nums">
                {request.number}
              </span>
              <span className="break-words">{request.subject}</span>
            </h1>
          </div>
        </div>

        <SupportRequestView request={request} />
      </div>
    </div>
  );
}
