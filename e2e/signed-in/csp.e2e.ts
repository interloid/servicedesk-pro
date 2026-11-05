import { expect, test, type Page } from "@playwright/test";

import {
  BUSINESS_TENANT,
  PRO_TENANT,
  expectNoErrorScreen,
  sessionFile,
} from "../support/accounts";

function collectViolations(page: Page): string[] {
  const violations: string[] = [];

  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) {
      violations.push(`${page.url()}: ${message.text()}`);
    }
  });

  return violations;
}

test.describe("tenant admin", () => {
  test.use({ storageState: sessionFile("proAdmin") });

  test("pages run under the policy, also after client navigation", async ({
    page,
  }) => {
    const violations = collectViolations(page);

    for (const path of [
      "tickets",
      "customers",
      "sla",
      "reports",
      "settings/branding",
      "settings/team",
      "account/billing",
    ]) {
      const response = await page.goto(`/${PRO_TENANT}/${path}`, {
        waitUntil: "networkidle",
      });

      expect(response?.headers()["cache-control"]).toContain("no-store");
      expect(
        response?.headers()["access-control-allow-origin"],
      ).toBeUndefined();
      await expectNoErrorScreen(page);
    }

    // A click only navigates once React has hydrated, so this also proves the
    // framework scripts were allowed to run.
    await page.goto(`/${PRO_TENANT}/tickets`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Customers", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${PRO_TENANT}/customers`));

    expect(violations).toEqual([]);
  });
});

test.describe("platform console", () => {
  test.use({ storageState: sessionFile("businessAdmin") });

  test("runs under the policy", async ({ page }) => {
    const violations = collectViolations(page);

    for (const path of ["/platform", "/platform/tenants", "/platform/health"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await expectNoErrorScreen(page);
    }

    expect(violations).toEqual([]);
  });
});

test.describe("customer portal", () => {
  test.use({ storageState: sessionFile("businessCustomer") });

  test("branded portal runs under the policy", async ({ page }) => {
    const violations = collectViolations(page);

    await page.goto(`/${BUSINESS_TENANT}/portal`, { waitUntil: "networkidle" });
    await expectNoErrorScreen(page);

    expect(violations).toEqual([]);
  });
});
