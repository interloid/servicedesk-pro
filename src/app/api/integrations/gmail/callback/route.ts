import { NextResponse, type NextRequest } from "next/server";

import { requestOrigin } from "@/features/auth/services/auth.service";
import {
  completeGmailConnect,
  type ConnectResult,
} from "@/features/email-channels/services/email-channels.service";
import { OAUTH_COOKIE } from "@/features/email-channels/services/oauth-state";
import { getActorOrNull } from "@/features/team/services/team.service";
import { GMAIL_CHANNEL_PATH } from "@/features/email-channels/email-channels";
import { isValidTenantSlug, tenantPath } from "@/lib/tenancy";

/**
 * Google's redirect back (GOOGLE_REDIRECT_URI). Validates the state against
 * the cookie set by the connect route and the signed-in admin, exchanges the
 * code, stores the encrypted tokens and registers the Gmail watch -- all in
 * completeGmailConnect. The browser is then sent back to the Email channel
 * page with a fixed result code (never provider text), and the one-time
 * cookie is cleared whatever happened.
 */
export async function GET(request: NextRequest) {
  const origin = await requestOrigin();
  const { searchParams } = request.nextUrl;

  let result: ConnectResult;

  try {
    result = await completeGmailConnect({
      code: searchParams.get("code"),
      state: searchParams.get("state"),
      providerError: searchParams.get("error"),
      cookie: request.cookies.get(OAUTH_COOKIE)?.value,
    });
  } catch (error) {
    // Never the error itself in the URL: it may quote Google's response.
    console.error(
      "[email-channels] callback failed:",
      error instanceof Error ? error.message : error,
    );
    result = { slug: null, code: "failed" };
  }

  // The state's slug is only trusted after its signature checked out; with
  // no usable slug, fall back to the session's workspace.
  const slug = isValidTenantSlug(result.slug)
    ? result.slug
    : ((await getActorOrNull())?.tenantSlug ?? null);

  const target = slug
    ? `${tenantPath(slug, GMAIL_CHANNEL_PATH)}?gmail=${result.code}`
    : "/";

  const response = NextResponse.redirect(new URL(target, origin), 303);
  response.cookies.set(OAUTH_COOKIE, "", {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/integrations/gmail",
    maxAge: 0,
  });

  return response;
}
