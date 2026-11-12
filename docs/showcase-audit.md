# Showcase readiness audit: ServiceDesk

## 1. Verdict

**Not ready.** Audit date: 2026-11-11. Updated 2026-11-12 after fixes for SEC-05, SEC-06 and WF-02 on branch `showcase-fix/authz-and-nav`.

The code is well built: lint, type check, unit tests, the production build and a 195-case authorization suite all pass. The two security holes from the first audit (free paid workspaces, and writes across workspaces) are fixed in the repository, but **the migrations have not been applied to the live database yet**. Two blockers remain:

- A secret is in git history, and the local `.env` with live keys is not git-ignored.
- The landing page advertises AI, API and SSO features the product doesn't have.

Correction: the first audit said the sidebar linked to six missing pages. That was wrong. The sidebar filters those entries out, and a test now guards it. See WF-02.

## 2. Blockers

Each of these must be fixed before a client sees the project.

| #   | Item    | What is wrong                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Evidence                                                                                                                                                                                                                                                         |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | SEC-05  | **Fixed on branch; apply to live.** Migration `20261112120000_close_client_write_paths.sql` revokes `provision_tenant` from `PUBLIC`, `anon` and `authenticated`; `npm run test:authz` shows both calls refused with 42501. _Original finding:_ **Anyone can create a paid workspace without paying.** `provision_tenant` is `SECURITY DEFINER` and nothing revokes `EXECUTE` from `anon` or `authenticated`. Anyone with the public anon key can call it, create a Business-plan workspace and claim any email address. The project's own tracker rates this High and Confirmed.                       | `supabase/migrations/20260925120000_membership_is_primary_owner.sql:216-238` (signature takes `p_plan_id`, `p_email`). No `REVOKE` for it in any migration (searched `supabase/migrations/*.sql`). `docs/security/security-remediation-tracker.md:51` (SEC-031). |
| 2   | SEC-06  | **Fixed on branch; apply to live.** Migration `20261112130000_tenant_consistent_references.sql` makes 20 foreign keys tenant-consistent and guards assignees; the suite shows every cross-workspace write refused. _Original finding:_ **One workspace can write into another workspace's tickets.** Ticket writes accept ticket, message and attachment IDs that belong to another workspace. The tracker shows attacker text being emailed to another tenant's customer and that tenant's SLA being marked as met. No migration after the finding (2026-11-04) fixes it.                              | `docs/security/security-remediation-tracker.md:52` (SEC-032, Confirmed). Migrations after that date: `20261109120000_nightly_vacuum_cron.sql` and `20261109130000_purge_cron_run_history.sql` only.                                                              |
| 3   | SEC-01  | **A secret is in git history.** A `CRON_SECRET` value (starts `4da9`) was committed in `.env.example` in commit `2017141` (2026-09-05) and removed in `4cf2991` (2026-09-11). The function now uses service-role auth instead, so the secret is probably retired, but that has not been confirmed. Separately, the local `.env` holds live keys for Supabase service role, PayPal secret, Sentry auth, Resend and Argos, and **it is not git-ignored**: `.gitignore` covers only `.env.local`. One `git add .` would publish it.                                                                        | `git log -S'CRON_SECRET=4da9'`. `git check-ignore .env` gives no match.                                                                                                                                                                                          |
| 4   | TEST-04 | **Resolved on branch.** The suite now exists at `supabase/tests/authz/`, is re-included by `.gitignore`, and `npm run test:authz` passes 195 of 195 on a throwaway local PostgreSQL with no Docker. TEST-04 itself stays FAIL for the other reasons listed under it. _Original finding:_ **The authorization test suite does not exist in the repository.** `npm run test:authz` runs `supabase/tests/authz/run.sh`, but `.gitignore:57` (`tests`) ignores every folder named `tests`, and the suite was never committed. The README and the security docs rely on it as the proof of tenant isolation. | `package.json:23`, `README.md:376,495`. `git log --all -- 'supabase/tests/*'` is empty. `git check-ignore -v supabase/tests/authz/run.sh` matches `.gitignore:57`.                                                                                               |
| 5   | WF-11   | **The landing page claims features that don't exist.** It advertises "AI-Powered Support", "Autonomous Agent Copilots", "AI Copilot & Smart Ticket Triage", "REST API & Webhook Access" and "SAML SSO & Okta/Azure AD", none of which exists. It also promises 3 seats on Free and unlimited seats on Pro, while the plans have 2 and 15. (The first version of this row also listed dead sidebar links. That was wrong; see WF-02.)                                                                                                                                                                    | `src/app/page.tsx:92,104,140-158,251,294,330,338-342,378`. `README.md:320-324`.                                                                                                                                                                                  |

Also needed before a client sees it: apply migrations `20261112120000` and `20261112130000` to the live database and redeploy `reconcile-subscriptions`, `email-jobs` and `portal-storage-sweep` (see section 6).

Not verified in this audit: a live demo login and the main flow in a browser. The e2e stack needs Docker and the Supabase CLI and was not started. Treat the demo login as unconfirmed until someone runs `npm run e2e:stack && npm run test:e2e`.

## 3. Scorecard

