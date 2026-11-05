import { expect, test } from "@playwright/test";

import {
  ACCOUNTS,
  SEED_PASSWORD,
  sessionFile,
  submitLogin,
  type AccountName,
} from "../support/accounts";
import { resetRateLimits } from "../support/db";

// More accounts here than the sign-in limit allows per IP in five minutes.
test.beforeEach(resetRateLimits);

for (const [name, email] of Object.entries(ACCOUNTS)) {
  test(`sign in as ${name}`, async ({ page }) => {
    await submitLogin(page, email, SEED_PASSWORD);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
    await page.context().storageState({
      path: sessionFile(name as AccountName),
    });
  });
}
