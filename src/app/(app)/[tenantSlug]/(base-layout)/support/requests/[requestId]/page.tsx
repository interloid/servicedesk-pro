import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
    <div className="h-full overflow-y-auto p-4 font-sans text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full flex-col gap-6">
        <div className="flex flex-col gap-2">
          <BackLink
            href={tenantPath(tenantSlug, TENANT_ROUTES.SUPPORT.REQUESTS)}
          >
            My support requests
          </BackLink>
          <h1 className="flex flex-wrap items-baseline gap-x-2 text-2xl font-bold tracking-tight">
            <span className="text-muted-foreground tabular-nums">
              {request.number}
            </span>
            <span className="break-words">{request.subject}</span>
          </h1>
        </div>

        <SupportRequestView request={request} />
      </div>
    </div>
  );
}
