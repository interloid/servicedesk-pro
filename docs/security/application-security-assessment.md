# ServiceDesk SaaS: Application Security Assessment

| Field           | Value                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| Assessment date | 2026-11-04                                                                   |
| Document status | Draft for review. Not a penetration test report or a security certification  |
| Code baseline   | Branch `develop`, commit `ec4b56a`                                           |
| Target          | https://servicedesk-ui.vercel.app                                            |
| Final status    | **Not complete.** See [Final assessment status](#15-final-assessment-status) |

Related documents: [Security architecture](security-architecture.md) · [OWASP ZAP findings](owasp-zap-findings.md) · [Authentication and authorization tests](authentication-authorization-tests.md) · [Tenant isolation tests](tenant-isolation-tests.md) · [Remediation tracker](security-remediation-tracker.md) · [Testing methodology](security-testing-methodology.md)

**How to read the evidence labels in this package**

| Label                       | Meaning                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Verified by code inspection | Read in the repository. Says what the code does, not what the live system does                                           |
| Verified by executed test   | A test or scanner ran and its output was reviewed                                                                        |
| Partially verified          | Some of the area has evidence, and the gaps are stated                                                                   |
| Not verified                | No usable evidence. This is never treated as a pass                                                                      |
| Provisional severity        | Assessor's estimate from code alone. It becomes final after the retest in the [tracker](security-remediation-tracker.md) |

---

## 1. Executive summary

ServiceDesk has a substantial set of security controls in code: Row Level Security on all 30 application tables, a signed-token tenant model, verified PayPal webhooks, audit logging and privacy-limited error reporting. Scanner testing found no High-risk alert and no injection alert. That testing was unauthenticated, so it says nothing about what happens after sign-in, which is where most of this application's risk sits.

**Nothing in this assessment shows that tenant isolation or role enforcement works on the live system.** No authenticated test has been run. The live database was read only through queries the project owner ran on 2026-11-04 ([results](security-remediation-tracker.md#live-check-2026-11-04)).

The main points for decision makers:

1. **Code inspection found database rules that appear to allow privilege escalation and cross-tenant access through the direct API.** A Manager appears able to create a Tenant Admin ([SEC-002](#sec-002)). A Tenant Admin appears able to attach a user from another workspace and then edit or delete that user's profile ([SEC-003](#sec-003)). Neither has been executed, so both are provisional.
2. **The fix for the most serious earlier billing issue is on live, but untested.** The 2026-11-03 code review records that workspace admins could grant themselves paid plans. Its migration, policies and trigger were confirmed on live on 2026-11-04, and the retest has not been run ([SEC-001](#sec-001)). The rules behind SEC-002, 003, 004, 007 and 008 were also confirmed as live.
3. **The 12 ZAP alerts are mostly not vulnerabilities.** Two lead to real work: the Content Security Policy is not enforced ([SEC-013](owasp-zap-findings.md#sec-013)), and sign-in forms can send passwords in the URL if submitted before the page finishes loading ([SEC-014](owasp-zap-findings.md#sec-014)).
4. **An active scan ran against production on 2026-11-04.** The ZAP log shows 2,190 attack requests with 0 alerts ([SEC-020](#sec-020)). The reports are labelled passive, so this should be understood before they are shared, and production data should be checked for scanner side effects.
5. **The Snyk report was not available.** A [placeholder](security-testing-methodology.md#snyk-evidence-placeholder) marks the gap.

| Register totals                                                  | Count |
| ---------------------------------------------------------------- | ----- |
| Confirmed findings                                               | 7     |
| Potential, needing verification                                  | 13    |
| Fixed on live, awaiting retest (SEC-001)                         | 1     |
| Process finding (SEC-020)                                        | 1     |
| ZAP alerts dispositioned as false positive or still under review | 8     |
| Total stable IDs (SEC-001 to 030)                                | 30    |

---

## 2. Application overview

ServiceDesk is a multi-tenant help desk. Workspaces (tenants) hold tickets, customers, SLA policies, reports and subscription billing. Staff use the tenant application, end customers use a per-workspace portal, and platform operators use a separate console at `/platform`.

## 3. Technology stack

| Layer            | Technology                                                           | Evidence                                              |
| ---------------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| Web application  | Next.js 16.4.2 App Router, React 19.2.8, TypeScript                  | `package.json`, `node_modules/next`                   |
| UI               | Tailwind CSS 4, shadcn/ui, Radix                                     | `package.json`, `components.json`                     |
| Authentication   | Supabase Auth through `@supabase/ssr`; password, magic link, Google  | `src/lib/supabase/`, `auth.service.ts`                |
| Database         | PostgreSQL with RLS, 89 migrations                                   | `supabase/migrations/`, `supabase/schemas/`           |
| Background work  | pg_cron, pg_net, Deno Edge Functions                                 | `supabase/functions/`, `supabase/config.toml`         |
| Payments         | PayPal Subscriptions and Orders                                      | `supabase/functions/paypal-webhook/`, `subscription/` |
| Email            | Queue in `email_jobs`, sent through the Gmail API                    | `supabase/functions/_shared/gmail.ts`                 |
| Hosting          | Vercel                                                               | Response headers in the ZAP evidence                  |
| Monitoring       | Sentry `@sentry/nextjs` v11                                          | `src/instrumentation*.ts`, `src/config/sentry.ts`     |
| Security testing | OWASP ZAP 2.17.0, HostedScan, `npm audit`. Snyk evidence unavailable | [Section 8](#8-tools-used-and-testing-status)         |

## 4. Architecture and trust boundaries

Full detail and diagrams are in [Security architecture](security-architecture.md).

| Boundary                           | What must hold                                                      |
| ---------------------------------- | ------------------------------------------------------------------- |
| Browser to Next.js                 | Session validated, role and tenant checked on the server            |
| Browser directly to Supabase       | The anon key is public, so **RLS is the only control** on this path |
| Next.js to database (service role) | RLS is bypassed, so application code must check authorization first |
| Tenant to tenant                   | Every row and storage object scoped by the signed `tenant_id` claim |
| PayPal to webhook                  | Signature verified before any state change                          |
| pg_cron to Edge Functions          | Bearer token and gateway JWT verification                           |
| Platform console to all tenants    | Allowlisted, verified email before any service-role read            |

## 5. Assessment scope

**In scope:** repository code and configuration at `ec4b56a`, database migrations and policies, Edge Functions, the supplied ZAP reports and screenshots, earlier reviews in `docs/reviews/`.

**Out of scope or not reachable:** live Supabase configuration and data, Vercel and PayPal dashboards, Google OAuth internals, infrastructure owned by Vercel and Supabase.

**What this assessment did not do:** it sent no requests to the production site, did not modify application code, and did not open `.env.local`.

## 6. Security controls identified in the codebase

All rows are **verified by code inspection** unless marked. None has been verified on the live system.

| Control                 | Implementation                                                                                                                             | Location                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| RLS coverage            | Enabled on all 30 tables. Queue and limiter tables have no policies, so they are service-role only                                         | `supabase/migrations/`                                     |
| Tenant scoping          | Policies compare `tenant_id` with the signed JWT claim set by the access token hook                                                        | `supabase/schemas/functions/01, 03`                        |
| Blocked workspaces      | Restrictive `workspace_not_blocked` policy on tenant tables and storage                                                                    | `supabase/schemas/policies/30_workspace_block.sql`         |
| Route protection        | Proxy validates the user with `getUser()` and applies tenant, role, maintenance and block gates                                            | `src/proxy.ts`                                             |
| Spoofed header defence  | `x-tenant-slug` is deleted from incoming requests                                                                                          | `src/proxy.ts:243`                                         |
| Platform console gate   | Allowlisted and confirmed email, enforced in layout, each page and each action                                                             | `platform-access.ts`, `src/app/platform/`                  |
| Service-role isolation  | `server-only` client; services apply role checks such as `requireActor`, `assertRole`, `assertCanManageSla` (spot-checked, not exhaustive) | `src/lib/supabase/admin.ts`, feature services              |
| Webhook verification    | PayPal verification API called before parsing the event. Body size limit                                                                   | `paypal-webhook/index.ts`, `paypal.ts`                     |
| Webhook idempotency     | Unique `paypal_txn_id`, partial unique index on `paypal_event_id`, duplicate handling                                                      | `paypal-webhook/handlers.ts`                               |
| Billing authorization   | Edge Functions validate the user and require `tenant_admin` or `billing_admin`                                                             | `subscription/index.ts`, `update-payment-method/index.ts`  |
| Open redirect defence   | `isSafeInternalPath` rejects `//`, backslashes and control characters. Callback uses fixed error codes                                     | `src/lib/tenancy.ts:318`, `src/app/auth/callback/route.ts` |
| Host header defence     | Auth links built only from trusted hosts                                                                                                   | `auth.service.ts:239`                                      |
| Search filter safety    | Search terms quoted and escaped for PostgREST                                                                                              | `src/lib/postgrest.ts`                                     |
| XSS sinks               | Only two `dangerouslySetInnerHTML` uses. Linkifier allows only http and https. Email templates escape                                      | `brand-theme.tsx`, `layout.tsx`, `email-jobs/`             |
| Upload restrictions     | Avatars and branding buckets limit image types and size. Attachments bucket limits size and is private                                     | `supabase/schemas/storage/buckets.sql`                     |
| Security headers        | HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy. CSP is report-only (**verified by scanner response**)                 | `next.config.ts`                                           |
| Rate limiting           | Login, password reset, signup, email and slug checks, portal actions. Postgres-backed with memory fallback                                 | `src/lib/rate-limit.ts`                                    |
| Audit trail             | Trigger-written audit log. `x-audit-actor` trusted on service-role requests only                                                           | `supabase/schemas/functions/19_audit_log.sql`              |
| Error reporting privacy | Sentry told not to collect users, cookies, headers, bodies or query strings                                                                | `src/config/sentry.ts`                                     |
| Secret handling         | `.env.local` is git-ignored and never committed. Pattern search of tracked files found no live credentials (**executed**)                  | `.gitignore`, `git grep`                                   |
| SECURITY DEFINER        | All 71 functions found set `search_path`. Most have explicit grants. A regex review, not a proof                                           | `supabase/migrations/`                                     |

## 7. Testing methodology

See [Security testing methodology](security-testing-methodology.md). In summary: code inspection, scanner report review, two local commands, and no authenticated or exploit testing.

## 8. Tools used and testing status

| Tool or activity                   | Status                                     | Result                                                                                                                          |
| ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| HostedScan passive ZAP, 2026-11-03 | Executed by the team, reviewed             | 2 Medium, 3 Low                                                                                                                 |
| ZAP report PDF, 2026-11-03         | Executed by the team, reviewed             | 2 Medium, 3 Low, 5 Informational, no High                                                                                       |
| ZAP desktop passive, 2026-11-04    | Executed by the team, screenshots reviewed | 2 Medium, 3 Low, 7 Informational, no High                                                                                       |
| ZAP desktop **active**, 2026-11-04 | Executed by the team, log reviewed         | 15 rules, 2,190 requests, 0 alerts, unauthenticated                                                                             |
| ZAP Client Spider                  | **Failed**                                 | Browser would not start, so JavaScript-driven pages were not explored                                                           |
| `npm audit --omit=dev`             | Run for this assessment                    | 0 vulnerabilities in production npm packages on 2026-11-04. Deno imports are not covered                                        |
| `npm test`                         | Run for this assessment                    | 2 files, 20 tests passed. None test RLS or authorization against a database                                                     |
| Snyk                               | **Evidence unavailable**                   | No report in the repository or on the workstation. [Placeholder](security-testing-methodology.md#snyk-evidence-placeholder)     |
| Authenticated DAST                 | Not run                                    | No authenticated session in any scan                                                                                            |
| Authorization and tenant tests     | Not run                                    | Plans written, 1 anonymous observation recorded                                                                                 |
| Live database and advisors         | **Partial**                                | The Supabase connector is still denied. The owner ran read-only SQL on 2026-11-04. Advisors and Edge Function settings not read |

---

## 9. Confirmed findings

Confirmed means the defect or gap is shown by code or by scanner response. Severity reflects impact on this application. Items from ZAP have their full record in the [ZAP findings](owasp-zap-findings.md) and are listed here by link only.

| ID                                       | Title                                                     | Final severity       | Evidence                         |
| ---------------------------------------- | --------------------------------------------------------- | -------------------- | -------------------------------- |
| [SEC-013](owasp-zap-findings.md#sec-013) | Content Security Policy not enforced                      | Medium               | Scanner, code                    |
| [SEC-014](owasp-zap-findings.md#sec-014) | Sign-in forms can send credentials in the URL             | Medium (provisional) | Scanner, code. User path not run |
| [SEC-015](#sec-015)                      | No multi-factor authentication, including platform admins | Medium               | Code                             |
| [SEC-016](#sec-016)                      | No automated authorization or RLS regression tests        | Low                  | Executed, code                   |
| [SEC-017](#sec-017)                      | Public actions reveal registered emails                   | Low                  | Earlier review                   |
| [SEC-018](owasp-zap-findings.md#sec-018) | `X-Powered-By` header exposed                             | Informational        | Scanner, code                    |
| [SEC-019](owasp-zap-findings.md#sec-019) | `sd_tenant` cookie lacks HttpOnly                         | Informational        | Scanner, code                    |

Also recorded as a process issue: [SEC-020](#sec-020), active scan against production.

<a id="sec-015"></a>

### SEC-015: No multi-factor authentication

- **Evidence:** a search of `src/` finds no use of `auth.mfa` or assurance levels. Platform access needs only an allowlisted, confirmed email (`platform-access.ts:44`).
- **Impact:** one stolen password for a platform admin gives read access to every workspace and the ability to block them. Tenant Admins can reach billing and all tenant data.
- **Recommendation:** require MFA for platform admins first, then offer it to Tenant Admins and Billing Admins. Move the allowlist from email addresses to user IDs, as the 2026-11-03 review also advised.
- **Retest:** [PLAT-05](authentication-authorization-tests.md#platform-administrator-permissions).

<a id="sec-016"></a>

### SEC-016: No automated authorization or RLS regression tests

- **Evidence:** `npm test` runs 20 tests in `src/lib/tenancy.test.ts` and `workspace-status.test.ts`. No test runs a policy against a database. `@electric-sql/pglite` is installed but nothing in `src`, `supabase` or `scripts` uses it. No CI configuration exists in the repository. The 2026-11-03 review records "31 tests added", but 20 run today.
- **Impact:** SEC-002 and SEC-003 are the kind of defect a role test would catch, and a future policy change could reopen any of them unnoticed.
- **Recommendation:** automate the [tenant isolation](tenant-isolation-tests.md) and [authorization](authentication-authorization-tests.md) plans against a local Supabase stack, and run them before merge.

<a id="sec-017"></a>

### SEC-017: Public actions reveal registered emails

- **Evidence:** RISK-014 in `docs/reviews/code-review-2026-11-03.md`, marked Partial: hourly limits were tightened and the check was kept in signup. Not re-tested here.
- **Impact:** an attacker can test whether an address has an account, which helps targeted phishing and password attacks.
- **Recommendation:** decide whether to keep the behaviour. If kept, record it as an accepted risk with the rate limit as the mitigation.

<a id="sec-020"></a>

### SEC-020: Active scan ran against production

- **Evidence:** `~/.ZAP/zap.log` records `ZAP-QuickStart-AttackThread` "Attacking https://servicedesk-ui.vercel.app" at 2026-11-04 11:27:44 IST (05:57:44 UTC). It completed in 121.755 seconds over 78 nodes, with rules for SQL injection, command injection, path traversal, XSS and others. Per-rule message counts total 2,190. 0 alerts were raised.
- **Impact:** low, as the scan was short and unauthenticated. It may still have left log noise, Sentry events, rate limit rows or test records. It also means the "passive" label does not describe all the evidence.
- **Recommendation:** check Vercel, Sentry and Supabase for the window 05:57 to 06:00 UTC on 2026-11-04. Search for test values such as `zaproxy@example.com` and `foo-bar@example.com`. Use a non-production target from now on, per the [production testing rules](security-testing-methodology.md#rules-for-production-testing).
- **Note:** this records what the log shows. It does not assess intent. ZAP's Quick Start "Automated Scan" includes an active scan by default.

---

## 10. Potential findings requiring manual verification

Each of these is a **verified code-level observation whose runtime effect has not been executed**. Live behaviour may differ if the live database has drifted from the repository. All severities are provisional.

| ID                  | Title                                                          | Provisional severity | Retest                                                                               |
| ------------------- | -------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| [SEC-001](#sec-001) | Billing lockdown and other hardening: on live, retest pending  | High                 | [PRIV-05 to 07](authentication-authorization-tests.md#privilege-escalation-attempts) |
| [SEC-002](#sec-002) | Manager can create a Tenant Admin through the direct API       | High                 | [PRIV-01](authentication-authorization-tests.md#privilege-escalation-attempts)       |
| [SEC-003](#sec-003) | Membership insert reaches users in other tenants               | High                 | [TEN-14](tenant-isolation-tests.md#database-rls-enforcement)                         |
| [SEC-004](#sec-004) | Avatar storage trusts user-editable metadata                   | Medium               | [TEN-20](tenant-isolation-tests.md#storage-policy-enforcement)                       |
| [SEC-005](#sec-005) | Removed members keep API access until their token expires      | Medium               | [SESS-04](authentication-authorization-tests.md#session-expiration-and-revocation)   |
| [SEC-006](#sec-006) | Billing reconciliation has no role check of its own            | Medium               | [API-05](authentication-authorization-tests.md#direct-api-authorization)             |
| [SEC-007](#sec-007) | Tenant Admin can insert and delete `tenants` rows directly     | Medium               | [PRIV-08](authentication-authorization-tests.md#privilege-escalation-attempts)       |
| [SEC-008](#sec-008) | Invoice PDFs can be overwritten through the storage API        | Low                  | [TEN-22](tenant-isolation-tests.md#storage-policy-enforcement)                       |
| [SEC-009](#sec-009) | Live `verify_jwt` settings on Edge Functions not confirmed     | Medium               | [API-06](authentication-authorization-tests.md#direct-api-authorization)             |
| [SEC-010](#sec-010) | Rate limits can fail open and do not cover the direct Auth API | Medium               | [AUTH-07](authentication-authorization-tests.md#login-and-logout)                    |
| [SEC-011](#sec-011) | Session tokens are readable by JavaScript for up to 30 days    | Low                  | [SESS-03](authentication-authorization-tests.md#session-expiration-and-revocation)   |
| [SEC-012](#sec-012) | Sandbox and production PayPal separation not enforced in code  | Not assigned         | Dashboard and secret review                                                          |
| [SEC-029](#sec-029) | Customers can read all workspace members                       | Medium               | [API-02](authentication-authorization-tests.md#direct-api-authorization)             |
| [SEC-030](#sec-030) | Removed member can re-grant access with an unexpired token     | Medium               | [PRIV-12](authentication-authorization-tests.md#privilege-escalation-attempts)       |

<a id="sec-001"></a>

### SEC-001: Billing lockdown and other hardening: on live, retest pending

- **Observation:** RISK-001 in `docs/reviews/code-review-2026-11-03.md` showed in a local Postgres test that a Tenant Admin could set the plan to Business, raise seats and mark an invoice paid. The fix is migration `20261103160000_review_hardening.sql`, and the review's tracker says "Apply migration on live". The workspace-blocking and shared rate limit migrations carry similar notes.
- **Live check, 2026-11-04:** the migration is recorded, `subscriptions` and `invoices` have no client write policies, and `tenants_guard_block` is enabled. All 89 repository migrations are recorded on live. See the [results](security-remediation-tracker.md#live-check-2026-11-04).
- **Still open:** PRIV-05 to 07 have not been run, so the fix is not retested. `tenants_insert` can still set `plan_id` ([SEC-007](#sec-007)).
- **Impact if the retest fails:** free use of paid plans and untrustworthy billing records.

<a id="sec-002"></a>

### SEC-002: Manager can create a Tenant Admin through the direct API

- **Observation:** `memberships_insert` checks only the caller's tenant and that the caller is `tenant_admin` or `manager`. It does not restrict the `role` or `user_id` being inserted (`20260810045832_initial_schema.sql:583`, `supabase/schemas/policies/04_memberships.sql`). `memberships_update` correctly requires Tenant Admin in its `WITH CHECK`. The insert triggers only block `is_primary` and enforce seat limits. No later migration changes this policy.
- **Why not confirmed:** not executed. The app's own team service has role checks, but they do not apply to direct PostgREST calls using the public anon key and the user's token.
- **Likely path:** a Manager inserts `{user_id: <second account>, role: 'tenant_admin', status: 'active'}`. The second account's next token then carries Tenant Admin for that workspace.
- **Impact:** privilege escalation inside the workspace, including billing and deleting team members.
- **Recommendation:** remove Manager from direct insert if the service-role path covers invites, or add a `WITH CHECK` restricting `role` to values the caller may grant.

<a id="sec-003"></a>

### SEC-003: Membership insert reaches users in other tenants

- **Observation:** `memberships_insert` accepts any `user_id`, with no check that the person agreed or belongs to the workspace. `users_select`, `users_update` and `users_delete` then grant access based on having a membership in the caller's tenant (`supabase/schemas/policies/03_users.sql`).
- **Likely path:** a Tenant Admin who knows another user's UUID inserts an active membership, can then read that user's profile, change columns not blocked by `guard_users_profile_columns` (which protects only email and avatar), and delete the global `public.users` row. Deleting it cascades to that user's memberships in **all** workspaces. The owner guard in `protect_primary_membership` appears to allow this once the user row is gone.
- **Limit on exploitability:** the attacker needs the victim's UUID. UUIDs are not listed publicly, though avatar paths include a user ID.
- **Impact:** this crosses the tenant boundary, so it is prioritised even with the UUID precondition.
- **Recommendation:** require invites through the service role with acceptance. Remove `users_delete` for tenant admins, and limit `users_update` to the user's own row.

<a id="sec-004"></a>

### SEC-004: Avatar storage trusts user-editable metadata

- **Observation:** `avatars_insert`, `avatars_update` and `avatars_delete` accept the folder if it matches the signed `tenant_id` claim **or** `auth.jwt() -> 'user_metadata' ->> 'tenant_id'` (`supabase/schemas/policies/storage/avatars.sql`). Users can change their own `user_metadata` through the Auth API. The hook does not overwrite it. Tenant UUIDs are returned by the public `get_tenant_by_slug` function.
- **Likely path:** any signed-in user sets `user_metadata.tenant_id` to a target workspace, refreshes the session, then writes to or deletes from that workspace's avatar folder.
- **Also:** within a workspace the policies check the tenant folder only, so a customer could overwrite a colleague's or staff member's avatar.
- **Impact:** cross-tenant tampering with public images, including legacy logos stored under this bucket (`branding.service.ts:270`). Bucket type limits reduce the risk of active content.
- **Recommendation:** drop the `user_metadata` branch, and scope writes to the user's own folder.

<a id="sec-005"></a>

### SEC-005: Removed members keep API access until their token expires

- **Observation:** policies on `tickets`, `ticket_messages`, `customers` and others read the role only from JWT claims. `is_active_membership()` is used on attachments, storage and `users`, not on these tables. RISK-005 in the 2026-11-03 review refreshes the token inside the app, which does not stop a caller using a saved token against the API.
- **Exposure window:** one access token lifetime. `jwt_expiry = 3600` in local `config.toml`, and the live value is unknown.
- **Impact:** a disabled agent could read and change tenant tickets for up to that window.
- **Recommendation:** extend the restrictive policy pattern in `30_workspace_block.sql` to check active membership, after reviewing query cost.

<a id="sec-006"></a>

### SEC-006: Billing reconciliation has no role check of its own

- **Observation:** `reconcile-subscriptions/index.ts:788` states there is no secret check because the gateway verifies the JWT. Gateway verification only proves a token is validly signed, and any signed-in user's token qualifies. Depending on key format, the public anon key may too. `email-jobs` and `portal-storage-sweep` do check `role = service_role`, so this function is the exception.
- **Limit on exploitability:** the function's own comments describe its steps as idempotent and it acts on due items, so a caller should only be able to run the job early or repeatedly. That has not been tested. Live already runs a job with this name pattern every minute, not hourly as the repository schedules it ([drift](security-remediation-tracker.md#live-check-2026-11-04)).
- **Impact:** unwanted load, PayPal API use and billing changes applied at attacker-chosen times.
- **Recommendation:** add the same `isServiceRole` check used by `email-jobs`.

<a id="sec-007"></a>

### SEC-007: Tenant Admin can insert and delete `tenants` rows directly

- **Observation:** `tenants_insert` requires only that the caller is a Tenant Admin. `tenants_delete` lets them delete their own workspace. `tenants_guard_block` runs on update only. No application code deletes tenants.
- **Impact:** deleting through the API would remove workspace data without the app's flow and without cancelling the PayPal agreement. Insert could reserve slugs or create rows with an arbitrary `plan_id`.
- **Recommendation:** remove both policies if provisioning and deletion run through the service role, which `provision_tenant` already does.

<a id="sec-008"></a>

### SEC-008: Invoice PDFs can be overwritten through the storage API

- **Observation:** migration `20261103160000` removed client writes to the `invoices` table. The `invoices` storage bucket still has `invoices_insert` and `invoices_update` for Tenant Admin or Billing Admin, and `invoices_delete` for Tenant Admin, in their own folder (live text confirmed 2026-11-04). The webhook writes PDFs with the service role.
- **Impact:** a workspace admin could replace their own invoice PDFs. No cross-tenant path was found. Low, but it undermines invoice integrity.
- **Recommendation:** make the bucket write-only for the service role.

<a id="sec-009"></a>

### SEC-009: Live `verify_jwt` settings on Edge Functions not confirmed

- **Observation:** `email-jobs` and `portal-storage-sweep` decode the JWT payload without checking the signature and rely on the gateway to have done so. `config.toml` sets `verify_jwt = true`, but a deploy with `--no-verify-jwt` overrides it.
- **Impact if misconfigured:** anyone could forge a `service_role` payload and trigger mail sending or a storage delete.
- **Action:** confirm the setting per function in the Supabase dashboard. Consider verifying the signature in code as well.

<a id="sec-010"></a>

### SEC-010: Rate limits can fail open and do not cover the direct Auth API

- **Observation:** `src/lib/rate-limit.ts` falls back to a per-instance memory counter when the RPC fails or its migration is missing, by design so an outage does not lock everyone out. The limiter also protects Server Actions only. The anon key is public, so a caller can post directly to Supabase Auth.
- **Unknown:** live Supabase Auth rate limits. Local `config.toml` values do not apply to the hosted project.
- **Recommendation:** confirm hosted Auth limits and CAPTCHA settings, and alert on the fallback being used.

<a id="sec-011"></a>

### SEC-011: Session tokens are readable by JavaScript

- **Observation:** `AUTH_COOKIE_SCOPE` does not set `httpOnly`, and the browser client uses the same session. This is how `@supabase/ssr` browser clients normally work. Remembered sessions last 30 days (`remember.ts`). The scanner never saw these cookies because it never signed in.
- **Impact:** defence in depth only, as no XSS was found. Any future XSS could steal a session, and [SEC-013](owasp-zap-findings.md#sec-013) means the browser would not block it. Severity should be raised if XSS is found.
- **Recommendation:** enforce CSP first. Decide on shorter lifetimes for admin roles, and record the design as an accepted risk or move browser data access server-side.

<a id="sec-012"></a>

### SEC-012: Sandbox and production PayPal separation not enforced in code

- **Observation:** the PayPal host and credentials come only from environment variables such as `PAYPAL_BASE_URL`. Nothing in the code ties an environment to a mode, and a code comment shows sandbox event handling exists.
- **Unknown:** which values are set in live Supabase secrets. Severity is not assigned because there is no evidence of a problem.
- **Action:** review secrets and the webhook ID in the PayPal dashboard. Record the outcome in the [tracker](security-remediation-tracker.md).

<a id="sec-029"></a>

### SEC-029: Customers can read all workspace members

- **Observation:** on live, `memberships_select` checks only `tenant_id`, and `users_select` allows any user with a membership in the caller's tenant. Neither checks the caller's role, and `authenticated` holds select on `users.email`, `users.full_name`, `memberships.user_id` and `memberships.role`.
- **Likely path:** a customer calls REST directly with their own token and lists every member's role, name and email, including other customers.
- **Intent:** migration `20260812060000` deliberately widened `users_select` to every tenant member, while the comment at `portal.service.ts:253` describes memberships as staff-scoped. [API-02](authentication-authorization-tests.md#direct-api-authorization) expects own record only.
- **Limit:** stays inside one workspace. Not executed.
- **Recommendation:** limit both policies to staff plus the caller's own row, after checking which browser code depends on them.

<a id="sec-030"></a>

### SEC-030: Removed member can re-grant access with an unexpired token

- **Observation:** `memberships_insert` reads the role from the token and has no `is_active_membership()` check. [SEC-005](#sec-005) leaves that token usable until it expires.
- **Likely path:** a removed Manager or Tenant Admin uses their saved token to insert an active membership for another account. If their row was deleted, they may also be able to re-add themselves.
- **Impact:** access that should end at token expiry becomes lasting access. Combined with [SEC-002](#sec-002), the new account can be a Tenant Admin. Not executed.
- **Recommendation:** add `is_active_membership()` to the policy as part of the SEC-002 fix.

---

## 11. Informational observations

| Observation                                                                                                                                                                               | Evidence                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `.env.example` lists `SESSION_SECRET`, `CRON_SECRET` and `RESEND_API_KEY`, but nothing in `src` or `supabase/functions` reads them                                                        | `git grep`                               |
| `robots.txt` lists `/platform`, although the console returns 404 to non-admins to avoid advertising it                                                                                    | ZAP screenshot, `src/app/robots.ts`      |
| Invoice links emailed by the webhook are signed for 7 days, so they work for anyone holding the email                                                                                     | `paypal-webhook/storage.ts:39`           |
| Attachment links are signed for 1 hour. The attachments bucket has no MIME allow-list, and content types are set by app code                                                              | `tickets.service.ts:1106`, `buckets.sql` |
| Edge Function imports use `esm.sh`, which `npm audit` does not cover                                                                                                                      | `supabase/functions/`                    |
| Local `main` is 37 commits behind `develop` and has no CSP-Report-Only header, yet production served it on 2026-11-04. So production's deploy source is not `main` as checked out here    | `git`, ZAP screenshots                   |
| The "Completed" column in `docs/reviews/code-review-2026-10-22.md` still shows `_Pending_` on items later code appears to fix. Earlier trackers should not be relied on without a recheck | `docs/reviews/`                          |
| `npm audit` now reports 0 issues, while RISK-016 in the 2026-11-03 review recorded 5 moderate                                                                                             | Executed 2026-11-04                      |

---

## 12. Coverage by security area

### Application security

| Area                             | Classification            | Basis                                                                                                                               |
| -------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| XSS                              | Partially verified        | Few sinks in code. ZAP active XSS rule 0 alerts, unauthenticated. Ticket and portal content not tested                              |
| Injection                        | Partially verified        | Parameterised client, escaped filters. ZAP SQLi and command rules 0 alerts on public pages                                          |
| CSRF                             | Partially verified        | SameSite=Lax seen on `sd_tenant`, bearer tokens on functions. Server Action origin checks rely on the framework and were not tested |
| Open redirects                   | Partially verified        | Validator in code. ZAP redirect rule 0 alerts. Not tested after sign-in                                                             |
| Input validation                 | Partially verified        | Zod in actions (sampled). No exhaustive review                                                                                      |
| Output encoding                  | Partially verified        | React escaping, template escaping. Not tested with hostile data                                                                     |
| Security headers                 | Verified by executed test | Scanner responses, with the gap in SEC-013                                                                                          |
| CORS                             | Partially verified        | `*` seen on public static content. Authenticated routes not observed                                                                |
| Error and information disclosure | Partially verified        | No debug errors from passing ZAP rules. Authenticated errors not tested                                                             |

### Authentication and sessions

| Area                          | Classification              | Basis                                                          |
| ----------------------------- | --------------------------- | -------------------------------------------------------------- |
| Secure session handling       | Verified by code inspection | Cookie scope in `remember.ts`, with SEC-011                    |
| Cookie flags                  | Partially verified          | `sd_tenant` observed. Auth cookies seen in code only           |
| Authentication enforcement    | Partially verified          | Proxy reviewed. Anonymous redirects observed. Roles not tested |
| Password reset and magic link | Not verified                | Code reviewed. Expiry and reuse depend on live Auth settings   |
| Session expiry and revocation | Not verified                | See SEC-005. Live JWT lifetime unknown                         |

### Authorization and tenant isolation

| Area                         | Classification              | Basis                                                   |
| ---------------------------- | --------------------------- | ------------------------------------------------------- |
| Server-side role enforcement | Partially verified          | Layered in code, spot-checked. No test run              |
| Supabase RLS policies        | Verified by code inspection | Gaps in SEC-002, 003, 005, 007. Live state not verified |
| Cross-tenant data access     | Not verified                | [Plan](tenant-isolation-tests.md) not run               |
| Direct object references     | Not verified                | Not run                                                 |
| Storage access restrictions  | Partially verified          | Policies read, gaps in SEC-004 and 008. Not run         |

### API security

| Area                             | Classification     | Basis                                            |
| -------------------------------- | ------------------ | ------------------------------------------------ |
| Authentication and authorization | Partially verified | Edge Functions reviewed, with SEC-006 and 009    |
| Input validation                 | Partially verified | Sampled                                          |
| Rate limiting                    | Partially verified | Code reviewed, with SEC-010. Not executed        |
| Sensitive information exposure   | Partially verified | `/api/workspace-status` returns block state only |
| Request validation               | Partially verified | Webhook size limit, slug validation              |
| Abuse prevention                 | Not verified       | Live limits unknown                              |

### Payments

| Area                              | Classification              | Basis                                                                |
| --------------------------------- | --------------------------- | -------------------------------------------------------------------- |
| Webhook signature validation      | Verified by code inspection | PayPal API, not run with forged events                               |
| Idempotency                       | Verified by code inspection | Unique keys in code. Not replayed                                    |
| Duplicate event handling          | Verified by code inspection | As above                                                             |
| Subscription status sync          | Partially verified          | Webhook plus reconcile job, which runs every minute on live. Not run |
| Unauthorized billing changes      | Partially verified          | Role checks and SEC-001. Live state unknown                          |
| Sandbox and production separation | Not verified                | SEC-012                                                              |

### Operational security

| Area                             | Classification     | Basis                                                            |
| -------------------------------- | ------------------ | ---------------------------------------------------------------- |
| Secret handling                  | Partially verified | Repository checked. Vercel and Supabase stores not visible       |
| Dependency vulnerabilities       | Partially verified | `npm audit` executed. Snyk unavailable. Deno imports not covered |
| Logging and monitoring           | Partially verified | Sentry and audit log in code. Alerts not visible                 |
| Cache behaviour                  | Partially verified | Public pages observed. Authenticated pages not observed          |
| Backup and recovery              | Not verified       | No evidence available                                            |
| Background job reliability       | Partially verified | Retry and queue code read. Live cron state unknown               |
| Incident investigation readiness | Partially verified | Audit log exists. No incident process found in the repository    |

---

## 13. Remediation priorities

| Priority | Action                                                                               | Findings                    |
| -------- | ------------------------------------------------------------------------------------ | --------------------------- |
| 1, now   | Read Edge Function settings, Security Advisor and the live reconcile cron command    | SEC-006, SEC-009            |
| 1, now   | Run the membership and avatar tests in a non-production stack, then fix              | SEC-002, 003, 004, 029, 030 |
| 1, now   | Check production for side effects of the 2026-11-04 scan                             | SEC-020                     |
| 2, next  | Add the role check to reconciliation and remove unneeded tenant and storage writes   | SEC-006, 007, 008           |
| 2, next  | Set `method="post"` on auth forms, and enforce CSP after reviewing violations        | SEC-014, SEC-013            |
| 2, next  | Add MFA for platform admins, and address stale tokens                                | SEC-015, SEC-005            |
| 3, then  | Automate authorization tests, run authenticated DAST in staging, supply Snyk results | SEC-016                     |
| 3, then  | Confirm Auth limits and PayPal environment, and apply header and cookie cleanups     | SEC-010, 012, 018, 019      |

## 14. Residual risks and limitations

### Residual risks

- Tenant isolation rests on JWT claims and RLS. Service-role code paths bypass RLS and depend on correct application checks, which were spot-checked rather than exhaustively reviewed.
- Direct API access is open by design, so every policy gap is reachable by any signed-in user.
- Attachment and message content comes from untrusted customers, and authenticated XSS testing has not been done.
- Vercel, Supabase, PayPal, Google, Gmail and Sentry are trusted third parties, and their configuration was not reviewed.
- No evidence of backup restores or incident response practice was available.

### Assessment limitations

- No authenticated testing, so scanners saw only public pages and redirects.
- ZAP's Client Spider failed, so JavaScript-only routes may have been missed.
- The PDF reports show at most 5 instances per alert, and the screenshots show one instance per alert. The full ZAP session was not exported.
- The Supabase connector stayed denied. Live SQL results came from the project owner, and advisors and Edge Function settings could not be read.
- Policy review used final-state analysis of migrations, partly by script, so an unusual dynamic SQL statement could be missed.
- Severity in Section 10 is provisional.

## 15. Final assessment status

**Status: Incomplete. Significant items are open and unverified.**

| Question                                                  | Answer                                                                           |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Is the application shown to be secure?                    | **No claim is made.** No assessment can show this                                |
| Has tenant isolation been shown to work on live?          | **No.** Not tested                                                               |
| Were critical or high scanner alerts found?               | No, but the scans were unauthenticated                                           |
| Are there unresolved issues of provisional High severity? | Yes: SEC-002, SEC-003. SEC-001 is on live but not retested                       |
| What would change this status?                            | Edge Function and advisor checks, executed test plans, Snyk evidence and retests |