| Section                            |   PASS | PARTIAL |   FAIL |   N/A | UNVERIFIED |
| ---------------------------------- | -----: | ------: | -----: | ----: | ---------: |
| WF: Product and workflow           |      3 |       8 |      1 |     0 |          0 |
| DES: Design and UX                 |      2 |       5 |      0 |     0 |          2 |
| ARCH: Architecture and code        |      4 |       5 |      1 |     2 |          0 |
| SEC: Security                      |      8 |       8 |      2 |     0 |          2 |
| TEST: Testing                      |      2 |       2 |      2 |     0 |          0 |
| PERF: Performance                  |      3 |       3 |      1 |     0 |          2 |
| OPS: Reliability and observability |      0 |       3 |      3 |     0 |          1 |
| DEP: Deployment and infrastructure |      1 |       2 |      9 |     0 |          1 |
| CI: CI and delivery                |      0 |       1 |      7 |     0 |          1 |
| AI: AI features                    |      0 |       0 |      0 |     7 |          0 |
| DOC: Documentation                 |      1 |       3 |      5 |     0 |          0 |
| **Total (113)**                    | **24** |  **40** | **31** | **9** |      **9** |

## 4. Top 10 fixes

Ordered by how much each improves a client's impression, against the effort it takes.

| #   | Item                     | What to do                                                                                                                                                                                                                                                                                                                                                                                                                         | Effort                    | Files                                                                                                                     |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | SEC-05                   | **Done on branch** (2026-11-12), except the service-role review below. Add a migration that revokes `EXECUTE` on `provision_tenant` from `public`, `anon` and `authenticated` (the app already calls it with the service role). In the same pass, close the other confirmed client-policy holes from the tracker: tenant insert and delete (SEC-007), customers reading all members (SEC-029) and writable invoice PDFs (SEC-008). | 2–4 h                     | new `supabase/migrations/*`, `supabase/schemas/functions/*`, `supabase/schemas/policies/02_tenants.sql`, storage policies |
| 2   | SEC-06                   | **Done on branch** (2026-11-12). Make ticket writes tenant-consistent: use composite foreign keys on `(tenant_id, id)` for `ticket_messages`, `attachments` and `tickets` references, or add checks to the policies. Add an attack test that proves it.                                                                                                                                                                            | 1–2 days                  | new migration, `supabase/schemas/tables/*`, test suite                                                                    |
| 3   | WF-11, DOC-07            | Rewrite the landing page to describe what the product does today. Remove the AI, autonomous-agent and REST API claims, show the real seat limits, and label it as a reference build.                                                                                                                                                                                                                                               | 3–4 h                     | `src/app/page.tsx`                                                                                                        |
| 4   | WF-02                    | **Corrected.** The sidebar already hid these entries; the finding was wrong. What remains: decide how the proxy should treat an Auth error (LOAD-001), then click through the main flow on the demo.                                                                                                                                                                                                                               | 2–4 h after the decision  | `src/proxy.ts:303-305`                                                                                                    |
| 5   | TEST-04, TEST-02         | **Suite done on branch** (2026-11-12); still add a single `npm run test:all`. Commit the SQL authorization suite. Change `.gitignore:57` from `tests` to the specific folders meant to be ignored. If the suite is lost, rewrite it, or remove the script and the README claims.                                                                                                                                                   | 2–4 h (more if rewritten) | `.gitignore`, `supabase/tests/authz/*`, `package.json`                                                                    |
| 6   | SEC-01                   | Confirm the old cron secret is retired everywhere (function secrets and Vault). Add `.env` and `.env.*` (except `.env.example`) to `.gitignore`. Add secret scanning (item 7).                                                                                                                                                                                                                                                     | 1 h                       | `.gitignore`                                                                                                              |
| 7   | CI-01, CI-02, CI-09      | Add a pull-request pipeline: install, lint, type check, unit tests, build, `npm audit --omit=dev`, a secret scan such as gitleaks, and the authz suite. Turn on Dependabot or Renovate.                                                                                                                                                                                                                                            | 1 day                     | new `.github/workflows/ci.yml`, `.github/dependabot.yml`                                                                  |
| 8   | ARCH-08                  | Record the table grants in a migration so the schema builds from scratch without the hand-applied grants in `scripts/e2e-stack.sh:79-84` (tracker SEC-033). Reschedule the reconcile cron with bearer auth (`README.md:673`).                                                                                                                                                                                                      | 0.5–1 day                 | new migration, `scripts/e2e-stack.sh`                                                                                     |
| 9   | OPS-01, OPS-02, LOAD-001 | Add `/api/health` that checks the database and Auth. Log JSON with a request ID. Stop treating an Auth error as "signed out" in the proxy.                                                                                                                                                                                                                                                                                         | 1 day                     | `src/app/api/health/route.ts`, `src/proxy.ts:303-305`, logging helper                                                     |
| 10  | DOC-08, DOC-09, DOC-04   | Add a LICENSE, privacy and terms pages (disclosing Sentry error tracking and cookies), and a one-page case study using the load-test numbers.                                                                                                                                                                                                                                                                                      | 0.5–1 day                 | `LICENSE`, `src/app/(legal)/*`, `docs/case-study.md`                                                                      |

The next largest gap is DEP-03 to DEP-08 (no infrastructure as code). It is days of work, so it is not in the top 10, but a technical reviewer will notice it.

## 5. Full findings

### Checks run

