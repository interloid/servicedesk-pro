import { expect, test } from "@playwright/test";

import { ACCOUNTS, PRO_TENANT, sessionFile } from "../support/accounts";
import { ticketIdOf } from "../support/db";

test.use({ storageState: sessionFile("proCustomer") });

test("a customer can find their own request", async ({ page }) => {
  await page.goto(`/${PRO_TENANT}/portal/requests`);
  await page
    .getByPlaceholder("Search your requests…")
    .fill("Integration stopped syncing");

  await expect(
    page.getByRole("link", { name: /Integration stopped syncing/ }),
  ).toBeVisible();
});

test("a customer raises a request and replies to it", async ({ page }) => {
  const subject = `E2E portal ${Date.now()}`;

  await page.goto(`/${PRO_TENANT}/portal/requests/new`);
  await page.getByLabel(/subject/i).fill(subject);
  await page
    .getByPlaceholder(/Describe what happened/)
    .fill("Raised by the end-to-end suite.");
  await page.getByRole("button", { name: "Create ticket" }).click();

  await page.getByRole("link", { name: new RegExp(subject) }).click();
  await expect(page.getByRole("heading", { name: subject })).toBeVisible();

  const reply = `Follow-up ${subject}`;
  const composer = page.getByPlaceholder("Write your reply…");
  await composer.fill(reply);
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText(reply).first()).toBeVisible();
  // Reloading mid-send would abort the request, so wait for it to finish.
  await expect(composer).toHaveValue("");
  await expect(page.getByRole("button", { name: "Send reply" })).toBeVisible();

  await page.reload();
  await expect(page.getByText(reply).first()).toBeVisible();
});

test("a customer cannot read another customer's request", async ({ page }) => {
  const otherId = await ticketIdOf("marcus.bell@baysidept.example");
  expect(otherId).not.toBe(await ticketIdOf(ACCOUNTS.proCustomer));

  await page.goto(`/${PRO_TENANT}/portal/requests/${otherId}`);

  await expect(
    page.getByRole("heading", { name: "We couldn't find that page" }),
  ).toBeVisible();
});
