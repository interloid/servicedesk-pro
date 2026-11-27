import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CirclePlus,
  Clock,
  FileText,
  Headset,
  LifeBuoy,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DASHBOARD_BUTTON,
  DASHBOARD_CARD,
  DashboardPageHeader,
} from "@/components/shared/dashboard-ui";
import { cn } from "@/lib/utils";
import { MySupportRequests } from "@/features/support/components/my-support-requests";
import {
  getSupportActor,
  listMySupportRequests,
} from "@/features/support/services/support.service";
import { SUPPORT_ACCESS_HOURS } from "@/features/support/support";
import { TENANT_ROUTES, tenantPath } from "@/lib/tenancy";

export const metadata: Metadata = { title: "Help & Support" };

const DETAILS: Array<{
  icon: LucideIcon;
  tint: string;
  title: string;
  body: string;
}> = [
  {
    icon: Clock,
    tint: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300",
    title: "Response time",
    body: "We usually reply within one business day.",
  },
  {
    icon: ShieldCheck,
    tint: "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300",
    title: "Workspace access",
    body: `Support can access your workspace for up to ${SUPPORT_ACCESS_HOURS} hours, per request.`,
  },
  {
    icon: FileText,
    tint: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300",
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
    <div className="h-full overflow-y-auto p-4 font-sans text-slate-900 sm:p-6 lg:p-8 dark:text-foreground">
      <div className="mx-auto flex w-full flex-col gap-6">
        <DashboardPageHeader
          eyebrow="Account"
          icon={LifeBuoy}
          title="Help & Support"
          description="Get help from the platform support team."
          action={
            <Button
              asChild
              className={cn(
                DASHBOARD_BUTTON,
                "w-full gap-2 bg-brand-accent text-sm text-brand-accent-foreground hover:bg-brand-accent/90 sm:w-auto",
              )}
            >
              <Link href={tenantPath(tenantSlug, TENANT_ROUTES.SUPPORT.NEW)}>
                <CirclePlus className="size-4" aria-hidden />
                Create support request
              </Link>
            </Button>
          }
        />

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <MySupportRequests
            requests={requests}
            requestHref={tenantPath(tenantSlug, TENANT_ROUTES.SUPPORT.REQUESTS)}
            searchable={requests.length > 10}
            className="min-h-80"
          />

          <aside className={cn(DASHBOARD_CARD, "flex flex-col")}>
            <div className="flex items-start gap-3 border-b border-border px-5 py-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100">
                <Headset className="size-4.5" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="font-heading text-base leading-snug font-bold tracking-tight text-foreground">
                  Support details
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  How platform support works with your workspace.
                </p>
              </div>
            </div>
            <ul className="divide-y divide-border px-5">
              {DETAILS.map(({ icon: Icon, tint, title, body }) => (
                <li key={title} className="flex gap-3.5 py-4">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      tint,
                    )}
                  >
                    <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <h3 className="text-sm font-semibold text-foreground">
                      {title}
                    </h3>
                    <p className="text-sm leading-snug text-slate-500">
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
