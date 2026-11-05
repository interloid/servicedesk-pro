import { argosScreenshot } from "@argos-ci/playwright";
import { expect, test } from "@playwright/test";

import { BUSINESS_TENANT } from "../support/accounts";

for (const [name, path] of [
  ["home", "/"],
  ["login", "/login"],
  ["forgot-password", "/forgot-password"],
  ["setup", "/setup"],
  ["unauthorized", "/unauthorized"],
  ["maintenance", "/maintenance"],
  ["blocked", "/blocked"],
  ["workspace-login", `/${BUSINESS_TENANT}/login`],
  ["workspace-forgot-password", `/${BUSINESS_TENANT}/forgot-password`],
  ["portal-login", `/${BUSINESS_TENANT}/portal/login`],
] as const) {
  test(`screenshot ${name}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    expect(new URL(page.url()).pathname).toBe(path);
    await argosScreenshot(page, name);
  });
}
