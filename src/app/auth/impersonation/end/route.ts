import { NextResponse } from "next/server";

import { endImpersonation } from "@/features/platform-admin/services/platform-impersonation.service";

/**
 * Ends a support impersonation and restores the operator's console session.
 *
 * POST: "End session" in the workspace banner.
 * GET: the proxy, once the grant has ended (expired, withdrawn, or the request
 * was resolved or closed). A session that isn't an impersonation is left alone,
 * so a stray visit can't sign anyone out.
 */
async function end(request: Request, reason: string) {
  const destination = await endImpersonation(reason);

  return NextResponse.redirect(new URL(destination, request.url), {
    status: 303,
    headers: { "Cache-Control": "no-store" },
  });
}

export function POST(request: Request) {
  return end(request, "ended by support");
}

export function GET(request: Request) {
  return end(request, "access ended");
}
