import { argosScreenshot } from "@argos-ci/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  ACCOUNTS,
  BUSINESS_TENANT as T,
  FREE_TENANT,
  PRO_TENANT,
  expectNoErrorScreen,
  sessionFile,
  type AccountName,
} from "../support/accounts";
import {
  customerIdOf,
  defaultSlaPolicyId,
  seededTicketId,
} from "../support/db";

// Screens use juniper, which no other test writes to, so its data only changes
// when the stack is rebuilt.
const CUSTOMER = ACCOUNTS.businessCustomer;
const TICKET = "Integration stopped syncing overnight";

const ticketPath = async () =>
  `/${T}/tickets/${await seededTicketId(CUSTOMER, TICKET)}`;
const customerPath = async () =>
  `/${T}/customers/${await customerIdOf(CUSTOMER)}`;
const policyPath = async () => `/${T}/sla/${await defaultSlaPolicyId(T)}`;
const portalTicketPath = async () =>
  `/${T}/portal/requests/${await seededTicketId(CUSTOMER, TICKET)}`;

type Screen = {
  name: string;
  path: string | (() => Promise<string>);
  /** Opens a dialog or similar before the screenshot. */
  open?: (page: Page) => Promise<void>;
  /** The app is meant to refuse this role, so the 404 screen is the result. */
  refused?: boolean;
  /** Parts of this screen that can't be compared between builds. */
  mask?: string[];
  /** Screenshot only this element, for a dialog over a changing page. */
  element?: string;
  /** Totals here change as other tests run, so they're replaced too. */
  figures?: boolean;
};

const staffScreens = (role: string, extra: Screen[]): Screen[] => [
  {
    name: `${role}/tickets`,
    path: `/${T}/tickets`,
    // Tickets with the same subject swap places between stack rebuilds.
    mask: ["main table tbody"],
  },
  { name: `${role}/ticket-detail`, path: ticketPath },
  { name: `${role}/views`, path: `/${T}/views` },
  { name: `${role}/customers`, path: `/${T}/customers` },
  { name: `${role}/customer-detail`, path: customerPath },
  { name: `${role}/sla-policies`, path: `/${T}/sla` },
  { name: `${role}/reports`, path: `/${T}/reports` },
  {
    name: `${role}/notification-settings`,
    path: `/${T}/settings/notifications`,
  },
  ...extra,
];

const GROUPS: [AccountName, Screen[]][] = [
  [
    "businessAdmin",
    [
      ...staffScreens("tenant-admin", [
        {
          name: "tenant-admin/new-ticket",
          path: `/${T}/tickets`,
          open: (page) =>
            page.getByRole("button", { name: "New ticket" }).click(),
          element: '[role="dialog"][data-slot="sheet-content"]',
        },
        { name: "tenant-admin/sla-new", path: `/${T}/sla/new` },
        { name: "tenant-admin/sla-detail", path: policyPath },
        { name: "tenant-admin/team", path: `/${T}/settings/team` },
        {
          name: "tenant-admin/invite-member",
          path: `/${T}/settings/team`,
          open: (page) =>
            page.getByRole("button", { name: "Invite member" }).click(),
          element: '[role="dialog"]',
        },
        { name: "tenant-admin/branding", path: `/${T}/settings/branding` },
        {
          name: "tenant-admin/audit",
          path: `/${T}/settings/audit`,
          // Each run's sign-ins add events.
          figures: true,
          mask: ["main table tbody"],
        },
        { name: "tenant-admin/billing", path: `/${T}/account/billing` },
        { name: "tenant-admin/plans", path: `/${T}/account/plans` },
      ]),
      { name: "platform/overview", path: "/platform" },
      { name: "platform/tenants", path: "/platform/tenants" },
      { name: "platform/users", path: "/platform/users" },
      { name: "platform/plans", path: "/platform/plans" },
      { name: "platform/billing", path: "/platform/billing" },
      { name: "platform/analytics", path: "/platform/analytics" },
      {
        name: "platform/audit-logs",
        path: "/platform/audit-logs",
        mask: ["main table tbody"],
      },
      { name: "platform/health", path: "/platform/health" },
      { name: "platform/logs", path: "/platform/logs" },
      { name: "platform/settings", path: "/platform/settings" },
    ],
  ],
  [
    "businessManager",
    staffScreens("manager", [
      { name: "manager/team", path: `/${T}/settings/team` },
    ]),
  ],
  [
    "businessAgent",
    staffScreens("agent", [
      {
        name: "agent/team-refused",
        path: `/${T}/settings/team`,
        refused: true,
      },
    ]),
  ],
  [
    "businessBilling",
    [
      { name: "billing-admin/billing", path: `/${T}/account/billing` },
      { name: "billing-admin/plans", path: `/${T}/account/plans` },
    ],
  ],
  [
    "businessCustomer",
    [
      {
        name: "portal/requests",
        path: `/${T}/portal/requests`,
        // Rows seeded in the same instant swap places between stack rebuilds.
        mask: ['main a[href*="/portal/requests/"]:not([href$="/new"])'],
      },
      { name: "portal/request-detail", path: portalTicketPath },
      { name: "portal/new-request", path: `/${T}/portal/requests/new` },
      { name: "portal/help", path: `/${T}/portal/help` },
      { name: "portal/password", path: `/${T}/portal/password` },
    ],
  ],
  [
    "proAdmin",
    [
      { name: "plan-pro/audit-locked", path: `/${PRO_TENANT}/settings/audit` },
      { name: "plan-pro/plans", path: `/${PRO_TENANT}/account/plans` },
      { name: "plan-pro/billing", path: `/${PRO_TENANT}/account/billing` },
    ],
  ],
  [
    "freeAdmin",
    [
      { name: "plan-free/reports-locked", path: `/${FREE_TENANT}/reports` },
      {
        name: "plan-free/branding-locked",
        path: `/${FREE_TENANT}/settings/branding`,
      },
      {
        name: "plan-free/audit-locked",
        path: `/${FREE_TENANT}/settings/audit`,
      },
      { name: "plan-free/plans", path: `/${FREE_TENANT}/account/plans` },
      { name: "plan-free/billing", path: `/${FREE_TENANT}/account/billing` },
    ],
  ],
];

