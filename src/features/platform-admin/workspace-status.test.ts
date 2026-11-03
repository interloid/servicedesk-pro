import { describe, expect, it } from "vitest";

import { isBillingPath, shouldLeavePage } from "./workspace-status";

const status = (block: "admin" | "payment" | null, maintenance = false) => ({
  block,
  maintenance,
});

describe("shouldLeavePage", () => {
  it("leaves an open page when blocked or in maintenance", () => {
    expect(shouldLeavePage(status("admin"), "/tickets")).toBe(true);
    expect(shouldLeavePage(status("admin"), "/account/billing")).toBe(true);
    expect(shouldLeavePage(status("payment"), "/tickets")).toBe(true);
    expect(shouldLeavePage(status(null, true), "/tickets")).toBe(true);
    expect(shouldLeavePage(status(null), "/tickets")).toBe(false);
  });

  it("never reloads a page the proxy would serve again", () => {
    expect(shouldLeavePage(status("payment"), "/account/billing")).toBe(false);
    expect(shouldLeavePage(status("payment"), "/account/plans")).toBe(false);
    expect(shouldLeavePage(status("payment"), "/account/billing/x")).toBe(
      false,
    );
  });

  it("matches whole path segments only", () => {
    expect(isBillingPath("/account/billingx")).toBe(false);
    expect(shouldLeavePage(status("payment"), "/account/billingx")).toBe(true);
  });
});