| Check                   | Command                                                                                                                        | Result                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint                    | `npm run lint`                                                                                                                 | Pass (exit 0, no warnings)                                                                                                                              |
| Format                  | `npm run format:check`                                                                                                         | Pass ("All matched files use Prettier code style")                                                                                                      |
| Type check              | `npx tsc --noEmit`                                                                                                             | Pass (exit 0). `tsconfig.json:7` `"strict": true`                                                                                                       |
| Unit tests              | `npm test`                                                                                                                     | Pass: 4 files, 25 tests                                                                                                                                 |
| Production build        | `npx next build`, with every live value from `.env` overridden by blanks or placeholders so nothing reached Sentry or Supabase | Pass: 58 routes. Prerender logged `[platform] settings read failed: fetch failed` because the database was a placeholder, and fell back without failing |
| Dependency audit (prod) | `npm audit --omit=dev`                                                                                                         | 0 vulnerabilities                                                                                                                                       |
| Dependency audit (all)  | `npm audit`                                                                                                                    | 12 (2 low, 10 moderate), all in dev tooling (`@typescript-eslint/*`, `minimatch`, `deepmerge`)                                                          |
| Outdated                | `npm outdated`                                                                                                                 | 18 packages behind, mostly patch or minor (`next` 16.4.2 → 16.4.6)                                                                                      |
| Authz suite             | `npm run test:authz`                                                                                                           | Cannot run: file not in repository (Blocker 4)                                                                                                          |
| E2E                     | `npm run test:e2e`                                                                                                             | Not run: needs Docker, the Supabase CLI and a several-minute stack build                                                                                |
| Secret search           | `git log --all -p` with patterns for Supabase, Sentry, Resend, Argos, PayPal, AWS, JWT and private keys                        | One hit: `CRON_SECRET` in `.env.example` history (Blocker 3)                                                                                            |

### WF: Product and workflow

- **WF-01 PASS**: `README.md:3` says what it is (multi-tenant help desk) and who uses it (staff, their customers, platform admins).
- **WF-02 PARTIAL** (re-graded 2026-11-12): The first audit's two code findings were wrong.
  - **Sidebar:** it lists entries for unbuilt routes, but renders only those in a shipped set (`src/components/shared/layout/app-sidebar.tsx:240` at audit time). That set now lives in `SHIPPED_TENANT_ROUTES` (`src/lib/tenancy.ts`). `src/lib/tenancy.test.ts` checks each entry against a `page.tsx` under `src/app/(app)/[tenantSlug]` (11 routes, all pass). Adding `/kb` to the set makes the test fail, which was checked.
  - **Customer ticket rows:** they already link to `/tickets/[id]` (`src/features/customers/components/customer-details.tsx:621`). Only a stale comment said otherwise; it is corrected.
  - **Still open:** an Auth error signs a valid user out (LOAD-001, `src/proxy.ts:303-305`). The load-test doc says that needs a decision, because the proxy is a security gate. The flow was not clicked through in a browser.
  - **Fix:** decide on LOAD-001, then run `npm run e2e:stack && npm run test:e2e` or click through the demo.
- **WF-03 PARTIAL**: Five roles with route guards and e2e tests (`README.md:283-289`, `e2e/signed-in/access.e2e.ts:77-115`). Customers could read every member's name and email (SEC-029). That is fixed on branch (see SEC-05); status not re-graded in this pass.
- **WF-04 PARTIAL**: Realistic seed data covers 15 companies across plans, time zones, ticket statuses and invoices (`scripts/seed-tenants.mjs:1-160`). One command (`npm run e2e:stack`) loads it for the test stack only. The dev or demo stack needs `--apply --project-ref`. "Harbor Freight Lines" (`seed-tenants.mjs:103`) closely matches a real US retailer. **Fix:** add `npm run seed` for the local stack, and rename that tenant.
- **WF-05 PARTIAL**: Accounts exist for every role on generic `*.seed.test` addresses (`e2e/support/accounts.ts:12-23`). They are not documented as demo logins in the README, and they share the weak password `test@123` (`accounts.ts:27`, `seed-tenants.mjs:48`). **Fix:** add a "Demo accounts" table to the README and use a stronger demo password.
- **WF-06 PARTIAL**: `--clean` then `--apply` rebuilds the seed (`README.md:567-578`), but by hand only. No scheduled reset exists. **Fix:** add a nightly reset job for the demo project.
- **WF-07 PASS**: Client validation uses React Hook Form and Zod, and actions parse again (`README.md:246-247`; `src/features/auth/actions/actions.ts:67` `loginSchema.safeParse`).
- **WF-08 PARTIAL**: `loading.tsx` and `error.tsx` exist for most segments (`src/app/(app)/[tenantSlug]/(base-layout)/**/loading.tsx`, `error.tsx`, `portal/error.tsx`, `platform/error.tsx`). Empty states were not checked screen by screen. **Fix:** check each main screen with an empty workspace.
- **WF-09 PASS**: `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`, plus segment-level `not-found.tsx` and `error.tsx` files.
- **WF-10 PARTIAL**: Seed addresses use `.test`, and seeded staff alerts are off (`seed-tenants.mjs:24-33`). But the app sends real mail through Gmail (`supabase/functions/_shared/gmail.ts`). A demo visitor who signs up at `/setup` and invites someone sends a real email. **Fix:** in the demo environment, send only to an allow-list or a catch-all inbox.
- **WF-11 FAIL**: See Blocker 5. **Fix:** item 3 and item 4 of the top 10.
- **WF-12 PARTIAL**: Money is formatted as `en-US`/`USD` (`src/features/platform-admin/format.ts:38-40`), and SLA time zones are per-workspace IANA zones. A consistent US/UK date format and currency for UK users were not shown. Code comments use `Asia/Kolkata` as the example zone (`src/features/sla-policies/format.ts:28`). **Fix:** format dates with the viewer's locale, and test with `en-GB`.

