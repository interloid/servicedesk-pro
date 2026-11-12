import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PortalCheckEmail } from "@/features/portal/components/portal-check-email";
import { PORTAL_ROUTES, portalPath } from "@/features/portal/portal";
import { emailDelivery } from "@/lib/email/recipient-allow-list";

// From the address and settings alone, like every other demo notice: it says
// nothing about whether an account exists or an email was actually stored.
const DEMO_NOTES = {
  send: undefined,
  capture:
    "Demo: this email doesn't go to a real inbox. It's in this workspace's Demo outbox, which its Tenant Admin can open.",
  refuse:
    "Demo: sign-in emails only go to approved addresses, so none was sent to this one.",
} as const;

export const metadata: Metadata = {
  title: "Check your inbox",
};

type PageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PortalCheckEmailPage({
  params,
  searchParams,
}: PageProps) {
  const [{ tenantSlug }, query] = await Promise.all([params, searchParams]);

  const raw = query.email;
  const email = (Array.isArray(raw) ? raw[0] : raw)?.trim();

  // The address rides in the URL rather than a cookie so a refresh, or a second
  // tab, still knows who the link was sent to. Without it there is nothing to
  // name on the screen and nothing for Resend to send to.
  if (!email) {
    redirect(portalPath(tenantSlug, PORTAL_ROUTES.LOGIN));
  }

  // Set after a request filed signed out: the screen says it was received.
  const afterRequest = query.request === "1";

  return (
    <PortalCheckEmail
      tenantSlug={tenantSlug}
      email={email}
      afterRequest={afterRequest}
      demoNote={DEMO_NOTES[emailDelivery(email)]}
    />
  );
}
