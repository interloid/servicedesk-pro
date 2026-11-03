import { describe, expect, it } from "vitest";

import { isSafeInternalPath, isTenantRouteAllowed } from "./tenancy";

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
