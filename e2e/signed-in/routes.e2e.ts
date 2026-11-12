import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { expect, test } from "@playwright/test";

import {
  BUSINESS_TENANT as T,
  expectNoErrorScreen,
  sessionFile,
  type AccountName,
} from "../support/accounts";
import {
  customerIdOf,
  defaultSlaPolicyId,
  seededTicketId,
} from "../support/db";

const CUSTOMER = "jasmine.patel@gulfcoastfab.example";
const TICKET = "Integration stopped syncing overnight";

type Route = {
  /** The route as src/app defines it, with route groups removed. */
  route: string;
  path: string | (() => Promise<string>);
  /** Where the visit should end, when the page redirects by design. */
  lands?: RegExp;
};

const ticketPath = (prefix: string) => async () =>
  `${prefix}/${await seededTicketId(CUSTOMER, TICKET)}`;

// Grouped by who can open them. A route that fits nobody here fails the guard test.
const ROUTES: Partial<Record<"anonymous" | AccountName, Route[]>> = {
  anonymous: [
    { route: "/", path: "/" },
    { route: "/auth/confirm", path: "/auth/confirm" },
    { route: "/blocked", path: "/blocked" },
    { route: "/forgot-password", path: "/forgot-password" },
    { route: "/login", path: "/login" },
    { route: "/maintenance", path: "/maintenance" },
    { route: "/reset-password", path: "/reset-password" },
    { route: "/setup", path: "/setup" },
    { route: "/unauthorized", path: "/unauthorized" },
    { route: "/[tenantSlug]/forgot-password", path: `/${T}/forgot-password` },
    { route: "/[tenantSlug]/login", path: `/${T}/login` },
    { route: "/[tenantSlug]/reset-password", path: `/${T}/reset-password` },
    {
      route: "/[tenantSlug]/portal/check-email",
      path: `/${T}/portal/check-email?email=someone@example.com`,
    },
    { route: "/[tenantSlug]/portal/login", path: `/${T}/portal/login` },
  ],
  businessAdmin: [
    { route: "/platform", path: "/platform" },
    { route: "/platform/analytics", path: "/platform/analytics" },
    { route: "/platform/audit-logs", path: "/platform/audit-logs" },
    { route: "/platform/billing", path: "/platform/billing" },
    { route: "/platform/health", path: "/platform/health" },
    { route: "/platform/logs", path: "/platform/logs" },
    { route: "/platform/plans", path: "/platform/plans" },
    { route: "/platform/settings", path: "/platform/settings" },
    { route: "/platform/tenants", path: "/platform/tenants" },
    { route: "/platform/users", path: "/platform/users" },
    { route: "/[tenantSlug]/account/billing", path: `/${T}/account/billing` },
    {
      route: "/[tenantSlug]/account/billing/cancel",
      path: `/${T}/account/billing/cancel`,
      lands: /\/account\/plans$/,
    },
    { route: "/[tenantSlug]/account/plans", path: `/${T}/account/plans` },
    { route: "/[tenantSlug]/customers", path: `/${T}/customers` },
    {
      route: "/[tenantSlug]/customers/[customerId]",
      path: async () => `/${T}/customers/${await customerIdOf(CUSTOMER)}`,
    },
    { route: "/[tenantSlug]/payment/cancel", path: `/${T}/payment/cancel` },
    { route: "/[tenantSlug]/payment/success", path: `/${T}/payment/success` },
    { route: "/[tenantSlug]/reports", path: `/${T}/reports` },
    { route: "/[tenantSlug]/settings/audit", path: `/${T}/settings/audit` },
    {
      route: "/[tenantSlug]/settings/branding",
      path: `/${T}/settings/branding`,
    },
    {
      route: "/[tenantSlug]/settings/notifications",
      path: `/${T}/settings/notifications`,
    },
    { route: "/[tenantSlug]/settings/team", path: `/${T}/settings/team` },
    { route: "/[tenantSlug]/sla", path: `/${T}/sla` },
    { route: "/[tenantSlug]/sla/new", path: `/${T}/sla/new` },
    {
      route: "/[tenantSlug]/sla/[policyId]",
      path: async () => `/${T}/sla/${await defaultSlaPolicyId(T)}`,
    },
    { route: "/[tenantSlug]/tickets", path: `/${T}/tickets` },
    {
      route: "/[tenantSlug]/tickets/[ticketId]",
      path: ticketPath(`/${T}/tickets`),
    },
    { route: "/[tenantSlug]/views", path: `/${T}/views` },
  ],
  businessCustomer: [
    {
      route: "/[tenantSlug]/portal",
      path: `/${T}/portal`,
      lands: /\/portal\/requests$/,
    },
    { route: "/[tenantSlug]/portal/help", path: `/${T}/portal/help` },
    { route: "/[tenantSlug]/portal/password", path: `/${T}/portal/password` },
    { route: "/[tenantSlug]/portal/requests", path: `/${T}/portal/requests` },
    {
      route: "/[tenantSlug]/portal/requests/new",
      path: `/${T}/portal/requests/new`,
    },
    {
      route: "/[tenantSlug]/portal/requests/[requestId]",
      path: ticketPath(`/${T}/portal/requests`),
    },
    {
      // Every seeded customer has finished onboarding, so this checks the redirect
      // rather than the wizard itself.
      route: "/[tenantSlug]/portal/welcome",
      path: `/${T}/portal/welcome`,
      lands: /\/portal\/requests$/,
    },
  ],
};

function pageRoutesOnDisk(root = "src/app", dir = root): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) return pageRoutesOnDisk(root, full);
    if (entry.name !== "page.tsx") return [];

    const parts = relative(root, dir)
      .split(sep)
      .filter((part) => part && !/^\(.*\)$/.test(part));

    return [`/${parts.join("/")}`];
  });
}

test("every page in src/app has a route test", () => {
  const tested = Object.values(ROUTES).flatMap((routes = []) =>
    routes.map(({ route }) => route),
  );

  expect(tested.toSorted()).toEqual(pageRoutesOnDisk().toSorted());
});

for (const [account, routes = []] of Object.entries(ROUTES)) {
  test.describe(`route as ${account}`, () => {
    test.use({
      storageState:
        account === "anonymous"
          ? { cookies: [], origins: [] }
          : sessionFile(account as AccountName),
    });

    for (const { route, path, lands } of routes) {
      test(route, async ({ page }) => {
        const violations: string[] = [];
        const serverErrors: string[] = [];

        page.on("console", (message) => {
          if (message.text().includes("Content Security Policy")) {
            violations.push(message.text());
          }
        });
        page.on("response", (response) => {
          if (response.status() >= 500) {
            serverErrors.push(`${response.status()} ${response.url()}`);
          }
        });

        const url = typeof path === "string" ? path : await path();
        const response = await page.goto(url, { waitUntil: "networkidle" });

        expect(response?.status(), url).toBeLessThan(400);
        if (lands) {
          await expect(page).toHaveURL(lands);
        } else {
          expect(new URL(page.url()).pathname).toBe(url.split("?")[0]);
        }
        await expectNoErrorScreen(page);
        expect(violations).toEqual([]);
        expect(serverErrors).toEqual([]);
      });
    }
  });
}