### DES: Design and user experience

- **DES-01 PARTIAL**: shadcn/ui and Radix, with tokens in `src/app/globals.css` (`components.json`, `src/components/ui/`). There are 53 hard-coded hex colours in `.tsx` files (`tickets-table.tsx`, `ticket-sla-card.tsx`, `api-traffic-chart.tsx` and others), and the landing page uses its own style. **Fix:** move colours to tokens.
- **DES-02 UNVERIFIED**: Playwright runs only on `Desktop Chrome` (`playwright.config.ts:91`). See section 6.
- **DES-03 UNVERIFIED**: Tests find inputs by label (`e2e/support/accounts.ts:41-42`), which suggests labelled inputs, but no accessibility scan exists. See section 6.
- **DES-04 PASS**: `src/app/layout.tsx:22-41` sets title, description, Open Graph and Twitter tags. `src/app/icon.svg`, `opengraph-image.tsx`, `robots.ts` and `sitemap.ts` exist.
- **DES-05 PASS**: Lists paginate: `src/features/tickets/lib/list.ts`, `customers.service.ts`, `audit.service.ts`, and `platform-admin/components/use-table-pagination.ts`.
- **DES-06 PARTIAL**: `AlertDialog` is used in 6 components and toasts in 47. Every destructive action was not traced. **Fix:** check that member removal, plan cancellation and ticket deletion all confirm first.
- **DES-07 PARTIAL**: The fallback brand is "ServiceDeskPro" (`src/components/shared/platform-brand.tsx:11`), while the README and `.env.example` say "ServiceDesk". The landing page tone ("Next-Gen", "2026 Helpdesk Trends") differs from the plain in-app copy. **Fix:** use one name, and match the landing page tone to the app.
- **DES-08 PARTIAL**: The name comes from env and platform settings (`src/config/site.ts`, `getCachedPlatformSettings`), and tenants can set a logo and colour (`brand-theme.tsx`). The platform logo, landing copy and fallback name are in code. **Fix:** move these into platform settings.
- **DES-09 PARTIAL**: `public/supabase-services-loader-light.gif` appears to be a third-party vendor's brand asset, used at `src/features/platform-admin/components/platform-skeletons.tsx:584`. Icons are lucide (ISC) and react-icons (MIT). **Fix:** replace the GIF with your own loader.

### ARCH: Architecture and code quality

- **ARCH-01 PASS**: Feature modules hold `services/`, `actions/` and `components/` (`src/features/*`), and route files stay thin (`README.md:427`).
- **ARCH-02 PASS**: ESLint and Prettier are configured and pass. A Husky pre-commit hook runs both.
- **ARCH-03 PASS**: `strict: true` and `tsc --noEmit` passes.
- **ARCH-04 PARTIAL**: No TODO, FIXME or `console.log` in `src` or `supabase/functions`. There are stale comments about a "coming soon" tickets page (`customer-details.tsx:527`) and an unused `comingSoon` branch (`platform-sidebar.tsx:182-200`). **Fix:** remove both.
- **ARCH-05 PARTIAL**: `.env.example` has no real values. It lists 7 variables the code never reads (`README.md:674`), misses variables the app and functions use (`PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL`, `PAYPAL_WEBHOOK_ID`, `FRONTEND_URL`), and names an unrelated real domain in an example. **Fix:** make it match `src/config/*.ts` and the functions' secrets exactly.
- **ARCH-06 N/A**: There is no public HTTP API. Mutations are Server Actions with one `ActionResult` shape, plus two small JSON route handlers.
- **ARCH-07 N/A**: Same reason. The landing page claims a REST API; that is covered under WF-11.
- **ARCH-08 FAIL**: There are 92 migrations, but they do not build a working database. Table grants are applied by hand in `scripts/e2e-stack.sh:79-84` (tracker SEC-033). The only migration that schedules reconcile uses the old auth (`README.md:673`). **Fix:** top 10 item 8.
- **ARCH-09 PARTIAL**: Migrations contain 84 `create index` statements, and every tenant table has `tenant_id`. Foreign-key index coverage and N+1 patterns were not checked query by query. **Fix:** run Supabase's index advisor on the seeded stack.
- **ARCH-10 PASS**: Email goes through the `email_jobs` queue, claimed once and retried with back-off (`README.md:331-337`, `supabase/migrations/20260925130000_email_jobs_queue.sql`). SLA ticks and reconciliation run on `pg_cron`.
- **ARCH-11 PARTIAL**: Reasons are written in the README, migration headers and code comments, but there are no decision records. **Fix:** add `docs/decisions/` with 5–6 short records (Supabase RLS, Server Actions, PayPal, Gmail, Vercel, nonce CSP).
- **ARCH-12 PARTIAL**: Mostly current (`npm outdated`: patch and minor only). Two icon libraries (`lucide-react`, `react-icons`), and a root `deno.lock`. **Fix:** update, and drop `react-icons` if one icon set covers the need.

### SEC: Security

