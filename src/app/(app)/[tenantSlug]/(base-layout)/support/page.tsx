import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CirclePlus,
  Clock,
  FileText,
  Headset,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { MySupportRequests } from "@/features/support/components/my-support-requests";
import {
  getSupportActor,
  listMySupportRequests,
} from "@/features/support/services/support.service";
import { SUPPORT_ACCESS_HOURS } from "@/features/support/support";
import { TENANT_ROUTES, tenantPath } from "@/lib/tenancy";

export const metadata: Metadata = { title: "Help & Support" };

const DETAILS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: Clock,
    title: "Response time",
    body: "We usually reply within one business day.",
  },
  {
    icon: ShieldCheck,
    title: "Workspace access",
    body: `Support can access your workspace for up to ${SUPPORT_ACCESS_HOURS} hours, per request.`,
  },
  {
    icon: FileText,
    title: "Activity log",
    body: "All support activity is recorded in your audit log.",
  },
];

export default async function HelpAndSupportPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  // Server-side gate: Help & Support is the Tenant Admin's.
  if (!(await getSupportActor())) notFound();

  const { tenantSlug } = await params;
  const requests = await listMySupportRequests();

  return (
    <div className="h-full overflow-y-auto p-4 font-sans text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:size-14">
              <Headset className="size-6 sm:size-7" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Help & Support
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                Get help from the platform support team.
              </p>
            </div>
          </div>
          <Button
            asChild
            className="h-11 w-full gap-2 rounded-xl bg-brand-accent px-5 text-sm font-semibold text-brand-accent-foreground shadow-sm hover:bg-brand-accent/90 sm:w-auto"
          >
            <Link href={tenantPath(tenantSlug, TENANT_ROUTES.SUPPORT.NEW)}>
              <CirclePlus className="size-4" aria-hidden />
              Create support request
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <MySupportRequests
            requests={requests}
            requestHref={tenantPath(tenantSlug, TENANT_ROUTES.SUPPORT.REQUESTS)}
            searchable={requests.length > 10}
            className="min-h-80"
          />

          <aside className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <h2 className="border-b border-border pb-4 text-lg font-semibold">
              Support details
            </h2>
            <ul className="divide-y divide-border">
              {DETAILS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4 py-4 last:pb-0">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="text-sm leading-snug text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
