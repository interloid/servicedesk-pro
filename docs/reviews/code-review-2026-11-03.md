# Code Review Report

- **Date:** 2026-11-03
- **Reviewer:** Claude Code (automated review)
- **Scope:** `src/` (app, components, features, lib, hooks, config), plus `supabase/schemas` and `supabase/functions` where a finding depends on them · 426 files
- **Verdict:** CRITICAL

---

## How this was checked

- **Depth:** All 426 files went through `tsc`, ESLint and pattern scans. Auth, the proxy, server actions, billing, blocking and database policies were read closely. Large UI components were sampled, not read line by line, so UI bugs may remain.
- **Proven by running:** RISK-001 ran against the real policy files in a local Postgres. It assumes Supabase's default table grants.
- **Not run on live:** The Supabase connector refuses queries on the live project. Confirm RISK-001 and RISK-002 there.
- **Tooling:** `tsc` and ESLint report no errors. There are no automated tests.
- **Checked and not reported:** Mixed-case workspace addresses do not get past blocking. `dangerouslySetInnerHTML` is safe in both places: colours are checked as hex, and JSON-LD escapes `<`. `LinkifiedText` only links `http` and `https`. Email templates escape their values. Billing Admin fixes from earlier today are not repeated here.

## Corrections after fixing

Reading the code to fix these showed three recommendations in this report were wrong:

- **RISK-003:** Changing `is_active_membership()` would not have worked, because the `tickets` rules never call it. The fix is a restrictive rule on every table with a `tenant_id`.
- **RISK-005:** `admin.auth.admin.signOut` needs the member's own token, which the server does not have. The app now refreshes the token when its role differs from the live role.
- **RISK-015:** Only the indexing part was real. Those pages get titles from their layouts or only redirect, so the "seven pages have no title" claim was wrong.

---

## ⚡ 1. High-Risk Issues (Bugs, Security Leaks, Broken Logic)

- **RISK-001** · `supabase/schemas/policies/02_tenants.sql:39`, `05_subscriptions.sql:34`, `05_subscriptions.sql:53`, `18_invoices.sql:34`, `18_invoices.sql:53`
- **What is wrong:** Database rules let a Tenant Admin or Billing Admin write billing data directly. No trigger protects `tenants.plan_id`, subscriptions or invoices.
- **Why it matters:** A Free workspace admin can give themselves the Business plan without paying. In the Postgres test, one login token set the plan to Business and seats to 9,999. It also marked a failed invoice as paid and inserted a fake invoice.
- **Recommendation:** Remove these write rules and stop signed-in users changing `plan_id`, because the app and PayPal functions write billing data with the service role.
- **Minimal fix:**

```sql
drop policy "subscriptions_insert" on public.subscriptions;
drop policy "subscriptions_update" on public.subscriptions;
drop policy "subscriptions_delete" on public.subscriptions;
drop policy "invoices_insert" on public.invoices;
drop policy "invoices_update" on public.invoices;
drop policy "invoices_delete" on public.invoices;

-- In tenants_guard_block, inside the authenticated/anon branch:
new.plan_id := old.plan_id;
```

- **RISK-002** · `src/features/platform-admin/services/platform-access.ts:44`
- **What is wrong:** Platform admin access depends only on the email address matching a list. The code never checks that the address was verified.
- **Why it matters:** If "Confirm email" is off on live, anyone can sign up as `admin@servicedesk.com`. That person can then read every workspace and block any of them. If nobody on the team owns that domain, its eventual owner can also receive the reset emails.
- **Recommendation:** Require a verified email now, then move to a list of user IDs, because customer invites create pre-confirmed accounts (`customer-invite.service.ts:271`).
- **Minimal fix:**

```ts
if (!user.email_confirmed_at || !isPlatformAdminEmail(email)) {
  notFound();
}
```

- **RISK-003** · `supabase/schemas/functions/06_tenant_check_helper.sql:1`, `src/proxy.ts:191`
- **What is wrong:** Blocking only runs in the Next.js proxy. Database rules never read `tenants.status`, and the Edge Functions were not changed to check it.
- **Why it matters:** A blocked user keeps their login token and refresh token. They can still read and change tenant data by calling Supabase directly. A workspace blocked for abuse is therefore only blocked in the browser app.
- **Recommendation:** Make the shared membership check fail for a suspended workspace, then test billing pages for payment-blocked workspaces.
- **Minimal fix:**