- **SEC-01 FAIL**: Blocker 3.
- **SEC-02 PARTIAL**: Supabase Auth handles hashing (bcrypt). Minimum length is 8 with no complexity rules (`supabase/config.toml:204,213`), and `secure_password_change = true` (`:259`). Hosted settings are not in the repo. **Fix:** set `password_requirements` and check the hosted Auth settings.
- **SEC-03 PARTIAL**: 1-hour JWT with refresh-token rotation (`config.toml:184,190`), and cookies are `SameSite=Lax` and `Secure` on HTTPS (`src/lib/supabase/remember.ts:33-34`). The Supabase session cookies are not `HttpOnly` (tracker SEC-011), and removed members keep API access until the token expires (SEC-005). **Fix:** shorten the JWT lifetime, and check membership in RLS rather than only in the claims.
- **SEC-04 PASS**: Server Actions refuse foreign origins, and an e2e test proves it (`e2e/public/security.e2e.ts:127-150`). Cookies are SameSite=Lax.
- **SEC-05 PARTIAL** (re-graded 2026-11-12, on branch, not on live): Every confirmed client-side authorization hole from the tracker is closed, with tests.
  - **Migration `supabase/migrations/20261112120000_close_client_write_paths.sql`:**
    - `provision_tenant` revoked from `PUBLIC`, `anon` and `authenticated` (SEC-031).
    - `tenants_insert` and `tenants_delete` dropped (SEC-007).
    - Client writes removed from the `avatars` bucket (SEC-004) and the `invoices` bucket (SEC-008).
    - `memberships_select` and `users_select` limited to staff plus the caller's own row (SEC-029).
  - **Function check:** `reconcile-subscriptions` now refuses non-service-role callers through `supabase/functions/_shared/service-role.ts`, shared with `email-jobs` and `portal-storage-sweep` (SEC-006, tested in `src/lib/edge-service-role.test.ts`).
  - **Evidence:** `npm run test:authz` → 195 of 195 (`supabase/tests/authz/cases/10_client_write_paths.sql`). With the migration excluded, those attacks succeed. RLS is on all 31 tables.
  - **Still missing for PASS:**
    - A review of the 25 files that use the service-role client and check access in code.
    - `payment_methods` policies read any active membership, not the token's workspace.
    - Removed members keep API access until token expiry (SEC-005, see SEC-03).
    - The migrations are not yet applied to live.
- **SEC-06 PASS** (re-graded 2026-11-12, on branch, not on live): Isolation holds in the database, and a test in the repository proves it.
  - **Migration `supabase/migrations/20261112130000_tenant_consistent_references.sql`:**
    - Adds `UNIQUE (tenant_id, id)` to 9 parent tables.
    - Rebuilds 20 foreign keys as `(tenant_id, x) → (tenant_id, id)`, keeping their names and delete behaviour, so a cross-workspace reference fails with 23503 for every role, including the service role.
    - Adds `tickets_guard_assignee`, which refuses an assignee who is not active staff of the ticket's workspace (TA001).
  - **Evidence:** `npm run test:authz` → 195 of 195.
    - `cases/20_tenant_isolation.sql`: cross-workspace messages, tickets, requester and policy changes, tags, attachments, assignees and invoices are refused, while 13 legitimate flows still work, including portal requests, priority changes, the SLA tick, cascade deletes and set-null deletes.
    - `cases/30_cross_tenant_sweep.sql`: reads, updates and deletes of another workspace's rows in all 24 tables with a `tenant_id`, as tenant admin and as customer.
    - With `AUTHZ_EXCLUDE="20261112120000 20261112130000"`, 22 attacks succeed, so the suite detects the original issue.
  - **Limits:**
    - The suite runs on PostgreSQL 16 with `shim.sql` standing in for Supabase's auth, storage, cron, net and vault.
    - It exercises SQL as the API roles, not HTTP through PostgREST, the Storage API or Server Actions.
    - The browser e2e isolation tests (`e2e/signed-in/access.e2e.ts:16-40`) were not run.
