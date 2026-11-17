import "server-only";

import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/config/env";

export type RequestClientInfo = {
  ip: string | null;
  userAgent: string | null;
};

/**
 * The browser's address and user agent for the request being handled, as the
 * audit log records them. The one place the client IP is read: the rate
 * limiter keys on the same address.
 *
 * Null outside a request (a build-time render), where there is no browser.
 */
export async function requestClientInfo(): Promise<RequestClientInfo> {
  try {
    const requestHeaders = await headers();
    const ip =
      requestHeaders.get("x-real-ip")?.trim() ||
      // The last hop is the one our own proxy appended; anything before it
      // is whatever the caller chose to send.
      requestHeaders.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
      null;
    const userAgent = requestHeaders.get("user-agent")?.slice(0, 512) || null;

    return { ip, userAgent };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/**
 * Headers the server-side Supabase client sends with every PostgREST call.
 *
 * The database's audit triggers read them (public.audit_request_header) so a
 * row written by a trigger carries the browser's address rather than this
 * server's. Only set headers that have a value: an empty one would be read as
 * a real, blank address.
 */
export async function auditForwardHeaders(): Promise<Record<string, string>> {
  const { ip, userAgent } = await requestClientInfo();
  const forwarded: Record<string, string> = {};

  if (ip) forwarded["x-audit-ip"] = ip;
  if (userAgent) forwarded["x-audit-user-agent"] = userAgent;

  const impersonator = await sessionImpersonator();
  if (impersonator) forwarded["x-audit-impersonator"] = impersonator;

  return forwarded;
}

/**
 * The platform operator's email when this request's session is a support
 * impersonation (migration 20261117160000), from the session's own token.
 *
 * Read without verifying the token: it is only an audit label, sent with
 * service-role writes the server makes after getUser() has verified that same
 * token -- a tampered token fails there first. Never used to grant anything.
 */
async function sessionImpersonator(): Promise<string | null> {
  try {
    const store = await cookies();
    const supabase = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () => store.getAll(),
          // Read-only: this client never refreshes or writes a session.
          setAll: () => {},
        },
        auth: { autoRefreshToken: false },
      },
    );
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const payload = session?.access_token.split(".")[1];

    if (!payload) return null;

    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { impersonated_by?: unknown };

    return typeof claims.impersonated_by === "string"
      ? claims.impersonated_by.slice(0, 320)
      : null;
  } catch {
    return null;
  }
}
