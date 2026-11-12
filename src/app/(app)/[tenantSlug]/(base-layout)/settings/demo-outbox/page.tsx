import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Inbox, KeyRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  canViewDemoOutbox,
  DEMO_OUTBOX_LIMIT,
  getDemoOutboxEmail,
  listDemoOutbox,
  type DemoOutboxEmail,
  type DemoOutboxItem,
} from "@/features/demo-outbox/services/demo-outbox.service";
import {
  demoOutboxKindLabel,
  EMAIL_FRAME_SANDBOX,
  emailSrcDoc,
} from "@/features/demo-outbox/lib/email-frame";
import { TENANT_ROUTES, tenantPath } from "@/lib/tenancy";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Demo outbox",
  description: "Emails this demo captured instead of sending",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DemoOutboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ tenantSlug }, query] = await Promise.all([params, searchParams]);

  // Gate on the server before anything is read: off outside a demo, and
  // Tenant Admins only. RLS holds the same line on the rows.
  if (!(await canViewDemoOutbox())) {
    notFound();
  }

  const raw = Array.isArray(query.id) ? query.id[0] : query.id;
  let items: DemoOutboxItem[] = [];
  let selected: DemoOutboxEmail | null = null;
  let failed = false;

  try {
    items = await listDemoOutbox();
    const id = raw && UUID.test(raw) ? raw : items[0]?.id;
    selected = id ? await getDemoOutboxEmail(id) : null;
  } catch (error) {
    console.error("[demo-outbox] page load failed", error);
    failed = true;
  }

  const pagePath = tenantPath(tenantSlug, TENANT_ROUTES.SETTINGS.DEMO_OUTBOX);

  return (
    <div className="h-full overflow-y-auto p-4 font-sans sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold tracking-tight">Demo outbox</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        This is a demo, so emails to people outside the approved list
        aren&apos;t sent. They land here instead, newest first (up to{" "}
        {DEMO_OUTBOX_LIMIT}). Links open in a new tab.
      </p>

      {failed ? (
        <div className="mt-6 rounded-[14px] border border-border bg-card p-8 text-center">
          <p className="font-medium">We couldn&apos;t load the outbox.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Refresh the page to try again.
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-[14px] border border-border bg-card p-10 text-center">
          <Inbox aria-hidden className="size-6 text-muted-foreground" />
          <p className="mt-3 font-medium">No emails yet</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Invite a teammate or a customer, or reply to a ticket, and the email
            they would get shows up here.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(260px,340px)_1fr]">
          <nav
            aria-label="Captured emails"
            className="max-h-[70vh] overflow-y-auto rounded-[14px] border border-border bg-card"
          >
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const active = item.id === selected?.id;

                return (
                  <li key={item.id}>
                    <Link
                      href={`${pagePath}?id=${item.id}`}
                      aria-current={active ? "true" : undefined}
                      scroll={false}
                      className={cn(
                        "block px-4 py-3 text-sm hover:bg-muted/60",
                        active && "bg-muted",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{demoOutboxKindLabel(item.kind)}</span>
                        <time dateTime={item.createdAt}>
                          {format(new Date(item.createdAt), "d MMM, HH:mm")}
                        </time>
                      </span>
                      <span className="mt-1 block truncate font-semibold text-foreground">
                        {item.subject}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        To {item.recipient}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {selected ? (
            <section
              aria-label="Email"
              className="flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-border bg-card"
            >
              <header className="border-b border-border px-4 py-3">
                <h2 className="text-base font-semibold wrap-break-word">
                  {selected.subject}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  To {selected.recipient} ·{" "}
                  {format(new Date(selected.createdAt), "d MMM yyyy, HH:mm")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">
                    {demoOutboxKindLabel(selected.kind)}
                  </Badge>
                  {selected.linkWithheld ? (
                    <Badge variant="outline">
                      <KeyRound aria-hidden />
                      Sign-in link withheld
                    </Badge>
                  ) : null}
                </div>
              </header>
              <iframe
                title={`Email: ${selected.subject}`}
                srcDoc={emailSrcDoc(selected.html)}
                sandbox={EMAIL_FRAME_SANDBOX}
                referrerPolicy="no-referrer"
                className="min-h-[60vh] w-full flex-1 bg-white"
              />
            </section>
          ) : (
            <div className="rounded-[14px] border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              That email isn&apos;t in the outbox any more.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