- **SEC-07 PARTIAL**: Zod runs in every action, supabase-js parameterises queries, and React escapes output. Two uses of `dangerouslySetInnerHTML` were checked: JSON-LD on `src/app/page.tsx:62`, and tenant CSS whose colour is validated by regex (`src/components/shared/layout/brand-theme.tsx:17,121`). Cross-tenant IDs are now refused by the database on branch (SEC-06). Status not re-graded in this pass.
- **SEC-08 PASS**: Nonce-based CSP with `strict-dynamic` (`src/lib/csp.ts:57-73`). HSTS with preload, `X-Frame-Options`, `nosniff`, `Referrer-Policy` and `Permissions-Policy` (`next.config.ts:76-88`). Tested in `e2e/public/security.e2e.ts:9-100`. Minor: `style-src 'unsafe-inline'`.
- **SEC-09 PASS**: Pages send no CORS headers, and static files name only the site origin (`next.config.ts:57-74`). Tested in `security.e2e.ts:100-125`.
- **SEC-10 PARTIAL**: App limits on login, reset, sign-up, email and slug checks, and the portal (`src/features/auth/actions/actions.ts:54,177,216`; `register-actions.ts:29,85,106`; `portal.actions.ts:97`), plus Supabase Auth limits (`config.toml:225-237`). The tracker notes it fails open to memory and does not cover the direct Auth API (SEC-010). **Fix:** fail closed for login and reset, and turn on CAPTCHA in hosted Auth.
- **SEC-11 PARTIAL**: Attachments and invoices are in private buckets (`supabase/schemas/storage/buckets.sql:22,118`) with size limits, an extension allow-list that ignores the browser's MIME type (`src/features/tickets/lib/attachments.ts:12-14,159`), and signed, expiring links (`tickets.service.ts:1210`, `portal.service.ts:2605`). SEC-004 and SEC-008 are closed on branch (migration `20261112120000`; see SEC-05). Status not re-graded in this pass. **Fix:** confirm signed avatar uploads still work once the migration is applied (section 6), and apply it to live.
- **SEC-12 PASS**: PayPal signature is verified (`supabase/functions/paypal-webhook/index.ts:97`, `paypal.ts:37-60`). Idempotency uses a unique `paypal_event_id` and `paypal_txn_id` (`handlers.ts:857,1411-1450`).
- **SEC-13 PASS**: `npm audit --omit=dev` finds 0. The full audit has only low and moderate issues, in dev tools.
- **SEC-14 PARTIAL**: Sentry does not set `sendDefaultPii` (`src/instrumentation.ts:11-23`). The 234 `console.error` calls were not each reviewed for personal data. **Fix:** route logs through one helper that redacts emails and tokens.
- **SEC-15 PASS**: Audit triggers on `tenants`, `memberships`, `subscriptions`, `invoices`, `sla_policies`, `business_hours` and ticket priority (`supabase/schemas/functions/19_audit_log.sql` and the migrations). Service-role calls pass `x-audit-actor` (`README.md:354`).
- **SEC-16 PARTIAL**: There is no default admin: console access comes from `PLATFORM_ADMIN_EMAILS`. But every seeded account shares the password `test@123`, which is in the repository, and the e2e stack makes a seeded admin a platform admin (`e2e/support/accounts.ts:5-6`). **Fix:** make sure the demo environment's `PLATFORM_ADMIN_EMAILS` never lists a seeded account, and use a separate demo password.
- **SEC-17 PASS**: Seed people use invented names on `*.seed.test` (`scripts/seed-tenants.mjs:24-26`). See WF-04 for one company name.
- **SEC-18 UNVERIFIED**: No infrastructure code. See section 6.
- **SEC-19 UNVERIFIED**: HSTS is sent (`next.config.ts:77-79`), but the HTTP-to-HTTPS redirect is a hosting setting. See section 6.
- **SEC-20 FAIL**: The landing page claims "SSO integration" and "SAML SSO & Okta/Azure AD" (`src/app/page.tsx:251,378`). Neither exists, and MFA is off (`config.toml:333-340`; tracker SEC-015). Google sign-in does work. (Corrected 2026-11-12: the first version cited a "Security & SSO" sidebar entry, which is never rendered.) **Fix:** remove the claims, or build MFA and SSO.

### TEST: Testing

- **TEST-01 PARTIAL**: 25 unit tests cover tenancy routing, plan limits, workspace status and CSP (`src/**/*.test.ts`). The SLA engine (SQL) and billing state changes have no unit tests. **Fix:** add pgTAP or SQL tests for `17_sla_engine.sql`, and unit tests for plan-change logic.
- **TEST-02 PARTIAL**: E2E tests cover permission failures through the UI (`e2e/signed-in/access.e2e.ts`, `routes.e2e.ts`). Update 2026-11-12: an RLS authorization suite now exists (`supabase/tests/authz/`, 195 cases, see SEC-06). Status not re-graded in this pass.
- **TEST-03 PASS**: `e2e/signed-in/tickets.e2e.ts` and `portal.e2e.ts` cover the ticket and portal flows. They were not run here (see TEST-04).
- **TEST-04 FAIL**: `npm test` passes from a clean checkout. `npm run test:authz` now runs from a clean checkout (2026-11-12) with only PostgreSQL installed. The e2e suite needs Docker, the Supabase CLI and two commands. **Fix:** top 10 item 5, plus a single `npm run test:all`.
- **TEST-05 PASS**: Test data comes from `scripts/seed-tenants.mjs` and `e2e/support/db.ts`, not a real database.
- **TEST-06 FAIL**: No coverage tool is configured (no vitest config, no `coverage` script). **Fix:** add `@vitest/coverage-v8` and report coverage on auth, tenancy and billing.

### PERF: Performance

- **PERF-01 FAIL**: No recorded Core Web Vitals or Lighthouse result. **Fix:** run Lighthouse on the landing, login, tickets and portal pages, and save the results in `docs/`.
- **PERF-02 PARTIAL**: App Router splits by route. `jspdf` and `html-to-image` are imported statically into the reports page (`src/features/reports/lib/export-pdf.ts:1-2`, `reports-dashboard.tsx:35`). **Fix:** load them with `import()` when the user clicks export.
- **PERF-03 PASS**: No raw `<img>` tags. `next/image` is used in 4 places, and remote images are pinned to project storage (`next.config.ts:15-36`).
- **PERF-04 UNVERIFIED**: Next emits hashed `_next/static` files, and the hosting CDN serves them. See section 6.
- **PERF-05 PARTIAL**: At 10 requests/s, p95 was 61 ms for staff and 74 ms for the portal, with 0% errors. That was on a local stack (`docs/load-testing/k6-results-2026-11-05.md`). The spike run had 21.6% failures, and the document says the runs should be repeated. **Fix:** repeat against the deployed demo.
- **PERF-06 PARTIAL**: Main lists paginate (see DES-05), and there are 52 `.range`/`.limit` calls in services. Not every list query was checked.
- **PERF-07 PASS**: Platform settings are cached (`getCachedPlatformSettings`), the maintenance status is cached about 10 s per instance with documented staleness (`README.md:347`), and there are 4 cache-tag uses.
- **PERF-08 UNVERIFIED**: The app talks to Postgres through Supabase's HTTP API, so pool size is a hosted setting. See section 6.
- **PERF-09 PASS**: `load/servicedesk.js`, `scripts/load-test.sh`, and a dated result with load level, p95 and error rate (`docs/load-testing/k6-results-2026-11-05.md`).

