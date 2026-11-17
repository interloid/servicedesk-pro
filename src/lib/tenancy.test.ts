import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  defaultTenantLanding,
  isSafeInternalPath,
  isTenantRouteAllowed,
  sessionTenantDestination,
  SHIPPED_TENANT_ROUTES,
  TENANT_ROUTES,
} from "./tenancy";

describe("isSafeInternalPath", () => {
  it.each(["/tickets", "/a/b?c=d", "/"])("accepts %s", (path) => {
    expect(isSafeInternalPath(path)).toBe(true);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "/a\\b",
    "https://evil.com",
    "evil.com",
    "/\tevil.com",
    "",
    null,
    undefined,
  ])("rejects %j", (path) => {
    expect(isSafeInternalPath(path)).toBe(false);
  });

  it("stays on our origin for everything it accepts", () => {
    const origin = "https://app.example.com";

    for (const path of ["/tickets", "/a//b", "/%5Cevil.com"]) {
      expect(isSafeInternalPath(path)).toBe(true);
      expect(new URL(path, origin).origin).toBe(origin);
    }
  });
});

describe("isTenantRouteAllowed", () => {
  it("lets an invited Billing Admin set a password", () => {
    expect(isTenantRouteAllowed("billing_admin", "/reset-password")).toBe(true);
  });

  it("keeps a Billing Admin to billing and plans otherwise", () => {
    expect(isTenantRouteAllowed("billing_admin", "/account/billing")).toBe(
      true,
    );
    expect(isTenantRouteAllowed("billing_admin", "/account/plans")).toBe(true);
    expect(isTenantRouteAllowed("billing_admin", "/tickets")).toBe(false);
    expect(isTenantRouteAllowed("billing_admin", "/settings/team")).toBe(false);
  });

  it("doesn't limit other roles", () => {
    expect(isTenantRouteAllowed("agent", "/tickets")).toBe(true);
  });
});

describe("customer sessions", () => {
  it("land on the support portal", () => {
    expect(defaultTenantLanding("customer")).toBe("/portal");
    expect(sessionTenantDestination("juniper", "/", "customer")).toBe(
      "/juniper/portal",
    );
  });

  it("are sent from agent routes to the portal", () => {
    expect(isTenantRouteAllowed("customer", "/tickets")).toBe(false);
    expect(isTenantRouteAllowed("customer", "/settings/team")).toBe(false);
    expect(sessionTenantDestination("juniper", "/tickets", "customer")).toBe(
      "/juniper/portal",
    );
  });

  it("keep portal and sign-in pages", () => {
    expect(isTenantRouteAllowed("customer", "/portal/requests")).toBe(true);
    expect(isTenantRouteAllowed("customer", "/login")).toBe(true);
    expect(
      sessionTenantDestination("juniper", "/portal/requests/new", "customer"),
    ).toBe("/juniper/portal/requests/new");
  });

  it("don't change where staff land", () => {
    expect(defaultTenantLanding("agent")).toBe("/tickets");
    expect(defaultTenantLanding("billing_admin")).toBe("/account/billing");
  });
});

describe("SHIPPED_TENANT_ROUTES", () => {
  // Every page under the tenant segment, as a URL path with route groups
  // ("(base-layout)") removed, e.g. "/settings/team".
  const TENANT_APP = join(process.cwd(), "src/app/(app)/[tenantSlug]");

  function pageRoutes(dir: string, prefix = ""): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (entry.isFile()) {
        return entry.name === "page.tsx" ? [prefix || "/"] : [];
      }

      const segment = /^\(.+\)$/.test(entry.name) ? "" : `/${entry.name}`;

      return pageRoutes(join(dir, entry.name), prefix + segment);
    });
  }

  const built = new Set(pageRoutes(TENANT_APP));

  it.each([...SHIPPED_TENANT_ROUTES])(
    "%s has a page, so the sidebar link is not a 404",
    (route) => {
      expect(built.has(route)).toBe(true);
    },
  );

  it("are all tenant routes", () => {
    const declared = new Set<string>(
      Object.values(TENANT_ROUTES).flatMap((value) =>
        typeof value === "string" ? [value] : Object.values(value),
      ),
    );

    for (const route of SHIPPED_TENANT_ROUTES) {
      expect(declared.has(route)).toBe(true);
    }
  });
});