```sql
-- Inside public.is_active_membership():
JOIN public.tenants t ON t.id = m.tenant_id AND t.status <> 'suspended'
```

---

## ⚠️ 2. Medium-Risk Issues (Performance, Anti-patterns, Next.js Violations)

- **RISK-004** · `src/app/platform/tenants/page.tsx:15`, `src/app/platform/users/page.tsx`, `src/app/platform/(overview)/page.tsx`, `src/app/platform/settings/page.tsx`
- **What is wrong:** These four pages read data with the service role but rely only on the layout's admin check. The six newer platform pages also check inside the page.
- **Why it matters:** A layout does not run again on client navigation. Someone removed from the admin list may keep seeing these pages until a full reload. A crafted request might also skip the layout. My test of that was inconclusive, so this is not a proven bypass.
- **Recommendation:** Call `requirePlatformAdmin()` at the top of each of these pages.
- **Minimal fix:**

```tsx
export default async function PlatformTenantsPage() {
  await requirePlatformAdmin();
  const tenants = await getPlatformTenants();
```

- **RISK-005** · `src/lib/identity.ts:70`, `src/features/team/services/team.service.ts`
- **What is wrong:** A role change does not refresh the person's login token. Database rules keep using the old role for up to an hour.
- **Why it matters:** Someone just made Tenant Admin or Billing Admin can see empty screens. The sidebar reads the subscription through this token, so its plan name and seat limit can be wrong. Billing was fixed earlier today, but other screens still read through the token.
- **Recommendation:** After a role change, end that person's session so their next token carries the new role.
- **Minimal fix:**

```ts
// After the role update succeeds. Check the scope against the current SDK.
await admin.auth.admin.signOut(memberAccessToken, "global");
```

- **RISK-006** · `src/features/audit/types/audit.ts:391`, `src/components/shared/layout/app-sidebar.tsx:210`, `src/features/audit/services/audit.service.ts:47`
- **What is wrong:** The sidebar locks Audit log by plan name. The page and the database rule read the `audit_logs` flag. This is a cross-file issue marked Medium because it causes a real bug.
- **Why it matters:** Turn on `audit_logs` for Pro in Plans & Features, and the page opens while the sidebar still shows it locked. Reports and Branding are also decided by plan name, so renaming a plan changes access.
- **Recommendation:** Pass the plan's flags to the sidebar and use one access check everywhere.
- **Minimal fix:**

```ts
locked: identity?.org.features?.audit_logs !== true,
```

- **RISK-007** · `src/features/platform-admin/services/platform-observability.service.ts:732`, `src/features/platform-admin/services/platform-analytics.service.ts:21`
- **What is wrong:** `platform_db_health` and `platform_analytics` run heavy database work on every page load. Neither result is cached.
- **Why it matters:** `platform_db_health` already timed out on live, and the admin saw an error card. Each refresh repeats the query. The cron change may not be the full cause, because the old query took only 0.5 seconds locally at 1 million rows.
- **Recommendation:** Cache both results for 60 seconds, as the log queries now do.
- **Minimal fix:**

```ts
const readDbHealth = unstable_cache(fetchDbHealth, ["platform-db-health"], {
  revalidate: 60,
});
```

- **RISK-008** · `src/features/platform-admin/services/platform-data.service.ts:307`, `src/features/platform-admin/services/platform-billing.service.ts:129`, `src/features/platform-admin/services/platform-plans.service.ts:47`, `src/features/platform-admin/services/platform-audit.service.ts:119`
- **What is wrong:** The Users page loads every login account, and the Billing page loads every invoice. Two other reads have no paging and are limited by the API's row cap.
- **Why it matters:** These pages slow down as customers grow. With the usual 1,000-row cap, workspace counts and MRR on Plans & Features become too low with no warning. The audit workspace filter also misses workspaces past that cap.
- **Recommendation:** Calculate totals in the database and fetch only the rows on the current page.
- **Minimal fix:**

