import { NextResponse } from "next/server";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";

/**
 * True when Supabase Auth could not answer: a network failure, or a 5xx from
 * Auth or its gateway. Not true for "no session", an expired or revoked
 * session, or a bad token. Those are real answers and still mean "signed out".
 *
 * The proxy used to read every error as "no user" and redirect to sign-in, so a
 * short Auth outage signed valid users out of the page they were on
 * (docs/load-testing/k6-results-2026-11-05.md, LOAD-001).
 */
export function isAuthOutage(error: unknown): boolean {
  return isAuthRetryableFetchError(error);
}

/** Seconds a client is asked to wait before retrying. */
export const AUTH_OUTAGE_RETRY_AFTER_SECONDS = 5;

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Temporarily unavailable</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center;
         font: 16px/1.5 system-ui, sans-serif; background: Canvas; color: CanvasText; }
  main { max-width: 28rem; padding: 2rem 1rem; text-align: center; }
  h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
  p { margin: 0 0 1.5rem; opacity: .8; }
  a { display: inline-block; padding: .625rem 1.25rem; border-radius: .5rem;
      border: 1px solid currentColor; color: inherit; text-decoration: none; }
</style>
</head>
<body>
<main>
<h1>We can't confirm your sign-in right now</h1>
<p>Our sign-in service didn't respond. You are still signed in, and nothing was lost. Try again in a few seconds.</p>
<a href="">Try again</a>
</main>
</body>
</html>`;

/**
 * A 503 in place of the sign-in redirect while Auth is down. Plain HTML with no
 * scripts, so it works when nothing else does; the session cookies are left
 * untouched, so the next request picks the session up again.
 */
export function authOutageResponse(request: Request): NextResponse {
  const headers = {
    "Cache-Control": "no-store",
    "Retry-After": String(AUTH_OUTAGE_RETRY_AFTER_SECONDS),
  };
  const accept = request.headers.get("accept") ?? "";

  // Server actions, RSC navigations and fetches get a short body, not a page.
  if (request.method !== "GET" || !accept.includes("text/html")) {
    return NextResponse.json(
      { error: "Sign-in service temporarily unavailable. Try again." },
      { status: 503, headers },
    );
  }

  return new NextResponse(PAGE, {
    status: 503,
    headers: {
      ...headers,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
    },
  });
}
