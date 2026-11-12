import "server-only";

import {
  isRecipientAllowed,
  parseRecipientAllowList,
} from "../../../supabase/functions/_shared/recipient-filter";

/**
 * EMAIL_ALLOWED_RECIPIENTS, the app's copy. The Edge Functions enforce it
 * where mail is actually sent; the app reads it only to skip queueing mail
 * that would be refused and to tell the person who asked. Unset: anyone.
 */
export function canEmailRecipient(email: string): boolean {
  return isRecipientAllowed(
    email,
    parseRecipientAllowList(process.env.EMAIL_ALLOWED_RECIPIENTS),
  );
}

/** Shown in place of "Invite sent" when the allow-list held the email back. */
export function inviteNotEmailedNotice(email?: string): string {
  return `Invite saved, but this demo only sends email to approved addresses, so no email went to ${email ?? "them"}.`;
}
