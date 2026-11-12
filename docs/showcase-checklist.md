# Showcase checklist

The work left before this project can be shown to clients, in priority order. It comes from the showcase audit (`docs/showcase-audit.md`, 2026-11-11, updated 2026-11-12) and is brought up to date with everything merged since.

**How to use it:** pick one item by ID (for example "fix OPS-01") or a whole batch (for example "fix batch A"). Each fix goes on its own `showcase-fix/<topic>` branch and updates this file and the audit report. Tick an item only when its fix is on `main` and, where it says so, deployed.

**Who does it:** **You** means a step in a dashboard or console that only a person with access can do. **Code** means a change in this repository.

| Priority | Meaning                                                 | Open |
| -------- | ------------------------------------------------------- | ---: |
| P0       | Must be done before any client sees the demo            |    7 |
| P1       | Most visible to a client or reviewer, for little effort |   34 |
| P2       | Worth doing; a careful reviewer would notice            |   12 |
| P3       | Large, or needs a decision first                        |    4 |

## P0: before any client sees the demo

| Done | ID             | What                                                                                                                                                                                                             | Who  | Effort | Status                                                 |
| ---- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------ | ------------------------------------------------------ |
| [ ]  | SEC-05, SEC-06 | Merge `showcase-fix/authz-and-nav`: closes client-side write paths (free paid workspaces) and cross-workspace writes. The deploy applies its migrations.                                                         | You  | 10 min | Fixed on branch, 202 of 202 authorization checks pass  |
| [ ]  | LOAD-001       | Merge `showcase-fix/load-001`: an Auth outage returns a retryable 503 instead of signing users out.                                                                                                              | You  | 5 min  | Fixed on branch                                        |
| [ ]  | WF-11, DOC-07  | Merge `showcase-fix/landing-claims`: the landing page and plans describe only real features.                                                                                                                     | You  | 5 min  | Fixed on branch                                        |
| [ ]  | SEC-01         | Confirm the old `CRON_SECRET` (starts `4da9`, in git history) is set nowhere: Edge Function secrets and Vault on every project. If it is, rotate it.                                                             | You  | 15 min | `.gitignore` part done on `main`                       |
| [ ]  | WF-10          | A visitor who signs up at `/setup` and invites someone sends a real email. In the demo environment, send only to an allow-list or a catch-all inbox, or turn invites off.                                        | Code | 2–4 h  | Open                                                   |
| [ ]  | SEC-16, WF-05  | Seeded accounts default to the password in the repository (`test@123`). Make `SEED_PASSWORD` required when seeding a hosted project, and keep `PLATFORM_ADMIN_EMAILS` to real admins only.                       | Code | 1 h    | Partly done: platform admin no longer a seeded account |
| [ ]  | Demo flow      | Sign in as each demo role on the deployed development site and click through the main flow: raise a ticket in the portal, answer it as an agent, resolve it, see the email and the report. Note anything broken. | You  | 30 min | Not yet tried on a deployed site                       |

Also needed, from `docs/deployment.md`: fill the GitHub `development` environment and run the first development deploy; prepare the production project before tagging `v1.0.0`; and add the branch and tag rulesets (CI-03).

## P1: most visible, little effort

### Batch A: health, logs and version (operations)

| Done | ID     | What                                                                                                               | Effort | Files                                                  |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------ |
| [ ]  | OPS-01 | `/api/health` that checks the database and Auth, returns 200 or 503, and shows no secrets.                         | 2 h    | `src/app/api/health/route.ts`                          |
| [ ]  | CI-07  | Show the deployed version and commit in `/api/health` and the platform console. Releases are already tagged `v*`.  | 1 h    | `src/app/api/health/route.ts`, `next.config.ts`        |
| [ ]  | OPS-02 | One JSON logger with a request ID set in the proxy, used in place of bare `console.error` in services and actions. | 1 day  | `src/lib/logger.ts`, `src/proxy.ts`, `src/features/**` |
| [ ]  | SEC-14 | The logger removes emails, tokens and keys from log lines.                                                         | 2 h    | `src/lib/logger.ts`                                    |
| [ ]  | OPS-05 | Timeouts, and retries with back-off, on PayPal calls in the Edge Functions.                                        | 2 h    | `supabase/functions/_shared/paypal-*.ts`               |
| [ ]  | OPS-03 | Report Edge Function errors to Sentry, and write down the alert rules.                                             | 3 h    | `supabase/functions/_shared/`, `docs/`                 |

### Batch B: legal pages and showcase documents