```ts
// Plans: read counts and revenue from one grouped RPC.
const { data } = await admin.rpc("platform_plan_totals");
```

- **RISK-009** · `src/features/billing/services/billing.service.ts:26`, `supabase/schemas/seeds/01_plans_seed.sql`
- **What is wrong:** The Free plan advertises 50 tickets and 1 GB, but no code enforces either limit. `branding`, `business_hours`, `advanced_roles` and `ai_automation` flags control nothing either.
- **Why it matters:** Customers can exceed Free limits with no reason to upgrade. Paying customers may also buy features the code does not deliver through those flags.
- **Recommendation:** Enforce each limit in the database, or remove it from the pricing page.
- **Minimal fix:**

```sql
-- BEFORE INSERT on tickets: raise when the plan's ticket_limit is reached.
```

- **RISK-010** · `src/features/tickets/services/tickets.service.ts:1`, `src/features/branding/services/branding.service.ts:1`, `src/features/reports/service/reports.service.ts:1`, `src/features/sla-policies/service/sla.service.ts:1`, `src/features/notifications/services/notifications.service.ts:1`
- **What is wrong:** These five services use server clients but lack `import "server-only"`. Client files such as `create-ticket-sheet.tsx:42` also import types from them without the `type` keyword.
- **Why it matters:** One accidental value import would pull server code into the browser build. Nothing would stop the build at that point. The service role key is guarded elsewhere, but this first line of defence is missing.
- **Recommendation:** Add the marker to all five and use `import type` in client files.
- **Minimal fix:**

```ts
import "server-only";
// In the client file:
import type { Customer } from "../services/tickets.service";
```

- **RISK-011** · `next.config.ts:39`
- **What is wrong:** The app sends good security headers but no Content-Security-Policy. That header tells the browser which scripts may run.
- **Why it matters:** If a script injection bug ever appears, nothing limits the damage. Injected code could act as a signed-in admin. Customer-written tickets are shown to staff, which makes this worth having.
- **Recommendation:** Add the policy in report-only mode first, then enforce it once reports are clean.
- **Minimal fix:**

```ts
{
  key: "Content-Security-Policy-Report-Only",
  value: "default-src 'self'; frame-ancestors 'self'; object-src 'none'",
},
```

- **RISK-012** · `src/lib/platform-maintenance.ts:84`, `src/app/api/workspace-status/route.ts:11`
- **What is wrong:** Every new workspace address triggers a database query using the service role. No sign-in or rate limit protects this path.
- **Why it matters:** A script sending random addresses causes one database query per request. The 10-second cache does not help because each address is new. This could slow the app for real users.
- **Recommendation:** Rate limit the status API and cache "not blocked" for unknown addresses longer.
- **Minimal fix:**

```ts
const { allowed } = await rateLimit(`status:${await clientKey()}`, {
  limit: 30,
  windowMs: 60_000,
});
if (!allowed) return NextResponse.json({}, { status: 429 });
```

- **RISK-013** · `src/lib/supabase/admin.ts:37`, `src/features/audit/services/audit.service.ts:326`, `src/features/platform-admin/services/platform-data.service.ts:156`
- **What is wrong:** The admin client is created without the generated `Database` type. Query results are then forced with `as unknown as` in six places, and one helper uses `any`.
- **Why it matters:** A misspelled or missing column still compiles. The bug appears only when the page runs. Those forced types are also why missing-column fallbacks have to match error text.
- **Recommendation:** Pass the generated types to the client and remove the forced casts.
- **Minimal fix:**

```ts
import type { Database } from "./database.types";
cached = createClient<Database>(url, key, { auth: AUTH_OPTIONS });
```

- **RISK-014** · `src/features/onboarding/services/onboarding.service.ts:242`, `src/features/portal/actions/portal.actions.ts:619`
- **What is wrong:** Public actions reveal whether an email already has an account. They are limited per IP address, but they are still public.
- **Why it matters:** Someone can test a list of emails from many addresses. They learn who uses the product, which helps targeted phishing. The signup form does benefit from the check, so this is a trade-off.
- **Recommendation:** Keep the limit low and move the "already registered" answer to the final signup step.
- **Minimal fix:**

