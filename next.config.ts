import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

/**
 * The only external host `<Image>` is allowed to load from.
 *
 * The portal renders the tenant logo with `next/image`. An unconfigured host
 * there is not a warning: the optimizer answers 400 and the image is simply
 * broken. Rather than allow every hostname (`hostname: "**"`, which would let
 * anyone make our server fetch a URL of their choosing), the pattern is pinned
 * to this project's public storage, which is where an uploaded logo lives.
 * trustedTenantLogoUrl drops anything outside that prefix before it reaches the
 * component, so the two halves agree.
 */
function remotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    return [];
  }

  try {
    const { protocol, hostname } = new URL(url);

    return [
      {
        protocol: protocol === "http:" ? "http" : "https",
        hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    return [];
  }
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

const sentry = sentryIngest();

// 'unsafe-inline' stays on script-src because Next.js writes inline bootstrap
// scripts, and a nonce would force every prerendered page to render dynamically.
// React needs 'unsafe-eval' in development only.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${supabaseOrigins()}`,
  `connect-src 'self' ${supabaseOrigins()}${sentry ? ` ${sentry.origin}` : ""}`,
  "frame-ancestors 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  ...(sentry ? [`report-uri ${sentry.reportUri}`] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  /* config options here */
  poweredByHeader: false,
  reactCompiler: true,
  experimental: {
    agentUpgrade: "security",
  },
  generateBuildId: async () => process.env.NEXT_BUILD_ID || null,
  images: {
    remotePatterns: remotePatterns(),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  ...(process.env.SENTRY_ORG ? { org: process.env.SENTRY_ORG } : {}),
  ...(process.env.SENTRY_PROJECT
    ? { project: process.env.SENTRY_PROJECT }
    : {}),
  ...(process.env.SENTRY_AUTH_TOKEN
    ? { authToken: process.env.SENTRY_AUTH_TOKEN }
    : {}),
  silent: true,
  widenClientFileUpload: true,
});
