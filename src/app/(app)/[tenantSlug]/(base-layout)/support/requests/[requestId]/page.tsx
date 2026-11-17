import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

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
          <Link
            href={tenantPath(tenantSlug, TENANT_ROUTES.SUPPORT.REQUESTS)}
            className="flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            My support requests
          </Link>
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