```ts
// Stop calling checkEmailTenantAction on blur. Report the conflict on submit.
```

- **RISK-015** · `src/app/robots.ts:7`, `src/app/layout.tsx:42`, `src/app/(app)/[tenantSlug]/(base-layout)/customers/[customerId]/page.tsx`, `src/app/(app)/[tenantSlug]/payment/success/page.tsx`
- **What is wrong:** Robots rules allow every path, and the root layout sets `index: true`. Seven pages also have no page title of their own, including customer details and payment results.
- **Why it matters:** Search engines may list workspace login pages and customer portals. Several browser tabs also show the same generic name, which makes them hard to tell apart.
- **Recommendation:** Disallow tenant and platform paths where possible, and set `noindex` plus a title on these pages.
- **Minimal fix:**

```ts
export const metadata: Metadata = {
  title: "Customer",
  robots: { index: false, follow: false },
};
```

- **RISK-016** · `package.json:21`
- **What is wrong:** `npm audit` reports 5 moderate issues through `@sentry/nextjs`, which pulls in `glob` and `minimatch`.
- **Why it matters:** These packages appear to run during the build, not for end users, so the risk is low. They still add noise that can hide a serious alert later.
- **Recommendation:** Upgrade `@sentry/nextjs` when a release with the fixed packages is available.
- **Minimal fix:**

```sh
npm update @sentry/nextjs && npm audit --omit=dev
```

---

## 🏗️ 3. Architectural & Cross-File Findings

- **RISK-017** · Affected files: whole repository, `.husky/pre-commit`
- **What is wrong:** There are no automated tests, and the pre-commit hook only runs formatting.
- **Why it matters:** Every billing or access rule depends on manual checks. RISK-001 and today's Billing Admin bugs are the kind a basic role test would catch.
- **Recommendation:** Start with database policy tests and proxy route tests, then add billing flows.

- **RISK-018** · Affected files: `src/features/auth/services/auth.service.ts:227`, `src/lib/tenancy.ts:318`
- **What is wrong:** `safeNext` accepts `/\evil.com`, which browsers treat as another site. `isSafeInternalPath` has the same gap and nothing uses it.
- **Why it matters:** I found no way to exploit this today, because callers add a fixed workspace prefix or host. One future caller that redirects directly would create an open redirect.
- **Recommendation:** Keep one validator, reject backslashes, and delete the unused one.

- **RISK-019** · Affected files: `src/components/shared/coming-soon.tsx`, `src/components/shared/layout/sidebar-viewport-sync.tsx`, `src/components/ui/collapsible.tsx`, `src/features/auth/schemas/signup-account.ts`, `src/features/portal/components/portal-link-card.tsx`, `src/lib/notifications.ts`, `src/lib/tenancy.ts`
- **What is wrong:** Nothing imports these six files. `tenantForgotPasswordPath` and `tenantResetPasswordPath` in `tenancy.ts` are also unused.
- **Why it matters:** Developers may update or copy code that never runs. Confirm each file before deleting it, because this came from an import scan.
- **Recommendation:** Delete them after a final search and a clean build.

- **RISK-020** · Affected files: `src/features/platform-admin/format.ts`, `src/features/platform-admin/components/overview-dashboard.tsx:35`, `src/lib/format.ts`, `src/features/platform-admin/components/users-table.tsx`, `src/features/platform-admin/components/platform-sidebar.tsx`, `src/features/team/components/modal-buttons.ts`, `src/features/billing/components/modal-buttons.ts`, `src/app/(auth)/reset-password/page.tsx`, `src/app/(app)/[tenantSlug]/reset-password/page.tsx`
- **What is wrong:** Currency and initials helpers exist in several copies. There are two popup button style files and two reset-password pages.
- **Why it matters:** A fix reaches one copy and misses the others. The invite button fix did not reach billing's separate style, so billing popups may still have a grey outline.
- **Recommendation:** Keep one shared helper and one button style, and share the reset-password form.

