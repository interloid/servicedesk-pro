import { expect, test } from "@playwright/test";

import {
  BUSINESS_TENANT,
  PRO_TENANT,
  expectNoErrorScreen,
  sessionFile,
} from "../support/accounts";

test.describe("tenant admin pages", () => {
  test.use({ storageState: sessionFile("proAdmin") });

  for (const path of [
    "tickets",
    "customers",
    "sla",
    "views",
    "reports",
    "settings/team",
    "settings/branding",
    "settings/notifications",
    "account/billing",
    "account/plans",
  ]) {
    test(`/${path} loads`, async ({ page }) => {
      const response = await page.goto(`/${PRO_TENANT}/${path}`);

      expect(response?.ok()).toBe(true);
      await expect(page).toHaveURL(new RegExp(`/${PRO_TENANT}/${path}`));
      await expectNoErrorScreen(page);
    });
  }

  test("billing lists the seeded invoices", async ({ page }) => {
    await page.goto(`/${PRO_TENANT}/account/billing`);

    await expect(page.getByText(/Invoice|INV-/i).first()).toBeVisible();
  });
});

test.describe("platform console", () => {
  test.use({ storageState: sessionFile("businessAdmin") });

  for (const path of [
    "",
    "/tenants",
    "/users",
    "/plans",
    "/billing",
    "/analytics",
    "/audit-logs",
    "/health",
    "/settings",
  ]) {
    test(`/platform${path} loads`, async ({ page }) => {
      const response = await page.goto(`/platform${path}`);

      expect(response?.ok()).toBe(true);
      await expectNoErrorScreen(page);
    });
  }

  test("lists workspaces", async ({ page }) => {
    await page.goto("/platform/tenants");

    await expect(page.getByText(BUSINESS_TENANT).first()).toBeVisible();
  });
});