### OPS: Reliability and observability

- **OPS-01 FAIL**: No health or readiness endpoint. `/platform/health` is an admin page, and `/api/workspace-status` reports workspace blocks only. **Fix:** add `/api/health`, which pings the database and Auth.
- **OPS-02 FAIL**: Logs are plain `console.error` strings (234 calls) with no request ID. **Fix:** a JSON logger with a request ID set in `src/proxy.ts`.
- **OPS-03 PARTIAL**: Sentry is wired for server and client (`src/instrumentation.ts`, `instrumentation-client.ts`, `next.config.ts:118-128`). Edge Functions do not report to Sentry. Alert rules are not in the repo. LOAD-001 failures are silent. **Fix:** add Sentry to Edge Functions and record the alert rules.
- **OPS-04 UNVERIFIED**: No uptime monitor is defined in the repo. See section 6.
- **OPS-05 PARTIAL**: Gmail and platform calls have timeouts (`supabase/functions/_shared/gmail.ts:191,298`; `platform-observability.service.ts:161,563`). PayPal calls have none (`_shared/paypal-auth.ts:32`, `_shared/paypal-subscriptions.ts:202,243`). Email retries with back-off. **Fix:** add `AbortSignal.timeout` and a retry to the PayPal calls.
- **OPS-06 PARTIAL**: Failed email jobs go back to `pending` (`README.md:337`). It was not shown that a job claimed by a crashed run is freed again. The app runs serverless. **Fix:** confirm that `claim_email_jobs` reclaims stale claims.
- **OPS-07 FAIL**: No backup or restore procedure is documented, and none has been tried. **Fix:** document the Supabase backup level and PITR, and run one restore into a scratch project.

### DEP: Deployment and infrastructure

- **DEP-01 FAIL**: No Dockerfile. The app deploys to Vercel (`README.md:66`). **Fix:** add a multi-stage, non-root Dockerfile (Next `output: "standalone"`), or record Vercel as a deliberate decision.
- **DEP-02 PARTIAL**: `npm run e2e:stack` starts the database and seed in one command (`scripts/e2e-stack.sh`), but local development takes the five manual steps in `README.md:76-105`. **Fix:** add `npm run dev:all`.
- **DEP-03 FAIL**: No infrastructure code. `README.md:608-620` lists 11 manual console steps.
- **DEP-04 FAIL**: No infrastructure modules, so no low-cost or production profiles.
- **DEP-05 FAIL**: No low-cost profile defined.
- **DEP-06 FAIL**: No teardown command.
- **DEP-07 FAIL**: No resource tags or budget alert in the repo.
- **DEP-08 FAIL**: No infrastructure state.
- **DEP-09 FAIL**: Migrations are pushed by hand from a laptop (`README.md:598-602`).
- **DEP-10 FAIL**: No rollback procedure. "There are no down migrations" (`README.md:378`).
- **DEP-11 UNVERIFIED**: See section 6.
- **DEP-12 PARTIAL**: Configuration comes from env, but the live database has grants and a cron job the repo does not record (`README.md:673`, tracker SEC-033). **Fix:** top 10 item 8.
- **DEP-13 PASS**: No company name in tracked files (case-insensitive `git grep`). Names are generic (`servicedesk-ui`, `seed-*`). Note: `README.md:544` links to a personal Argos account; move it to a shared one.

### CI: Continuous integration and delivery

- **CI-01 FAIL**: No pipeline: there is no `.github/` and no other CI config. Only a local Husky hook runs format and tests (`README.md:431`).
- **CI-02 FAIL**: No dependency or secret scanning in CI.
- **CI-03 UNVERIFIED**: See section 6.
- **CI-04 PARTIAL**: The app deploys on push through Vercel's Git integration ("depending on the project's settings", `README.md:604`). The database and functions are deployed from a laptop.
- **CI-05 FAIL**: No pipeline, so no OIDC.
- **CI-06 FAIL**: No pipeline to cache.
- **CI-07 FAIL**: There are no tags (`git tag` is empty), the version is fixed at `0.1.0`, and the deployed version is not shown anywhere.
- **CI-08 FAIL**: No infrastructure plan step (see DEP-03).
- **CI-09 FAIL**: No Dependabot or Renovate config.

### AI: AI features

- **AI-01 to AI-07 N/A**: The code has no AI features (no AI provider SDK or calls in `src` or `supabase/functions`). The landing page claims AI features anyway; see WF-11.

### DOC: Documentation and showcase assets

- **DOC-01 PARTIAL**: The README covers the problem, features, architecture diagram, quick start and environment variables (`README.md:1-160,227-242`). It has no screenshots. **Fix:** add 3–4 screenshots.
- **DOC-02 PARTIAL**: The steps are thorough, but `.env.example` is out of step with the code (ARCH-05). A full run from the README alone was not tried.
- **DOC-03 PASS**: The Mermaid diagram (`README.md:227-242`) matches the code: proxy, Server Actions, RLS and service-role paths, Edge Functions, pg_cron, PayPal webhook, Gmail and Sentry.
- **DOC-04 FAIL**: No case study.
- **DOC-05 PARTIAL**: The load test is saved with a date. There are no page-speed results.
- **DOC-06 FAIL**: No demo video or guided demo script.
- **DOC-07 FAIL**: The README is honest, but the public landing page presents a live SaaS with AI features that don't exist and pricing that doesn't match the plans. No claim of a named client was found.
- **DOC-08 FAIL**: No LICENSE file and no third-party notice.
- **DOC-09 FAIL**: No privacy or terms pages. Sentry and session cookies are not disclosed.

