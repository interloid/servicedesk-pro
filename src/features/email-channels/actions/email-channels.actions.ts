"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { requestOrigin } from "@/features/auth/services/auth.service";
import { TENANT_ROUTES, tenantPath } from "@/lib/tenancy";

import {
  GMAIL_CHANNEL_PATH,
  type EmailChannelActionResult,
} from "@/features/email-channels/email-channels";
import {
  EmailChannelError,
  disconnectEmailChannel,
  getChannelAdmin,
  requestEmailSync,
  retryInboundEmail,
  startGmailConnect,
  updateEmailChannelSettings,
} from "@/features/email-channels/services/email-channels.service";
import {
  OAUTH_COOKIE,
  OAUTH_TTL_SECONDS,
} from "@/features/email-channels/services/oauth-state";

/**
 * "Connect Gmail": mint the OAuth state, set the cookie that binds the
 * callback to this browser, and hand back Google's consent URL for the page
 * to navigate to.
 *
 * A server action rather than a form POST answered with a redirect: the
 * app's CSP has `form-action 'self'`, which browsers also apply to a form's
 * redirects, so a 303 to accounts.google.com was silently blocked. A script
 * navigation is not governed by form-action. Server actions only accept
 * same-origin calls, so another site still cannot start the flow, and
 * startGmailConnect checks for a live Tenant Admin.
 */
export async function startGmailConnectAction(): Promise<
  { ok: true; url: string } | { ok: false; message: string }
> {
  try {
    const { url, cookie } = await startGmailConnect();
    const origin = await requestOrigin();

    (await cookies()).set(OAUTH_COOKIE, cookie, {
      httpOnly: true,
      secure: origin.startsWith("https://"),
      sameSite: "lax",
      path: "/api/integrations/gmail",
      maxAge: OAUTH_TTL_SECONDS,
    });

    return { ok: true, url };
  } catch (error) {
    if (error instanceof EmailChannelError) {
      return { ok: false, message: error.message };
    }
    console.error("[email-channels] connect failed", error);
    return {
      ok: false,
      message: "We couldn't start the Gmail connection. Try again.",
    };
  }
}

const settingsSchema = z.object({
  receivingEmail: z.string().trim().min(3).max(320),
  enabled: z.boolean(),
  autoCreateCustomer: z.boolean(),
});

async function revalidateChannels() {
  const admin = await getChannelAdmin();
  if (admin?.tenantSlug) {
    revalidatePath(
      tenantPath(admin.tenantSlug, TENANT_ROUTES.SETTINGS.CHANNELS),
    );
    revalidatePath(tenantPath(admin.tenantSlug, GMAIL_CHANNEL_PATH));
  }
}

function failure(
  error: unknown,
  fallback: string,
  context: string,
): EmailChannelActionResult {
  if (error instanceof EmailChannelError) {
    return { ok: false, message: error.message, field: error.field };
  }

  console.error(`[email-channels] ${context} failed`, error);
  return { ok: false, message: fallback };
}

export async function updateEmailChannelAction(
  values: unknown,
): Promise<EmailChannelActionResult> {
  const parsed = settingsSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Enter a valid support address.",
      field: "receivingEmail",
    };
  }

  try {
    await updateEmailChannelSettings(parsed.data);
    await revalidateChannels();
    return { ok: true };
  } catch (error) {
    return failure(
      error,
      "We couldn't save the email channel. Try again.",
      "update",
    );
  }
}

export async function disconnectEmailChannelAction(): Promise<EmailChannelActionResult> {
  try {
    await disconnectEmailChannel();
    await revalidateChannels();
    return { ok: true };
  } catch (error) {
    return failure(
      error,
      "We couldn't disconnect Gmail. Try again.",
      "disconnect",
    );
  }
}

export async function retryInboundEmailAction(
  eventId: unknown,
): Promise<EmailChannelActionResult> {
  const parsed = z.uuid().safeParse(eventId);
  if (!parsed.success)
    return { ok: false, message: "That email wasn't found." };

  try {
    const retried = await retryInboundEmail(parsed.data);
    await revalidateChannels();
    return retried
      ? { ok: true }
      : {
          ok: false,
          message:
            "That email isn't waiting for a retry any more. Refresh to see where it stands.",
        };
  } catch (error) {
    return failure(error, "We couldn't retry that email. Try again.", "retry");
  }
}

export async function syncEmailChannelAction(): Promise<
  | { ok: true; result: "done" | "queued" | "failed" }
  | { ok: false; message: string }
> {
  try {
    const result = await requestEmailSync();
    await revalidateChannels();
    return { ok: true, result };
  } catch (error) {
    const failed = failure(
      error,
      "We couldn't start a sync. Try again.",
      "sync",
    );
    return { ok: false, message: failed.ok ? "" : failed.message };
  }
}
