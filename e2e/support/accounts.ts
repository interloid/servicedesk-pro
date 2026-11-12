import { expect, type Page } from "@playwright/test";

/**
 * Accounts created by scripts/seed-tenants.mjs (run by `npm run e2e:stack`).
 * juniper's admin is also the platform admin: see PLATFORM_ADMIN_EMAILS in
 * playwright.config.ts.
 */
export const PRO_TENANT = "seed-cedar";
export const FREE_TENANT = "seed-bluepeak";
export const BUSINESS_TENANT = "seed-juniper";

export const ACCOUNTS = {
  proAdmin: "admin@cedar.seed.test",
  proAgent: "agent@cedar.seed.test",
  proBilling: "billing@cedar.seed.test",
  proCustomer: "dana.whitfield@northfieldclinic.example",
  freeAdmin: "admin@bluepeak.seed.test",
  businessAdmin: "admin@juniper.seed.test",
  businessManager: "manager@juniper.seed.test",
  businessAgent: "agent@juniper.seed.test",
  businessBilling: "billing@juniper.seed.test",
  businessCustomer: "jasmine.patel@gulfcoastfab.example",
} as const;

export type AccountName = keyof typeof ACCOUNTS;

export const SEED_PASSWORD = "test@123";

/** Saved session for an account, written once per run by the setup project. */
export function sessionFile(account: AccountName): string {
  return `.e2e/auth/${account}.json`;
}

export async function submitLogin(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/** Stops a test from passing on an error screen that happens to return 200. */
export async function expectNoErrorScreen(page: Page): Promise<void> {
  await expect(page.getByText("Page not found")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /something went wrong/i }),
  ).toHaveCount(0);
}