## 6. To verify by hand

| Item    | How to check                                                                                                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DES-02  | Open the landing page, login, tickets list, a ticket, and a portal request in Chrome DevTools at 375, 768 and 1280 px. Check for horizontal scroll (`document.documentElement.scrollWidth > innerWidth`) and overlapping elements.                     |
| DES-03  | Run Lighthouse (Accessibility) or the axe DevTools extension on the same pages, aiming for no serious issues. Tab through the login and new-ticket forms with the keyboard only, and confirm the focus ring is visible.                                |
| SEC-18  | In the Supabase dashboard, check that the management token is project-scoped and has only Logs read. In Vercel, check that no long-lived tokens are in env vars beyond the documented ones. Confirm that no personal access token is used for deploys. |
| SEC-19  | `curl -sI http://<demo-domain>/` should return 301/308 to `https://`. `curl -sI https://<demo-domain>/` should include `strict-transport-security`.                                                                                                    |
| PERF-04 | `curl -sI https://<demo-domain>/_next/static/<any chunk>.js` should show `cache-control: public, max-age=31536000, immutable` and a CDN cache header (`x-vercel-cache: HIT` on the second request).                                                    |
| PERF-08 | Supabase dashboard → Database → Connection pooling: note the pool size and plan limits. Compare with the Auth connection churn noted in LOAD-002.                                                                                                      |
| OPS-04  | Check whether an uptime monitor (for example Better Stack or UptimeRobot) pings the demo URL and alerts someone. Record it in the README.                                                                                                              |
| DEP-11  | Open the demo URL. Confirm it is a custom domain, not `*.vercel.app`, and that the certificate is valid and not close to expiry (browser padlock, or `openssl s_client -connect <domain>:443`).                                                        |
| CI-03   | GitHub → Settings → Branches (or Rules) → `main`: confirm pull requests, at least one review and passing status checks are required. Or run `gh api repos/<owner>/<repo>/branches/main/protection`.                                                    |

**Apply the 2026-11-12 fixes (SEC-05, SEC-06) to live.** These steps change the hosted project, so a person must run them:

1. `supabase migration list`, then `supabase db push`. Watch for a `WARNING: Existing rows cross workspaces` from `20261112130000`. Any such constraint stays `NOT VALID`, which means existing cross-workspace rows were found and should be investigated (`select conrelid::regclass, conname from pg_constraint where contype = 'f' and not convalidated;`).
2. Deploy `reconcile-subscriptions`, `email-jobs` and `portal-storage-sweep`. Confirm that the reconcile cron still succeeds (`cron.job_run_details`) and that it sends the service-role key as a bearer token.
3. In the app, upload a staff avatar and a portal avatar to confirm that signed upload URLs work without the removed avatar policies. Assign a ticket. Sign in as a customer, and confirm the portal still shows agent names.
4. Regenerate `src/lib/supabase/database.types.ts` (`supabase gen types typescript`) so the relationship metadata shows the composite keys.

Also confirm by hand, though not a checklist item: that the old cron secret (starts `4da9`) is not set as any function secret or Vault secret, and that tracker items SEC-002, SEC-003 and SEC-030 (fixed in migration `20261104120000`) have been applied to the live database.

## 7. Project profile

- **What it is:** A multi-tenant customer-support help desk. Each workspace gets a staff app for tickets and SLAs, plus a branded portal where its customers raise and follow requests. Platform admins run the whole service from a separate console.
- **Main demo flow:** Sign in as a workspace admin or agent → ticket queue → open a ticket, reply, change priority and watch the SLA clock → the customer sees the reply in the portal. Secondary: reports, SLA policies, branding, team, billing.
- **Roles:** `tenant_admin` (one is the owner), `manager`, `agent`, `billing_admin`, `customer` (portal only), and platform admin (env allow-list).
- **Applications:** One Next.js 16 app (App Router, React 19, React Compiler, TypeScript, Tailwind 4, shadcn/Radix), with all request handling in `src/proxy.ts`. Six Supabase Edge Functions on Deno: subscription, update-payment-method, paypal-webhook, reconcile-subscriptions, email-jobs, portal-storage-sweep.
- **Data and integrations:** Supabase Postgres with RLS, Auth (password and Google), Storage (4 buckets), Realtime, `pg_cron`, and a Postgres-based queue for email. No separate cache or queue service. PayPal subscriptions, Gmail API for app email, Supabase Auth SMTP, Sentry, and Argos for visual tests.
- **Running locally:** `npm install`, `supabase start`, copy keys into `.env.local`, `npm run dev`.
- **Testing:** Vitest unit tests, Playwright e2e on an isolated Supabase stack (`npm run e2e:stack`), Argos visual tests, and k6 load tests. The SQL authz suite is referenced but missing.
- **CI and deploy:** No CI. The app is on Vercel (Git integration). The database and functions are deployed by hand with the Supabase CLI.
- **AI features:** None in the code. The landing page claims some.
- **Scope:** The whole product is in this repository: frontend, backend functions and database schema.
