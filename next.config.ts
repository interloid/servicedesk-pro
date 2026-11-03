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
    const { origin, host } = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    );

    return `${origin} wss://${host}`;
  } catch {
    return "";
  }
}

// Report-only for now: the browser logs what this would block and blocks nothing.
// Switch the key to Content-Security-Policy once the console stays clean.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${supabaseOrigins()}`,
  `connect-src 'self' ${supabaseOrigins()} https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io`,
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
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
