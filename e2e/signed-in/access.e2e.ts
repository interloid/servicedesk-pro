import { expect, test } from "@playwright/test";

import {
  ACCOUNTS,
  BUSINESS_TENANT,
  FREE_TENANT,
  PRO_TENANT,
  sessionFile,
} from "../support/accounts";
import { ticketIdOf } from "../support/db";

// notFound() after the shell has streamed still answers 200, so these check the
// screen rather than the status code.
const NOT_FOUND = "We couldn't find that page";

test.describe("tenant isolation", () => {
  test.use({ storageState: sessionFile("proAdmin") });

  test("another workspace's URL returns the viewer to their own", async ({
    page,
  }) => {
    await page.goto(`/${BUSINESS_TENANT}/tickets`);

    await expect(page).not.toHaveURL(new RegExp(BUSINESS_TENANT));
    await expect(page).toHaveURL(new RegExp(PRO_TENANT));
  });

  test("another workspace's ticket id finds nothing", async ({ page }) => {
    const foreignId = await ticketIdOf("customer1@juniper.seed.test");

    await page.goto(`/${PRO_TENANT}/tickets/${foreignId}`);

    await expect(page.getByRole("heading", { name: NOT_FOUND })).toBeVisible();
  });

  test("the platform console 404s for a tenant admin", async ({ page }) => {
    const response = await page.goto("/platform");

    expect(response?.status()).toBe(404);
  });
});

test.describe("plan gates", () => {
  test.describe("Free", () => {
    test.use({ storageState: sessionFile("freeAdmin") });

    for (const path of ["reports", "settings/branding", "settings/audit"]) {
      test(`/${path} offers an upgrade`, async ({ page }) => {
        await page.goto(`/${FREE_TENANT}/${path}`);

        await expect(page.getByText(/upgrade/i).first()).toBeVisible();
      });
    }
  });

  test.describe("Pro", () => {
    test.use({ storageState: sessionFile("proAdmin") });

    test("the audit log offers an upgrade", async ({ page }) => {
      await page.goto(`/${PRO_TENANT}/settings/audit`);

      await expect(page.getByText(/upgrade/i).first()).toBeVisible();
    });
  });

  test.describe("Business", () => {
    test.use({ storageState: sessionFile("businessAdmin") });

    test("the audit log is open", async ({ page }) => {
      await page.goto(`/${BUSINESS_TENANT}/settings/audit`);

      await expect(page.getByText(/upgrade/i)).toHaveCount(0);
    });
  });
});

test.describe("roles", () => {
  test.describe("billing admin", () => {
    test.use({ storageState: sessionFile("proBilling") });

    test("is sent from tickets to billing", async ({ page }) => {
      await page.goto(`/${PRO_TENANT}/tickets`);

      await expect(page).toHaveURL(
        new RegExp(`/${PRO_TENANT}/account/billing`),
      );
    });
  });

  test.describe("agent", () => {
    test.use({ storageState: sessionFile("proAgent") });

    test("can open tickets", async ({ page }) => {
      await page.goto(`/${PRO_TENANT}/tickets`);

      await expect(page).toHaveURL(new RegExp(`/${PRO_TENANT}/tickets`));
    });

    test("cannot open team settings", async ({ page }) => {
      await page.goto(`/${PRO_TENANT}/settings/team`);

      await expect(
        page.getByRole("heading", { name: NOT_FOUND }),
      ).toBeVisible();
      await expect(page.getByText(ACCOUNTS.proAdmin)).toHaveCount(0);
    });
  });

  test.describe("customer", () => {
    test.use({ storageState: sessionFile("proCustomer") });

    test("is refused the staff app", async ({ page }) => {
      await page.goto(`/${PRO_TENANT}/tickets`);

      await expect(page).toHaveURL(/\/unauthorized/);
    });
  });
});
