import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Clock,
  Eye,
  Inbox,
  LifeBuoy,
  MessageSquarePlus,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SupportStatusBadge } from "@/features/support/components/support-badges";
import {
  getSupportActor,
  listMySupportRequests,
} from "@/features/support/services/support.service";
import {
  formatSupportTime,
  isOpenSupportStatus,
  SUPPORT_ACCESS_HOURS,
} from "@/features/support/support";
import { TENANT_ROUTES, tenantPath } from "@/lib/tenancy";

export const metadata: Metadata = { title: "Help & Support" };

const CARD = "rounded-[14px] border border-border bg-card shadow-xs";

export default async function HelpAndSupportPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  // Server-side gate: Help & Support is the Tenant Admin's.
  if (!(await getSupportActor())) notFound();

  const { tenantSlug } = await params;
  const requests = await listMySupportRequests();
  const open = requests.filter((r) => isOpenSupportStatus(r.status));
  const waiting = open.filter((r) => r.status === "waiting_on_customer");
  const newHref = tenantPath(tenantSlug, TENANT_ROUTES.SUPPORT.NEW);
  const listHref = tenantPath(tenantSlug, TENANT_ROUTES.SUPPORT.REQUESTS);

  return (
    <div className="h-full overflow-y-auto p-4 font-sans text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full flex-col gap-6 sm:gap-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Help & Support
            </h1>
            <p className="text-sm text-muted-foreground">
              Get help from the platform support team.
            </p>
          </div>
          <Button
            asChild
            className="h-10 w-full gap-2 rounded-lg bg-brand-accent px-4 text-sm font-semibold text-brand-accent-foreground shadow-none hover:bg-brand-accent/90 sm:w-auto"
          >
            <Link href={newHref}>
              <MessageSquarePlus className="size-4" aria-hidden />
              Create support request
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            href={newHref}
            className={`${CARD} group flex items-start gap-4 p-5 transition-colors hover:bg-muted/40`}
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LifeBuoy className="size-5" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                Create a support request
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
              <span className="text-sm text-muted-foreground">
                Report a problem, ask about billing or your account, or suggest
                a feature.
              </span>
            </span>
          </Link>

          <Link
            href={listHref}
            className={`${CARD} group flex items-start gap-4 p-5 transition-colors hover:bg-muted/40`}
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
              <Inbox className="size-5" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                My support requests
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
              <span className="text-sm text-muted-foreground">
                {open.length === 0
                  ? "No open requests."
                  : `${open.length} open${waiting.length ? ` · ${waiting.length} waiting on your reply` : ""}.`}
              </span>
            </span>
          </Link>
        </div>

        {open.length > 0 && (
          <section className={`${CARD} overflow-hidden`}>
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Open requests</h2>
              <Link
                href={listHref}
                className="text-sm font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            <ul className="divide-y divide-border">
              {open.slice(0, 5).map((request) => (
                <li key={request.id}>
                  <Link
                    href={`${listHref}/${request.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                      {request.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {request.subject}
                    </span>
                    <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">
                      {formatSupportTime(request.updatedAt)}
                    </span>
                    <SupportStatusBadge status={request.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              icon: Clock,
              title: "Response times",
              body: "We reply to urgent requests first, usually within one business day for everything else.",
            },
            {
              icon: Eye,
              title: "Workspace access",
              body: `You can let support see a read-only view of your workspace for ${SUPPORT_ACCESS_HOURS} hours, per request. Withdraw it any time.`,
            },
            {
              icon: ShieldCheck,
              title: "Every view is recorded",
              body: "Each time support opens your workspace it is written to your audit log.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className={`${CARD} flex gap-3 p-4`}>
              <Icon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="text-xs leading-normal text-muted-foreground">
                  {body}
                </p>
              </div>
            </div>
          ))}
        </section>

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpen className="size-3.5" aria-hidden />
          Tip: include ticket numbers, email addresses and the steps you took —
          it saves a round trip.
        </p>
      </div>
    </div>
  );
}
