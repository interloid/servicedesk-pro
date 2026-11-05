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

/**
 * Paths the proxy matcher skips (keep the two in step). HTML gets its nonce policy
 * from the proxy, so these get a fixed one that lets the file itself run nothing.
 */
const PROXY_SKIPPED_PATHS = [
  "/_next/static/:path*",
  "/_next/image",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/opengraph-image",
  "/:path*.:ext(svg|png|jpg|jpeg|gif|webp)",
];

const STATIC_FILE_POLICY =
  "default-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'";

/**
 * Vercel answers static files with Access-Control-Allow-Origin: *. Nothing here
 * is loaded cross-origin (tenant subdomains load from their own host), so name
 * this app's origin instead.
 */
function siteOrigin(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").origin;
  } catch {
    return null;
  }
}

const origin = siteOrigin();

const staticFileHeaders = [
  { key: "Content-Security-Policy", value: STATIC_FILE_POLICY },
  ...(origin ? [{ key: "Access-Control-Allow-Origin", value: origin }] : []),
];

const securityHeaders = [
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
  // The Playwright suite builds here, so a build wired to its throwaway database
  // can never be served by a plain `next start`. See playwright.config.ts.
  ...(process.env.E2E_DIST_DIR ? { distDir: process.env.E2E_DIST_DIR } : {}),
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
      ...PROXY_SKIPPED_PATHS.map((source) => ({
        source,
        headers: staticFileHeaders,
      })),
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