- **RISK-021** · Affected files: `src/service/`, `src/actions/`, `src/features/sla-policies/service/`, `src/features/sla-policies/action/`, `src/features/reports/service/`
- **What is wrong:** Folder names mix `service` and `services`, and `action` and `actions`. Some code also sits outside `features/`.
- **Why it matters:** Developers search the wrong place and may write a second copy. Automated checks by path can also miss these files.
- **Recommendation:** Rename to one pattern in a separate change with no logic edits.

- **RISK-022** · Affected files: `src/features/portal/services/portal.service.ts`, `src/features/branding/components/branding-editor.tsx`, `src/features/sla-policies/components/sla-editor.tsx`, `src/features/tickets/services/tickets.service.ts`, `src/features/tickets/components/ticket-detail-view.tsx`
- **What is wrong:** These files run from about 1,500 to over 3,000 lines. Each one mixes several jobs.
- **Why it matters:** Reviews miss bugs in files this long, and two people editing one will often conflict. A small portal change means working inside a 3,057-line service.
- **Recommendation:** Split them by job when each is next changed, starting with `portal.service.ts`.

- **RISK-023** · Affected files: `supabase/functions/email-jobs/invitation-template.ts`, `supabase/functions/paypal-webhook/email.ts`, `supabase/functions/paypal-webhook/pdf.ts`, `supabase/functions/subscription/index.ts`, `src/features/billing/components/invoice-model.tsx`
- **What is wrong:** Emails, invoices and PayPal checkout hardcode "ServiceDesk" and `support@servicedesk.com`. They ignore Platform Settings.
- **Why it matters:** After a rename, customers see one name in the app and another on invoices. Replies may also go to an address nobody reads.
- **Recommendation:** Read the name and support email from `platform_settings` in these functions, keeping legal invoice details separate.

---

## 🧪 4. Required Test Cases

| Risk ID  | What the test does                                                                      | What it should prove                             |
| -------- | --------------------------------------------------------------------------------------- | ------------------------------------------------ |
| RISK-001 | Using a Tenant Admin token, update `tenants.plan_id` to the Business plan.              | The plan does not change.                        |
| RISK-001 | Using a Billing Admin token, update a subscription's plan and seats.                    | No subscription row changes.                     |
| RISK-001 | Using a Tenant Admin token, mark an invoice paid and insert a new one.                  | Both writes fail, and invoices stay the same.    |
| RISK-001 | Using the service role, apply a plan change as the PayPal webhook does.                 | The real billing flow still works.               |
| RISK-002 | Sign in as an allowlisted email with `email_confirmed_at` empty, then open `/platform`. | The page returns 404.                            |
| RISK-002 | Sign in as a verified email that is not on the list, then open `/platform`.             | The page returns 404.                            |
| RISK-002 | Sign in as a verified allowlisted admin, then open every platform page.                 | All pages load.                                  |
| RISK-003 | Block a workspace, then read `tickets` directly with a member's token.                  | No rows come back.                               |
| RISK-003 | Block a workspace, then update a ticket directly with a member's token.                 | Nothing changes.                                 |
| RISK-003 | Apply a payment block, then open billing and subscribe again as its admin.              | Billing works and the block lifts after payment. |
| RISK-003 | Unblock a workspace, then repeat the read with the same token.                          | Access returns with no new sign-in.              |

---

## 🏁 5. Verdict

**CRITICAL.** Types and lint are clean, and many edge cases are handled with care. But the database rules appear to let a workspace admin grant themselves a paid plan and forge invoices, and that needs confirming on live straight away. Fix RISK-001 first, because it directly loses revenue and makes billing records untrustworthy.

---

## 📋 6. Risk Tracking Table