// Dates and times come from seed rows written relative to "now", so they differ
// on every stack rebuild and every day. Masking them would still move the layout
// when their width changes, so the text itself is replaced with a fixed value.
const MONTH = "(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
const CHANGES_WITH_TIME = [
  `\\b\\d{1,2} ${MONTH}( \\d{4})?\\b`,
  `\\b${MONTH} \\d{1,2}(, \\d{4})?\\b`,
  "\\b\\d{1,2}:\\d{2}(:\\d{2})?(\\s?[AP]M)?\\b",
  "\\b(about |almost |over |less than )?(a|an|\\d+) ?[a-z]+ ago\\b",
  "\\b\\d+\\s?ms\\b",
  "\\b\\d+\\s?[smhd]( \\d+\\s?[smh])? (ago|left|overdue|late)\\b",
  "\\b(just now|today|yesterday)\\b",
];
// The console totals every workspace, so its figures change as other tests run.
const FIGURE = "^\\$?[\\d,.]+\\s?(%|ms|s|m|h|d|KB|MB|GB)?( / [\\d,.]+)?$";

async function normalizeText(page: Page, patterns: string[], figures: boolean) {
  await page.evaluate(
    ({ patterns, figure }) => {
      const expressions = patterns.map((p) => new RegExp(p, "gi"));
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        let text = n.textContent ?? "";
        for (const expression of expressions) {
          text = text.replace(expression, "--");
        }
        if (figure && new RegExp(figure).test(text.trim())) text = "--";
        if (text !== n.textContent) n.textContent = text;
      }
    },
    { patterns, figure: figures ? FIGURE : null },
  );
}

for (const [account, screens] of GROUPS) {
  test.describe(account, () => {
    test.use({ storageState: sessionFile(account) });

    for (const screen of screens) {
      test(`screenshot ${screen.name}`, async ({ page }) => {
        const path =
          typeof screen.path === "string" ? screen.path : await screen.path();

        await page.goto(path, { waitUntil: "networkidle" });

        // A redirect or error page would otherwise become the approved baseline.
        expect(new URL(page.url()).pathname).toBe(path);
        if (screen.refused) {
          await expect(
            page.getByRole("heading", { name: "We couldn't find that page" }),
          ).toBeVisible();
        } else {
          await expectNoErrorScreen(page);
          await expect(
            page.getByRole("heading", { name: "We couldn't find that page" }),
          ).toHaveCount(0);
        }

        await screen.open?.(page);

        await normalizeText(
          page,
          CHANGES_WITH_TIME,
          screen.figures || screen.name.startsWith("platform/"),
        );

        await argosScreenshot(page, screen.name, {
          ...(screen.element ? { element: screen.element } : {}),
          mask: [".recharts-wrapper", ...(screen.mask ?? [])].map((selector) =>
            page.locator(selector),
          ),
          argosCSS: [
            // The unread badge: its count grows as other tests create tickets.
            '[aria-label^="Notifications,"] > span { visibility: hidden; }',
            // The blurred sample data behind a plan lock (LockedBackdrop), which
            // renders slightly differently on each run.
            "[inert][aria-hidden] { visibility: hidden; }",
          ].join("\n"),
        });
      });
    }
  });
}
