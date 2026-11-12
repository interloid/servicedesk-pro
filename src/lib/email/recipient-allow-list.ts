import "server-only";

import {
  deliveryFromSettings,
  type EmailDelivery,
  parseFlag,
} from "../../../supabase/functions/_shared/email-policy";
import type { EmailNotice } from "@/lib/email/email-notice";
import { TENANT_ROUTES, tenantPath } from "@/lib/tenancy";

export type { EmailDelivery };

/**
 * EMAIL_ALLOWED_RECIPIENTS and EMAIL_DEMO_OUTBOX, the app's copy. The Edge
 * Functions enforce them where mail is sent; the app reads them to skip
 * queueing mail that would be refused, and to tell the person who asked what
 * happened. Decided from the address and settings alone -- never from whether
 * an account exists -- so no notice gives that away.
 */
export function emailDelivery(email: string): EmailDelivery {
  return deliveryFromSettings(email, {
    allowedRecipients: process.env.EMAIL_ALLOWED_RECIPIENTS,
    demoOutbox: process.env.EMAIL_DEMO_OUTBOX,
  });
}

/** The Demo outbox page and nav entry exist only while this is on. */
export function demoOutboxEnabled(): boolean {
  return parseFlag(process.env.EMAIL_DEMO_OUTBOX);
}

/**
 * A password reset to anyone but an approved address isn't sent -- and never
 * captured, since its link signs in as an existing account. Said up front,
 * from the address alone, so the form still gives nothing away about
 * whether an account exists.
 */
export function passwordResetDemoNotice(email: string): string | undefined {
  return emailDelivery(email) === "send"
    ? undefined
    : `Demo: password reset emails only go to approved addresses, so none was sent to ${email}. Reset links are never shown in the Demo outbox.`;
}

/**
 * `viewer`: who will see the notice. Only a Tenant Admin can open the Demo
 * outbox, so only they get the link to it.
 */
export function inviteEmailNotice(
  delivery: EmailDelivery,
  email: string | undefined,
  viewer: { tenantSlug: string | null; isTenantAdmin: boolean } | null,
): EmailNotice | undefined {
  const who = email ?? "them";

  if (delivery === "capture") {
    return viewer?.isTenantAdmin && viewer.tenantSlug
      ? {
          message: `Demo: the email to ${who} is in the Demo outbox.`,
          href: tenantPath(
            viewer.tenantSlug,
            TENANT_ROUTES.SETTINGS.DEMO_OUTBOX,
          ),
        }
      : {
          message: `Demo: the email to ${who} is in the Demo outbox, which a Tenant Admin can open.`,
        };
  }

  if (delivery === "refuse") {
    return {
      message: `Invite saved, but this demo only sends email to approved addresses, so no email went to ${who}.`,
    };
  }

  return undefined;
}