| Risk ID  | Priority | Risk (Short Description)                            | File                                                                     | Completed | Reason if Not Completed                                                                                         |
| -------- | -------- | --------------------------------------------------- | ------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------- |
| RISK-001 | High     | Admins can self-upgrade and forge invoices          | `supabase/schemas/policies/05_subscriptions.sql`                         | Yes       | Apply migration 20261103160000 on live                                                                          |
| RISK-002 | High     | Platform admin access skips email verification      | `src/features/platform-admin/services/platform-access.ts`                | Yes       | Verified email now required; user-ID list not added                                                             |
| RISK-003 | High     | Blocked users keep direct database access           | `supabase/schemas/functions/06_tenant_check_helper.sql`                  | Yes       | Restrictive rules on all tenant tables; Edge Functions still unchecked                                          |
| RISK-004 | Medium   | Older platform pages rely on layout check           | `src/app/platform/tenants/page.tsx`                                      | Yes       | —                                                                                                               |
| RISK-005 | Medium   | Role changes leave old token active                 | `src/lib/identity.ts`                                                    | Yes       | Token refreshes automatically; see corrections                                                                  |
| RISK-006 | Medium   | Sidebar and audit page disagree on access           | `src/features/audit/types/audit.ts`                                      | Yes       | Audit log only; Reports and Branding still go by plan name                                                      |
| RISK-007 | Medium   | Health and analytics queries are uncached           | `src/features/platform-admin/services/platform-observability.service.ts` | Yes       | 60-second in-memory cache                                                                                       |
| RISK-008 | Medium   | Platform pages load everything or undercount        | `src/features/platform-admin/services/platform-data.service.ts`          | Partial   | Billing, sign-ins, plan counts and audit filter fixed; Tenants and Users still load all rows for browser search |
| RISK-009 | Medium   | Advertised plan limits are not enforced             | `src/features/billing/services/billing.service.ts`                       | No        | Skipped at the owner's request                                                                                  |
| RISK-010 | Medium   | Five services lack server-only marker               | `src/features/tickets/services/tickets.service.ts`                       | Yes       | —                                                                                                               |
| RISK-011 | Medium   | No Content-Security-Policy header                   | `next.config.ts`                                                         | Partial   | Report-only; enforce after checking the browser console                                                         |
| RISK-012 | Medium   | Random addresses trigger unlimited database queries | `src/lib/platform-maintenance.ts`                                        | Yes       | Lookups capped at 100 per 10 seconds per server, not rate limited, to avoid an extra database call              |
| RISK-013 | Medium   | Admin client lacks database types                   | `src/lib/supabase/admin.ts`                                              | Yes       | Typed client on; 7 `as unknown as` casts remain                                                                 |
| RISK-014 | Medium   | Public checks reveal registered emails              | `src/features/onboarding/services/onboarding.service.ts`                 | Partial   | Hourly limits tightened; check kept on the signup step so the flow stays the same                               |
| RISK-015 | Medium   | Private pages indexable, some lack titles           | `src/app/robots.ts`                                                      | Yes       | See corrections                                                                                                 |
| RISK-016 | Medium   | Five moderate audit issues through Sentry           | `package.json`                                                           | No        | Still 5 moderate on Sentry v11; npm only offers a downgrade to 10.76.1. Retry on a later release                |
| RISK-017 | Low      | No automated tests exist                            | whole repository                                                         | Partial   | 31 tests added and run on commit; no billing flow tests yet                                                     |
| RISK-018 | Low      | Redirect validator accepts backslash paths          | `src/features/auth/services/auth.service.ts`                             | Yes       | —                                                                                                               |
| RISK-019 | Low      | Six unused files and unused helpers                 | `src/lib/notifications.ts`                                               | Yes       | —                                                                                                               |
| RISK-020 | Low      | Helpers, buttons and reset pages duplicated         | `src/features/platform-admin/format.ts`                                  | Partial   | Currency, initials and billing button fixed; reset-password pages not merged, two button files remain           |
| RISK-021 | Low      | Inconsistent service and action folder names        | `src/service/`                                                           | Yes       | —                                                                                                               |
| RISK-022 | Low      | Several files exceed 1,500 lines                    | `src/features/portal/services/portal.service.ts`                         | No        | Deferred: split each file when it is next changed, as recommended                                               |
| RISK-023 | Low      | Brand and support email hardcoded                   | `supabase/functions/paypal-webhook/email.ts`                             | Yes       | Legal invoice line kept; redeploy email-jobs, paypal-webhook and subscription                                   |

> Update the **Completed** column as you fix each item. If a risk will not be fixed, replace `_Pending_` with the reason (for example: "Deferred to Q3 — requires auth refactor" or "Accepted risk — internal admin page only").