| Done | ID      | What                                                                                                         | Effort | Files                                              |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------- |
| [ ]  | DOC-08  | A LICENSE file, and a third-party notice for dependencies whose licences ask for one.                        | 1 h    | `LICENSE`, `THIRD_PARTY_NOTICES.md`                |
| [ ]  | DOC-09  | Privacy and terms pages, linked from the footer, disclosing Sentry, session cookies and PayPal.              | 3 h    | `src/app/(legal)/privacy`, `src/app/(legal)/terms` |
| [ ]  | DOC-04  | A one-page case study: problem, solution, architecture, measured results.                                    | 2 h    | `docs/case-study.md`                               |
| [ ]  | DOC-06  | A guided demo script: which account to use, what to click, what to point out, in 5 minutes.                  | 1 h    | `docs/demo-script.md`                              |
| [ ]  | DOC-01  | 3–4 screenshots in the README (ticket queue, ticket, portal, reports).                                       | 1 h    | `README.md`, `docs/images/`                        |
| [ ]  | ARCH-11 | Short decision records: Supabase RLS, Server Actions, PayPal, Gmail, Vercel, nonce CSP, trunk-based deploys. | 3 h    | `docs/decisions/`                                  |

### Batch C: polish and consistency

| Done | ID      | What                                                                                                                          | Effort | Files                                                           |
| ---- | ------- | ----------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------- |
| [ ]  | DES-07  | One product name. The fallback is "ServiceDeskPro" while the README and `.env.example` say "ServiceDesk".                     | 1 h    | `src/components/shared/platform-brand.tsx`, `README.md`         |
| [ ]  | DES-09  | Replace `public/supabase-services-loader-light.gif`, which looks like a vendor's brand asset, with the app's own loader.      | 1 h    | `src/features/platform-admin/components/platform-skeletons.tsx` |
| [ ]  | ARCH-04 | Remove the unused `comingSoon` branch.                                                                                        | 15 min | `src/features/platform-admin/components/platform-sidebar.tsx`   |
| [ ]  | WF-12   | Use a US or UK zone in examples (not `Asia/Kolkata`), and check dates and money read naturally for US and UK users.           | 1 h    | `src/features/sla-policies/format.ts`, formatters               |
| [ ]  | ARCH-12 | Update patch and minor dependencies; drop `react-icons` if `lucide-react` covers its uses; remove the stray root `deno.lock`. | 2 h    | `package.json`, `src/**`                                        |
| [ ]  | DEP-13  | Point the README's Argos link at a shared account instead of a personal one.                                                  | 10 min | `README.md`                                                     |
| [ ]  | DES-08  | Move the platform logo and landing-page copy into platform settings, so a rebrand needs no code change.                       | 4 h    | `src/app/page.tsx`, platform settings                           |

### Batch D: security hardening

| Done | ID     | What                                                                                                                                                         | Effort | Files                                          |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------------------------------------------- |
| [ ]  | SEC-02 | Password rules (length and character mix) in `supabase/config.toml`, and the same on the hosted projects.                                                    | 1 h    | `supabase/config.toml`; **You**: Auth settings |
| [ ]  | SEC-03 | A removed member loses API access at once, not when the token expires (tracker SEC-005). Decide on `HttpOnly` session cookies (SEC-011).                     | 4 h    | `src/proxy.ts`, membership checks              |
| [ ]  | SEC-10 | Login and password reset limits fail closed instead of falling back to per-instance memory (SEC-010), and CAPTCHA is on in hosted Auth for direct API calls. | 4 h    | rate limiter; **You**: Auth settings           |
| [ ]  | SEC-11 | Once SEC-05 is deployed, check avatar uploads still work through signed uploads; then re-grade.                                                              | 30 min | **You**: on the development site               |
| [ ]  | SEC-07 | Re-grade now that cross-workspace IDs are refused by the database (SEC-06). Nothing else open was found.                                                     | 30 min | audit report                                   |
| [ ]  | SEC-20 | MFA is off. The SSO claims are gone, so this is optional; turn on TOTP for staff if the demo should show it.                                                 | 3 h    | `supabase/config.toml`, account settings UI    |

### Batch E: tests and pipeline

| Done | ID             | What                                                                                                     | Effort | Files                                     |
| ---- | -------------- | -------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------- |
| [ ]  | TEST-04        | One `npm run test:all` for unit, authorization and e2e tests, with the e2e stack started by the script.  | 2 h    | `package.json`, `scripts/`                |
| [ ]  | TEST-06        | Coverage with `@vitest/coverage-v8`, reported for auth, tenancy and billing.                             | 1 h    | `vitest` config, `package.json`, CI       |
| [ ]  | TEST-01        | Tests for the SLA engine (SQL) and plan-change logic.                                                    | 1 day  | `supabase/tests/`, `src/features/billing` |
| [ ]  | TEST-02        | Re-grade now that the 202-case authorization suite exists, and add any missing permission-failure cases. | 1 h    | audit report                              |
| [ ]  | DES-02, DES-03 | Run Playwright at 375, 768 and 1280 px, and add an accessibility scan (axe) of the main pages.           | 3 h    | `playwright.config.ts`, `e2e/`            |
| [ ]  | CI-09          | Dependabot for npm and GitHub Actions.                                                                   | 15 min | `.github/dependabot.yml`                  |

