/**
 * The policy for every response the proxy handles. A fresh nonce per request is
 * what lets script-src drop 'unsafe-inline': Next.js reads the nonce from the
 * request's Content-Security-Policy header and stamps it on its own scripts, so
 * only scripts this server rendered run. That needs a dynamic render, hence the
 * connection() call in the root layout.
 *
 * Paths the proxy skips (static files, images) get a fixed policy in
 * next.config.ts instead. Two policies on one response would both be enforced.
 */

export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));

  return btoa(String.fromCharCode(...bytes));
}

function supabaseOrigins(): string {
  try {
    const { origin, host, protocol } = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    );

    return `${origin} ${protocol === "http:" ? "ws" : "wss"}://${host}`;
  } catch {
    return "";
  }
}

/**
 * Where the browser SDK sends errors, and where this policy sends its violation
 * reports. Both come from the public DSN, so the policy allows this project's
 * ingest host rather than every *.sentry.io, which would let injected code post
 * data to anyone's Sentry project.
 */
function sentryIngest(): { origin: string; reportUri: string } | null {
  try {
    const dsn = new URL(process.env.NEXT_PUBLIC_SENTRY_DSN ?? "");
    const projectId = dsn.pathname.replace(/^\//, "");

    if (!dsn.username || !projectId) {
      return null;
    }

    return {
      origin: dsn.origin,
      reportUri: `${dsn.origin}/api/${projectId}/security/?sentry_key=${dsn.username}`,
    };
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(nonce: string): string {
  const supabase = supabaseOrigins();
  const sentry = sentryIngest();
  // React needs 'unsafe-eval' in development only.
  const devEval =
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    // 'unsafe-inline' stays for styles. Radix, sonner and the scroll lock inject
    // <style> elements in the browser, and BrandTheme's nonce would go stale on a
    // client-side navigation, because an RSC response carries a different nonce
    // from the document's. img-src and font-src below still stop injected CSS
    // from sending data anywhere but this app and its own Supabase project.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src 'self' data: blob: ${supabase}`,
    `connect-src 'self' ${supabase}${sentry ? ` ${sentry.origin}` : ""}`,
    "frame-ancestors 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    ...(sentry ? [`report-uri ${sentry.reportUri}`] : []),
  ].join("; ");
}
