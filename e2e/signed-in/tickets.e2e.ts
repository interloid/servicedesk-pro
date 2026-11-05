import { expect, test, type Page } from "@playwright/test";

import { ACCOUNTS, PRO_TENANT, sessionFile } from "../support/accounts";

test.use({ storageState: sessionFile("proAdmin") });

function uniqueSubject(label: string): string {
  return `E2E ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Creates a ticket for the seeded customer and leaves the page on its detail. */
async function createAndOpenTicket(page: Page, subject: string): Promise<void> {
  await page.goto(`/${PRO_TENANT}/tickets`);
  await page.getByRole("button", { name: "New ticket" }).click();

  const sheet = page.getByRole("dialog", { name: "New ticket" });
  await sheet.getByLabel(/^Subject/).fill(subject);
  await sheet.getByRole("combobox", { name: /Requester/ }).click();
  await page.getByLabel("Search customers").fill(ACCOUNTS.proCustomer);
  await page.getByRole("option", { name: ACCOUNTS.proCustomer }).click();
  await sheet.getByRole("button", { name: "Create ticket" }).click();
  await expect(sheet).toBeHidden({ timeout: 15_000 });

  await page.goto(`/${PRO_TENANT}/tickets`);
  await searchFor(page, subject);
  await page.getByRole("link", { name: subject }).click();
  await expect(page.getByRole("heading", { name: subject })).toBeVisible();
}

async function searchFor(page: Page, subject: string): Promise<void> {
  await page.getByPlaceholder("Search this view").fill(subject);
  await expect(page).toHaveURL(/search=/);
}

test("lists seeded tickets", async ({ page }) => {
  await page.goto(`/${PRO_TENANT}/tickets`);

  // filter: while the page streams, a hidden copy of this line exists as well.
  await expect(
    page.getByText(/\d+ total tickets/).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Dashboard loads very slowly/ }).first(),
  ).toBeVisible();
});

test("search narrows the list", async ({ page }) => {
  await page.goto(`/${PRO_TENANT}/tickets`);
  await searchFor(page, "Integration stopped syncing");

  await expect(
    page.getByRole("link", { name: /Integration stopped syncing/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Cannot log in after password reset/ }),
  ).toHaveCount(0);
});

test("the customer sees a reply but never an internal note", async ({
  page,
  browser,
}) => {
  const subject = uniqueSubject("visibility");
  await createAndOpenTicket(page, subject);
  const ticketId = page.url().split("/").pop();

  const reply = `Public reply ${subject}`;
  const composer = page.getByPlaceholder(/^Write a reply to/);
  await composer.fill(reply);
  await page.getByRole("button", { name: "Send to customer" }).click();
  await expect(page.getByText(reply).first()).toBeVisible();
  // The message can arrive over realtime before the send finishes, and finishing
  // clears the composer: anything typed before then would be wiped.
  await expect(composer).toHaveValue("");

  const note = `Internal note ${subject}`;
  await page
    .getByRole("button", { name: "Internal note", exact: true })
    .click();
  await page.getByPlaceholder(/^Visible to your team only/).fill(note);
  // .last(): the page header has a shortcut with the same name; this is the
  // composer's own submit button.
  await page.getByRole("button", { name: "Add internal note" }).last().click();
  await expect(page.getByText(note).first()).toBeVisible();

  // Both survive a reload, so they were saved and not just drawn optimistically.
  await page.reload();
  await expect(page.getByText(reply).first()).toBeVisible();
  await expect(page.getByText(note).first()).toBeVisible();

  const customer = await browser.newContext({
    storageState: sessionFile("proCustomer"),
  });
  const portal = await customer.newPage();
  await portal.goto(`/${PRO_TENANT}/portal/requests/${ticketId}`);

  await expect(portal.getByText(reply).first()).toBeVisible();
  await expect(portal.getByText(note)).toHaveCount(0);
  await customer.close();
});

test("resolving a ticket offers reopen, which puts it back in progress", async ({
  page,
}) => {
  await createAndOpenTicket(page, uniqueSubject("status"));

  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Resolved" }).click();
  await expect(page.getByText("Ticket resolved.")).toBeVisible();

  await page.getByRole("button", { name: "Reopen" }).click();
  await expect(page.getByText("Ticket reopened.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reopen" })).toBeHidden();
});
