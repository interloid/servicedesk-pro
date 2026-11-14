import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SUBDOMAIN_ROUTING_AVAILABLE,
  TENANT_HINT_COOKIE,
  TENANT_HINT_MAX_AGE,
  allowsExistingSession,
  defaultTenantLanding,
  isCentralPath,
  isInfrastructurePath,
  isPortalPath,
  isTenantPublicPath,
  isTenantRouteAllowed,
  isValidTenantSlug,
  isStaffRole,
  sessionTenantDestination,
  stripTenantPrefix,
  tenantLabelFromHost,
  tenantLoginPath,
  tenantPath,
} from "@/lib/tenancy";

import { readTenantClaims } from "@/features/auth/claims";
import { isBillingPath } from "@/features/platform-admin/workspace-status";
import {
  AUTH_COOKIE_SCOPE,
  REMEMBER_COOKIE,
  authCookieLifetime,
  isRememberedSession,
} from "@/lib/supabase/remember";

import { authOutageResponse, isAuthOutage } from "@/lib/auth-outage";
import { contentSecurityPolicy, createNonce } from "@/lib/csp";
import { APP_ROUTES } from "@/lib/routes";
import {
  getWorkspaceBlock,
  isMaintenanceMode,
} from "@/lib/platform-maintenance";

import { env } from "./config/env";

const ROOT_PATH = "/";

function withSessionCookies(
  target: NextResponse,
  source: NextResponse,
): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }

  return target;
}

type SessionTenant = { slug: string | null; role: string | null };

// undefined means the claims could not be read at all.
async function resolveSessionTenant(
  supabase: SupabaseClient,
): Promise<SessionTenant | undefined> {
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError) {
    console.error("[proxy] claims lookup failed:", claimsError.message);
    return undefined;
  }

  const claims = readTenantClaims(claimsData?.claims);

  return {
    slug: claims.tenantSlug,
    role: claims.tenantRole,
  };
}

/**
 * A portal customer, identified by the role claim and never by a missing slug.
 *
 * The access token hook picks any non-disabled membership, and a customer has
 * one (portal_link_user gives them role = 'customer'), so their token carries a
 * real tenant_id and tenant_slug. Reading "no tenant" as "customer" therefore
 * never matches, and the customer fell through to the agent dashboard.
 */
function isCustomerSession(sessionTenant: SessionTenant | undefined): boolean {
  return sessionTenant !== undefined && sessionTenant.role === "customer";
}

/**
 * The mirror of isCustomerSession, for the portal branches below. Drawn from the
 * same STAFF_ROLES set the agent shell uses, so "who counts as staff" is decided
 * in exactly one place -- if the two drifted, a role could pass the shell and
 * fail the portal, or the reverse.
 *
 * A valid slug is part of the test, not a convenience: the only thing done with
 * a staff session here is send it to that tenant's dashboard, and a session with
 * no readable tenant has nowhere to go. Narrowing on it is what lets the callers
 * use the result without re-checking.
 */
function isStaffSession(
  sessionTenant: SessionTenant | undefined,
): sessionTenant is SessionTenant & { slug: string } {
  return (
    sessionTenant !== undefined &&
    isStaffRole(sessionTenant.role) &&
    isValidTenantSlug(sessionTenant.slug)
  );
}

function rememberTenant(response: NextResponse, slug: string): NextResponse {
  response.cookies.set(TENANT_HINT_COOKIE, slug, {
    ...AUTH_COOKIE_SCOPE,
    httpOnly: true,
    maxAge: TENANT_HINT_MAX_AGE,
  });

  return response;
}

/**
 * Send a staff session to the landing page of the workspace its token names.
 *
 * One rule, one place: it is reached from both the path-prefix and the
 * subdomain routing modes, where the only thing that differed was which tenant
 * value was in hand -- and isStaffSession has already narrowed that.
 */
function redirectStaffHome(
  sessionTenant: SessionTenant & { slug: string },
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  return withSessionCookies(
    NextResponse.redirect(
      new URL(
        sessionTenantDestination(sessionTenant.slug, "/", sessionTenant.role),
        request.url,
      ),
    ),
    response,
  );
}

/**
 * The maintenance screen in place of a tenant URL, or null when it may proceed.
 * Here rather than in the tenant layouts because a layout doesn't stop a server
 * action, and this also covers actions from tabs left open. A POST gets a 503:
 * the page can't answer an action, and the write must not run.
 *
 * Payment pages stay open: someone returning from PayPal has already been
 * charged, and that page is what confirms the payment.
 */