### Batch F: performance evidence

| Done | ID              | What                                                                                                    | Effort | Files                                    |
| ---- | --------------- | ------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------- |
| [ ]  | PERF-02         | Load `jspdf` and `html-to-image` only when the user exports a report.                                   | 1 h    | `src/features/reports/lib/export-pdf.ts` |
| [ ]  | PERF-01, DOC-05 | Lighthouse on the landing, sign-in, tickets and portal pages of the deployed site, saved with the date. | 2 h    | `docs/performance/`                      |
| [ ]  | PERF-05         | Re-run the k6 load test against the deployed development site and save the result.                      | 2 h    | `docs/load-testing/`                     |

## P2: worth doing

| Done | ID      | What                                                                                              | Effort  |
| ---- | ------- | ------------------------------------------------------------------------------------------------- | ------- |
| [ ]  | WF-06   | Reset the demo data nightly (scheduled `--clean` then `--apply` on the demo project).             | 3 h     |
| [ ]  | WF-08   | Check every main screen with an empty workspace, and add empty states where missing.              | 4 h     |
| [ ]  | DES-06  | Confirm member removal, plan cancellation and ticket deletion all ask first.                      | 2 h     |
| [ ]  | DES-01  | Move the 53 hard-coded hex colours to design tokens.                                              | 4 h     |
| [ ]  | ARCH-09 | Run Supabase's index advisor on the seeded stack, and fix missing foreign-key indexes.            | 3 h     |
| [ ]  | PERF-06 | Check every list query is bounded.                                                                | 2 h     |
| [ ]  | OPS-06  | Prove `claim_email_jobs` frees jobs claimed by a run that crashed.                                | 2 h     |
| [ ]  | OPS-07  | Document the backup level and point-in-time recovery, and run one restore into a scratch project. | 3 h     |
| [ ]  | CI-05   | Short-lived credentials. Supabase and Vercel tokens can't use OIDC today; record that decision.   | 30 min  |
| [ ]  | DEP-02  | `npm run dev:all`: start local Supabase, seed, and the app in one command.                        | 2 h     |
| [ ]  | WF-03   | Re-grade roles now that customers can no longer read every member (fixed with SEC-05).            | 30 min  |
| [ ]  | ARCH-08 | Confirm the schema builds from an empty project in the first production deploy, then re-grade.    | **You** |

## P3: large, or needs a decision first

| Done | ID                                       | What                                                                                                                                                                        | Decision needed                   |
| ---- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| [ ]  | DEP-01                                   | A production Dockerfile (Next `output: "standalone"`, non-root), or a decision record saying Vercel is the deliberate target.                                               | Docker image or Vercel only       |
| [ ]  | DEP-03 to DEP-08, CI-08                  | Infrastructure as code (Terraform providers for Supabase and Vercel), with low-cost and production profiles, tags, budget alert, remote state, and a plan in pull requests. | Worth days of work for this demo? |
| [ ]  | DEP-11                                   | Run the demo on a custom domain with a valid certificate.                                                                                                                   | Which domain                      |
| [ ]  | SEC-18, SEC-19, PERF-04, PERF-08, OPS-04 | Check by hand: least-privilege tokens, HTTP to HTTPS redirect, CDN caching, connection pool size, and an uptime monitor on the demo. Steps are in section 6 of the audit.   | **You**                           |

## Done since the audit

On `main` unless noted.

| ID                    | What changed                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI-01, CI-02, CI-06   | CI on every pull request: lint, format, types, unit tests, build, authorization suite, `npm audit` and a secret scan, with npm caching (`.github/workflows/ci.yml`). |
| CI-04, DEP-09         | Deploys run from GitHub Actions: migrations, Edge Functions and the app, in that order (`.github/workflows/deploy.yml`).                                             |
| DEP-10                | Rollback documented (`docs/deployment.md`).                                                                                                                          |
| DEP-12, ARCH-05       | Every deployed value is set in one place per environment (GitHub environments); `.env.example` matches the code.                                                     |
| ARCH-08               | Default grants and the reconcile schedule are recorded in migrations. Still to confirm on an empty project (see P2).                                                 |
| SEC-01 (part)         | All `.env` files except `.env.example` are git-ignored.                                                                                                              |
| WF-04, WF-05, SEC-17  | Realistic fictional US companies, customers and ticket threads, on addresses and phone numbers that can't reach anyone; demo accounts listed in the README.          |
| WF-02                 | The sidebar already hid unbuilt pages; a test now guards it (on `showcase-fix/authz-and-nav`).                                                                       |
| TEST-04 (part)        | The authorization suite is committed and runs in CI (on `showcase-fix/authz-and-nav`).                                                                               |
| SEC-20, DES-07 (part) | The SSO and AI claims and the "2026 trends" tone are gone from the landing page (on `showcase-fix/landing-claims`).                                                  |
