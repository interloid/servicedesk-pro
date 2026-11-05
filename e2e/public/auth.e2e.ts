import { expect, test } from "@playwright/test";

import { PRO_TENANT, submitLogin } from "../support/accounts";

test.describe("sign in", () => {
  test("rejects a wrong password", async ({ page }) => {
    await submitLogin(page, "admin@cedar.seed.test", "not-the-password");

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("does not reveal whether an account exists", async ({ page }) => {
    await submitLogin(page, "nobody@cedar.seed.test", "not-the-password");

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("validates empty fields without leaving the page", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("ignores free text in the error parameter", async ({ page }) => {
    await page.goto("/login?error=Your+account+was+hacked");

    await expect(page.getByText(/hacked/i)).toHaveCount(0);
  });

  test("links to password recovery", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /forgot/i }).click();

    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test("workspace sign in names the workspace", async ({ page }) => {
    await page.goto(`/${PRO_TENANT}/login`);

    await expect(page.getByText("Sign in to Cedar Health Group")).toBeVisible();
  });
});

test.describe("signed out", () => {
  for (const path of ["tickets", "customers", "settings/team", "reports"]) {
    test(`/${path} redirects to the workspace sign in`, async ({ page }) => {
      await page.goto(`/${PRO_TENANT}/${path}`);

      await expect(page).toHaveURL(new RegExp(`/${PRO_TENANT}/login`));
    });
  }

  test("the platform console redirects to sign in", async ({ page }) => {
    await page.goto("/platform");

    await expect(page).toHaveURL(/\/login/);
  });
});