async function maintenanceGate(
  tenantRelativePath: string,
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse | null> {
  if (
    tenantRelativePath === "/payment" ||
    tenantRelativePath.startsWith("/payment/") ||
    !(await isMaintenanceMode())
  ) {
    return null;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return withSessionCookies(
      NextResponse.json(
        { error: "The platform is down for maintenance." },
        { status: 503 },
      ),
      response,
    );
  }

  return withSessionCookies(
    // The request headers carry the nonce the rendered page needs.
    NextResponse.rewrite(new URL(APP_ROUTES.MAINTENANCE, request.url), {
      request: { headers: request.headers },
    }),
    response,
  );
}

function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * The blocked screen in place of a blocked workspace's URLs, or null. In the
 * proxy for the same reason as maintenanceGate. Payment pages always stay open.
 *
 * A workspace blocked over failed payments keeps sign-in and its billing pages,
 * or nobody could ever pay to get it back.
 */
async function workspaceGate(
  slug: string,
  tenantRelativePath: string,
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse | null> {
  if (isUnder(tenantRelativePath, "/payment")) {
    return null;
  }

  const block = await getWorkspaceBlock(slug);

  if (!block) {
    return null;
  }

  if (
    block.source === "payment" &&
    (isTenantPublicPath(tenantRelativePath) ||
      isBillingPath(tenantRelativePath))
  ) {
    return null;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return withSessionCookies(
      NextResponse.json(
        { error: "This workspace is blocked." },
        { status: 503 },
      ),
      response,
    );
  }

  const target = new URL(APP_ROUTES.BLOCKED, request.url);

  target.search = "";
  target.searchParams.set("slug", slug);
  if (block.source === "payment") target.searchParams.set("reason", "payment");

  return withSessionCookies(
    NextResponse.rewrite(target, { request: { headers: request.headers } }),
    response,
  );
}

export async function proxy(request: NextRequest) {
  const policy = contentSecurityPolicy(createNonce());

  // On the request too: Next.js reads the nonce from there when it renders.
  request.headers.set("content-security-policy", policy);

  const response = await routeRequest(request);

  response.headers.set("content-security-policy", policy);

  return response;
}

async function routeRequest(request: NextRequest): Promise<NextResponse> {
  // x-tenant-slug is trusted downstream (see tenant-resolver.getTenantContext),
  // so it may only ever come from this proxy. Dropping it up front means the
  // pass-through branches below cannot leak a caller-supplied value.
  request.headers.delete("x-tenant-slug");

  let response = NextResponse.next({
    request,
  });

  const hostHeader = request.headers.get("host") || "";

  // A token refresh must keep the lifetime chosen at sign-in (see remember.ts).
  const remember = isRememberedSession(
    request.cookies.get(REMEMBER_COOKIE)?.value,
  );

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              ...AUTH_COOKIE_SCOPE,
              ...authCookieLifetime(options, remember),
            });
          });
        },
      },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Auth didn't answer (network or 5xx), which is not the same as "no session".
  // Where a missing user would send someone to sign in, they get a retryable 503
  // instead, so an Auth outage doesn't sign valid users out (LOAD-001). A real
  // "no session" answer still redirects as before.
  const authOutage = !user && isAuthOutage(userError);

  if (authOutage) {
    console.error("[proxy] auth unavailable:", userError?.message);
  }

  const url = request.nextUrl;
  const pathname = url.pathname;

  if (isInfrastructurePath(pathname)) {
    return response;
  }

  // The platform console sits outside every workspace and checks its own
  // access (requirePlatformAdmin), so no tenant redirect may claim it -- the
  // tenant-hint cookie would otherwise send it to a workspace login.
  if (pathname === "/platform" || pathname.startsWith("/platform/")) {
    // Same destination as requirePlatformAdmin, sent before the console's shell
    // renders into the redirect body. Server actions still reach their own check.
    if (!user && (request.method === "GET" || request.method === "HEAD")) {
      if (authOutage) {
        return authOutageResponse(request);
      }

      return withSessionCookies(
        NextResponse.redirect(new URL(APP_ROUTES.LOGIN, request.url)),
        response,
      );
    }

    return response;
  }

  if (isCentralPath(pathname)) {
    if (user) {
      const sessionTenant = await resolveSessionTenant(supabase);

      if (isValidTenantSlug(sessionTenant?.slug)) {
        // A customer is sent to /unauthorized *because* they have no agent
        // dashboard, so they must be allowed to render it. Bouncing them would
        // resolve defaultTenantLanding("customer") to /tickets -- the very
        // route that turned them away -- and ping-pong between the two forever.
        // /setup is the one central page a customer session may not use: it
        // could start a workspace with a customer token. /login stays open --
        // signing in there replaces the customer session, and /unauthorized
        // has no sign-out, so blocking it would strand someone who also has a
        // team account.
        if (isCustomerSession(sessionTenant)) {
          if (pathname === APP_ROUTES.SETUP) {
            return withSessionCookies(
              NextResponse.redirect(
                new URL(APP_ROUTES.UNAUTHORIZED, request.url),
              ),
              response,
            );
          }
        } else {
          return withSessionCookies(
            NextResponse.redirect(
              new URL(
                sessionTenantDestination(
                  sessionTenant!.slug,
                  "/",
                  sessionTenant?.role,
                ),
                request.url,
              ),
            ),
            response,
          );
        }
      }
    }

    return response;
  }

  const pathTenant = stripTenantPrefix(pathname);

  if (pathTenant) {
    const { slug, rest } = pathTenant;

    const maintenance = await maintenanceGate(rest, request, response);

    if (maintenance) {
      return maintenance;
    }

    const blocked = await workspaceGate(slug, rest, request, response);

    if (blocked) {
      return blocked;
    }

    if (isPortalPath(rest)) {
      // The portal runs its own sign-in, so an anonymous visitor is expected
      // here and is not turned away. A *staff* session is not: the portal
      // resolves identity through getPortalIdentity, which returns null for
      // anyone holding a team membership, and the page then redirects to the
      // customer magic-link form -- a customer sign-in surface shown to an
      // agent. Say no here instead.
      if (user) {
        const sessionTenant = await resolveSessionTenant(supabase);

        if (isStaffSession(sessionTenant)) {
          // Their own dashboard, not /unauthorized: that page explains that
          // "your account is a customer account" and links to a portal, which is
          // nonsense for an agent who mistyped a URL. Bouncing to the landing
          // page is also what every other staff guard in this file does, and it
          // cannot ping-pong, since the dashboard is a route they are allowed.
          return redirectStaffHome(sessionTenant, request, response);
        }
      }

      const requestHeaders = new Headers(request.headers);

      requestHeaders.set("x-tenant-slug", slug);

      return withSessionCookies(
        NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        }),
        response,
      );
    }

    let sessionTenant: SessionTenant | undefined;

    if (user) {
      sessionTenant = await resolveSessionTenant(supabase);

      if (
        isValidTenantSlug(sessionTenant?.slug) &&
        sessionTenant!.slug !== slug
      ) {
        const target = sessionTenantDestination(
          sessionTenant!.slug,
          rest,
          sessionTenant?.role,
        );

        return withSessionCookies(
          NextResponse.redirect(new URL(`${target}${url.search}`, request.url)),
          response,
        );
      }
    }

    const isPublic = isTenantPublicPath(rest);

    // A customer holds a real membership, so nothing above turns them away and
    // the agent app would happily render the dashboard on their session. Say no
    // here instead: the page is tenant-less, so no workspace chrome leaks. The
    // sign-in pages stay reachable (isPublic) so an agent can still sign in.
    if (user && isCustomerSession(sessionTenant) && !isPublic) {
      const denied = new URL(APP_ROUTES.UNAUTHORIZED, request.url);
      denied.searchParams.set("tenant", slug);

      return withSessionCookies(NextResponse.redirect(denied), response);
    }

    if (!user && !isPublic) {
      if (authOutage) {
        return authOutageResponse(request);
      }

      const nextPath = rest === "/" ? null : `${rest}${url.search}`;

      const loginUrl = new URL(tenantLoginPath(slug, nextPath), request.url);

      return rememberTenant(
        withSessionCookies(NextResponse.redirect(loginUrl), response),
        slug,
      );
    }

    const bounceAuthedVisitor =
      user &&
      !isCustomerSession(sessionTenant) &&
      (rest === "/" || (isPublic && !allowsExistingSession(rest)));

    if (bounceAuthedVisitor) {
      return rememberTenant(
        withSessionCookies(
          NextResponse.redirect(
            new URL(
              tenantPath(slug, defaultTenantLanding(sessionTenant?.role)),
              request.url,
            ),
          ),
          response,
        ),
        slug,
      );
    }

    if (
      user &&
      sessionTenant &&
      !isTenantRouteAllowed(sessionTenant.role, rest)
    ) {
      return rememberTenant(
        withSessionCookies(
          NextResponse.redirect(
            new URL(
              tenantPath(slug, defaultTenantLanding(sessionTenant.role)),
              request.url,
            ),
          ),
          response,
        ),
        slug,
      );
    }

    const requestHeaders = new Headers(request.headers);

    requestHeaders.set("x-tenant-slug", slug);

    return rememberTenant(
      withSessionCookies(
        NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        }),
        response,
      ),
      slug,
    );
  }

  if (SUBDOMAIN_ROUTING_AVAILABLE) {
    const slugFromSubdomain = tenantLabelFromHost(hostHeader);

    if (slugFromSubdomain) {
      if (isCentralPath(pathname)) {
        const scheme = url.protocol.replace(":", "");

        return withSessionCookies(
          NextResponse.redirect(
            new URL(
              `${pathname}${url.search}`,
              `${scheme}://${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
            ),
          ),
          response,
        );
      }

      const maintenance = await maintenanceGate(pathname, request, response);

      if (maintenance) {
        return maintenance;
      }

      const blocked = await workspaceGate(
        slugFromSubdomain,
        pathname,
        request,
        response,
      );

      if (blocked) {
        return blocked;
      }

      if (isPortalPath(pathname)) {
        // The same staff check as the path-prefix branch above, and now the
        // same helper: without it this rewrite hands a staff session the
        // customer magic-link screen.
        if (user) {
          const sessionTenant = await resolveSessionTenant(supabase);

          if (isStaffSession(sessionTenant)) {
            return redirectStaffHome(sessionTenant, request, response);
          }
        }

        const requestHeaders = new Headers(request.headers);

        requestHeaders.set("x-tenant-slug", slugFromSubdomain);

        return withSessionCookies(
          NextResponse.rewrite(
            new URL(
              tenantPath(slugFromSubdomain, `${pathname}${url.search}`),
              request.url,
            ),
            {
              request: {
                headers: requestHeaders,
              },
              headers: response.headers,
            },
          ),
          response,
        );
      }

      let sessionTenant: SessionTenant | undefined;

      if (user) {
        sessionTenant = await resolveSessionTenant(supabase);

        if (
          isValidTenantSlug(sessionTenant?.slug) &&
          sessionTenant!.slug !== slugFromSubdomain
        ) {
          return withSessionCookies(
            NextResponse.redirect(
              new URL(
                sessionTenantDestination(
                  sessionTenant!.slug,
                  pathname,
                  sessionTenant?.role,
                ),
                request.url,
              ),
            ),
            response,
          );
        }
      }

      if (
        user &&
        isCustomerSession(sessionTenant) &&
        !isTenantPublicPath(pathname)
      ) {
        const denied = new URL(APP_ROUTES.UNAUTHORIZED, request.url);
        denied.searchParams.set("tenant", slugFromSubdomain);

        return withSessionCookies(NextResponse.redirect(denied), response);
      }

      if (!user && !isTenantPublicPath(pathname)) {
        if (authOutage) {
          return authOutageResponse(request);
        }

        const loginUrl = new URL("/login", request.url);

        if (pathname !== ROOT_PATH) {
          loginUrl.searchParams.set("next", `${pathname}${url.search}`);
        }

        return withSessionCookies(NextResponse.redirect(loginUrl), response);
      }
      if (
        user &&
        !isCustomerSession(sessionTenant) &&
        (pathname === ROOT_PATH ||
          (isTenantPublicPath(pathname) && !allowsExistingSession(pathname)))
      ) {
        return withSessionCookies(
          NextResponse.redirect(
            new URL(defaultTenantLanding(sessionTenant?.role), request.url),
          ),
          response,
        );
      }

      if (
        user &&
        sessionTenant &&
        !isTenantRouteAllowed(sessionTenant.role, pathname)
      ) {
        return withSessionCookies(
          NextResponse.redirect(
            new URL(defaultTenantLanding(sessionTenant.role), request.url),
          ),
          response,
        );
      }

      const requestHeaders = new Headers(request.headers);

      requestHeaders.set("x-tenant-slug", slugFromSubdomain);

      return withSessionCookies(
        NextResponse.rewrite(
          new URL(
            tenantPath(slugFromSubdomain, `${pathname}${url.search}`),
            request.url,
          ),
          {
            request: {
              headers: requestHeaders,
            },
            headers: response.headers,
          },
        ),
        response,
      );
    }
  }

  if (pathname === ROOT_PATH) {
    return response;
  }

  const hintedSlug = request.cookies.get(TENANT_HINT_COOKIE)?.value;

  if (isValidTenantSlug(hintedSlug)) {
    if (isTenantPublicPath(pathname)) {
      return withSessionCookies(
        NextResponse.redirect(
          new URL(tenantPath(hintedSlug, pathname), request.url),
        ),
        response,
      );
    }
    const loginUrl = new URL(
      tenantLoginPath(hintedSlug, `${pathname}${url.search}`),
      request.url,
    );

    return withSessionCookies(NextResponse.redirect(loginUrl), response);
  }

  return response;
}

export const config = {
  matcher: [
    // Metadata routes are anchored with $ so a tenant slug that merely starts
    // with the same letters still goes through the proxy.
    "/((?!_next/static|_next/image|favicon.ico|(?:opengraph-image|robots\\.txt|sitemap\\.xml)$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
