// The Demo outbox: with EMAIL_DEMO_OUTBOX on, mail for anyone outside
// EMAIL_ALLOWED_RECIPIENTS is stored in public.demo_outbox for the workspace's
// Tenant Admins to read in the app, instead of being sent.
//
// A captured sign-in or invite link works for whoever reads it, so the email
// handlers ask signInLinkFacts + mayCaptureSignInLink (email-policy.ts) first
// and store a note in place of the link when the account isn't new and
// confined to this workspace. PLATFORM_ADMIN_EMAILS must reach the functions
// for that check; while it is missing, no link is ever captured.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  deliveryForRecipient,
  type EmailMessage,
  PermanentEmailError,
  refusedRecipientError,
  sendEmail,
} from "./gmail.ts";
import { isListedEmail, type SignInLinkFacts } from "./email-policy.ts";

export type OutboxKind =
  | "team_invitation"
  | "customer_invitation"
  | "portal_sign_in"
  | "notification"
  | "customer_ticket"
  | "invoice";

type Capture = {
  tenantId: string | null | undefined;
  kind: OutboxKind;
  /** The email was stored with its sign-in link replaced by a note. */
  linkWithheld?: boolean;
};

/** Stores one email in the workspace's Demo outbox. */
export async function captureEmail(
  admin: SupabaseClient,
  { tenantId, kind, linkWithheld = false }: Capture,
  message: EmailMessage,
): Promise<void> {
  if (!tenantId) {
    throw new PermanentEmailError(
      "Demo outbox: this email has no workspace to be stored in; not sent.",
    );
  }

  const { error } = await admin.from("demo_outbox").insert({
    tenant_id: tenantId,
    kind,
    recipient: message.to.trim().toLowerCase(),
    subject: message.subject.slice(0, 500),
    html: message.html,
    text: message.text,
    link_withheld: linkWithheld,
  });

  if (error) {
    throw new Error(`demo_outbox insert failed: ${error.message}`);
  }
}

/** Sends, captures or refuses one email, per the recipient settings. */
export async function deliverEmail(
  admin: SupabaseClient,
  capture: Capture,
  message: EmailMessage,
): Promise<void> {
  const delivery = deliveryForRecipient(message.to);

  if (delivery === "send") {
    return sendEmail(message);
  }

  if (delivery === "refuse") {
    throw refusedRecipientError();
  }

  await captureEmail(admin, capture, message);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const WITHHELD_LINK_NOTE =
  "This person already has an account, so they would sign in as usual. The Demo outbox doesn't show sign-in links for existing accounts.";

/** The email as captured when its link must not be stored. */
export function withheldLinkEmail({
  to,
  subject,
  intro,
}: {
  to: string;
  subject: string;
  intro: string;
}): EmailMessage {
  return {
    to,
    subject,
    text: `${intro}\n\n${WITHHELD_LINK_NOTE}`,
    html: `<!DOCTYPE html><html lang="en"><body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;background:#f8fafc"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:28px"><p style="font-size:15px;line-height:1.6;margin:0 0 16px">${escapeHtml(
      intro,
    )}</p><p style="font-size:13px;line-height:1.6;margin:0;padding:12px 14px;border-radius:8px;background:#fef3c7;color:#92400e">${escapeHtml(
      WITHHELD_LINK_NOTE,
    )}</p></div></body></html>`,
  };
}

type AuthUserState = {
  id: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  last_sign_in_at?: string | null;
} | null;

/**
 * What mayCaptureSignInLink needs, read with the service role. A failed read
 * throws, so the job is retried rather than deciding on missing facts.
 */
export async function signInLinkFacts(
  admin: SupabaseClient,
  {
    kind,
    tenantId,
    email,
    user,
    createdNow,
  }: {
    kind: SignInLinkFacts["kind"];
    tenantId: string;
    email: string;
    user: AuthUserState;
    createdNow: boolean;
  },
): Promise<SignInLinkFacts> {
  const address = email.trim().toLowerCase();
  const platformAdmins = Deno.env.get("PLATFORM_ADMIN_EMAILS");

  let memberships: SignInLinkFacts["memberships"] = [];

  if (user) {
    const { data, error } = await admin
      .from("memberships")
      .select("tenant_id, role")
      .eq("user_id", user.id);

    if (error) {
      throw new Error(`membership lookup failed: ${error.message}`);
    }

    memberships = (data ?? []).map((row) => ({
      tenantId: row.tenant_id as string,
      role: row.role as string,
    }));
  }

  const { data: customers, error: customerError } = await admin
    .from("customers")
    .select("tenant_id")
    .eq("email", address);

  if (customerError) {
    throw new Error(`customer lookup failed: ${customerError.message}`);
  }

  return {
    kind,
    tenantId,
    // Unset in the functions: no way to tell, so treat everyone as one.
    isPlatformAdmin:
      platformAdmins === undefined || isListedEmail(address, platformAdmins),
    memberships,
    customerTenantIds: (customers ?? []).map((row) => row.tenant_id as string),
    createdNow,
    confirmed: Boolean(user?.email_confirmed_at ?? user?.confirmed_at),
    signedInBefore: Boolean(user?.last_sign_in_at),
  };
}
