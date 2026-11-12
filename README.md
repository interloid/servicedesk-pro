# ServiceDesk

Multi-tenant customer support and help desk SaaS. Each workspace (tenant) gets a staff app for tickets and SLAs, plus a branded portal where its customers raise and follow requests. A separate console lets platform admins run the whole service.

This README is the handover guide for developers. It explains how to run the project, how each system works, how to make common changes, and what to check when something breaks.

## Contents

1. [Read this first](#read-this-first)
2. [Features](#features)
3. [Tech stack](#tech-stack)
4. [Local setup](#local-setup)
5. [Environment variables](#environment-variables)
6. [Commands](#commands)
7. [Project structure](#project-structure)
8. [Architecture](#architecture)
9. [Core systems](#core-systems)
10. [Database](#database)
11. [Coding conventions](#coding-conventions)
12. [How to make common changes](#how-to-make-common-changes)
13. [Testing](#testing)
14. [Seed data](#seed-data)
15. [Deployment](#deployment)
16. [Operations and troubleshooting](#operations-and-troubleshooting)
17. [Known gaps](#known-gaps)
18. [More documentation](#more-documentation)

## Read this first

These rules prevent the most expensive mistakes on this project:

- **Check `.env.local` before writing data.** If it holds hosted project keys, seed scripts and app actions change that project.
- **Keep tenant isolation in the database.** Every tenant table relies on row-level security (RLS). Add policies with every new table, and test them.
- **Treat the service role client as dangerous.** `src/lib/supabase/admin.ts` bypasses RLS, so scope every query to the correct tenant yourself. Never use it in browser code.
- **Don't edit applied migrations.** Add a new migration, and update the matching file in `supabase/schemas/`.
- **Read the local Next.js docs.** This version has breaking changes from older releases. For example, request handling lives in `src/proxy.ts`. Read the relevant guide in `node_modules/next/dist/docs/` before changing framework code.
- **Keep `verify_jwt = true` on scheduled functions.** These functions rely on the gateway to verify the token signature. `paypal-webhook` is the only exception, because it verifies PayPal signatures itself.

## Features

| Area             | What it does                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| Tickets          | Queues, saved views, priorities, tags, assignment, conversations, and attachments                         |
| SLA policies     | Targets, business hours, holidays, and time zones, with clocks enforced in the database                   |
| Customer portal  | Self-service requests, help search, threaded replies, and guest ticket creation                           |
| Customers, team  | Invitations, roles, portal access, seat limits, and ownership transfer                                    |
| Notifications    | Live in-app bell and email alerts, based on each user's preferences                                       |
| Reports          | Workspace-wide reporting on paid plans                                                                    |
| Branding         | Workspace logo and portal branding on paid plans                                                          |
| Audit log        | Record of who changed what, on the Business plan                                                          |
| Billing          | PayPal subscriptions, plan changes, invoices, and failed payment handling                                 |
| Platform console | Tenants, users, plans, billing, analytics, audit logs, health, logs, maintenance mode, workspace blocking |

## Tech stack

| Area       | Technology                                                                      |
| ---------- | ------------------------------------------------------------------------------- |
| App        | Next.js 16 (App Router, React Compiler), React 19, TypeScript                   |
| UI         | Tailwind CSS 4, shadcn/ui, Radix UI, Recharts, lucide-react                     |
| Forms      | React Hook Form, Zod                                                            |
| Backend    | Supabase: Postgres with RLS, Auth, Storage, Realtime, Edge Functions, `pg_cron` |
| Payments   | PayPal Subscriptions and Orders                                                 |
| Email      | Gmail API for queued app email, Supabase Auth for its own auth email            |
| Monitoring | Sentry                                                                          |
| Testing    | Vitest, SQL authorization suite, Playwright, Argos                              |
| Hosting    | Vercel for the app, Supabase for the backend                                    |

## Local setup

### Prerequisites

- Node.js 24 and npm 11. `.nvmrc` pins the exact Node version, so run `nvm use`.
- [Supabase CLI](https://supabase.com/docs/guides/local-development) and Docker.
- The VS Code Deno extension if you work on Edge Functions. `.vscode/settings.json` turns it on for `supabase/functions`.

### Steps

**1. Install dependencies and create your environment file:**

```bash
npm install
cp .env.example .env.local
```

**2. Start the local Supabase stack.** The first start applies all migrations and seeds the plans, time zones, and storage buckets.

```bash
supabase start
```

**3. Copy the keys from the `supabase start` output into `.env.local`:**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**4. Start the app:**

```bash
npm run dev
```

**5. Create a workspace.** Open <http://localhost:3000/setup> to create an account and organization. You can also load [seed data](#seed-data).

**6. Optional: open the platform console.** Add your email to `PLATFORM_ADMIN_EMAILS`, restart the app, sign in through your workspace, then open `/platform`.

### Local URLs

| Service             | URL                                                       |
| ------------------- | --------------------------------------------------------- |
| App                 | <http://localhost:3000>                                   |
| Supabase API        | <http://127.0.0.1:54321>                                  |
| Supabase Studio     | <http://127.0.0.1:54323>                                  |
| Email testing inbox | <http://127.0.0.1:54324>                                  |
| Postgres            | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

### What needs extra setup locally

| Feature        | What it needs                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Google sign-in | `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` in the shell that runs Supabase |
| Edge Functions | `supabase functions serve --env-file .env.local`, with the secrets from [Edge Functions](#edge-functions) in group 7 |
| PayPal         | Sandbox credentials, a public webhook URL, and PayPal plans. See [Billing](#billing).                                |
| Queued email   | Gmail credentials and Vault secrets. Without them, jobs stay in `email_jobs` unsent.                                 |
| Scheduled jobs | Vault secrets. See [Scheduled jobs](#scheduled-jobs).                                                                |

To rebuild the local database from scratch, run `supabase db reset`. This deletes all local data.

## Environment variables

### Next.js app

Set these in `.env.local` locally and in the host's settings for deployed environments. They are read through `src/config/env.ts` (public) and `src/config/server-env.ts` (server-only).

| Variable                                                    | Required | Purpose                                                               |
| ----------------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                      | Yes      | Public URL of the app                                                 |
| `NEXT_PUBLIC_APP_DOMAIN`                                    | Yes      | Base domain, which decides how tenant routing works                   |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | Supabase connection                                                   |
| `SUPABASE_SERVICE_ROLE_KEY`                                 | Yes      | Server-only admin access. Bypasses RLS.                               |
| `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_SITE_DESCRIPTION`     | No       | Site metadata                                                         |
| `NEXT_PUBLIC_TWITTER_HANDLE`                                | No       | Social metadata                                                       |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID`                              | Billing  | PayPal checkout in the browser                                        |
| `PLATFORM_ADMIN_EMAILS`                                     | Console  | Comma-separated emails allowed into `/platform`                       |
| `SUPABASE_MANAGEMENT_TOKEN`                                 | Console  | Data for `/platform/logs` and `/platform/health`. Use a scoped token. |
| `SUPABASE_PROJECT_REF`                                      | No       | Only needed when the Supabase URL is a custom domain                  |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`                      | No       | Browser and server error reporting                                    |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`         | No       | Source map upload at build time                                       |

`.env.example` lists every variable in numbered groups, marks each one public or secret, and says where it's set for development and production. Locally, one `.env.local` holds the app variables and the Edge Function secrets (group 7). Where each secret lives in each environment is in [docs/deployment.md](docs/deployment.md#where-secrets-live).

### Edge Functions

On hosted projects, set these in the GitHub environment; each deploy copies them to Supabase (see [docs/deployment.md](docs/deployment.md)). Locally, use `supabase functions serve --env-file .env.local`. Hosted Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

| Variable                                                           | Purpose                                                           |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `PAYPAL_BASE_URL`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`      | PayPal API access                                                 |
| `PAYPAL_WEBHOOK_ID`                                                | Verifies PayPal webhook signatures                                |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Gmail API sending. The token needs the `gmail.send` scope.        |
| `FROM_EMAIL`                                                       | Sender address, which must belong to the Google account above     |
| `FRONTEND_URL`                                                     | App origin for links in emails. Without it, buttons are left out. |

## Commands

| Command                | Description                                                    |
| ---------------------- | -------------------------------------------------------------- |
| `npm run dev`          | Start the development server                                   |
| `npm run build`        | Create a production build                                      |
| `npm start`            | Serve the production build                                     |
| `npm run lint`         | Run ESLint                                                     |
| `npm run format`       | Format the whole repository with Prettier                      |
| `npm run format:check` | Check formatting without writing changes                       |
| `npm test`             | Run the Vitest unit tests                                      |
| `npm run test:authz`   | Run the authorization tests against a throwaway local database |
| `npm run audit`        | Audit production dependencies                                  |

## Project structure

```text
src/
  app/                  Routes
    (auth)/             Central login, password reset, and /setup onboarding
    (app)/[tenantSlug]/ Staff app (base-layout), tenant login, and customer portal
    platform/           Platform console
    api/                Route handlers
    blocked/            Shown to blocked workspaces
    maintenance/        Shown during maintenance mode
  features/             Feature modules (see below)
  components/
    ui/                 shadcn/ui primitives
    shared/             Shared app components, including the layout shell
    marketing/          Public home page
  config/               Validated environment and site settings
  hooks/                Shared hooks, including the realtime subscriptions
  lib/
    supabase/           Browser, server, and admin clients, plus generated types
    tenancy.ts          Routing rules, tenant routes, roles, and reserved slugs
    rate-limit.ts       Shared rate limiter
  proxy.ts              Runs on requests: routing, sessions, and access gates
  instrumentation*.ts   Sentry setup
supabase/
  config.toml           Local stack, auth hook, and function settings
  functions/            Edge Functions
  migrations/           Ordered changes applied to each database
  schemas/              Readable current copy of tables, functions, and policies
  tests/authz/          Authorization regression tests
scripts/                Development data seeders
docs/                   Reviews, security documents, and PayPal notes
```

### Inside a feature module

Each folder in `src/features/` owns one product area. Not every module has every folder, and some have a single action file such as `billing-actions.ts`.

| Folder               | Contains                                                |
| -------------------- | ------------------------------------------------------- |
| `components/`        | React components for this feature                       |
| `actions/`           | Server Actions (`"use server"`), called from components |
| `services/`          | Server-side data access and business logic              |
| `schemas/` or `lib/` | Zod schemas and pure helpers                            |
| `types/`             | TypeScript types                                        |

## Architecture

```mermaid
flowchart LR
  Browser[Staff, customer, or admin browser] --> Proxy[Next.js proxy]
  Proxy --> App[Pages and Server Actions]
  App -->|user token, RLS applies| DB[(Postgres)]
  App -->|service role, bypasses RLS| DB
  App --> Edge[Edge Functions]
  Browser -->|anon key and user token| Realtime[Realtime and Storage]
  Realtime --> DB
  Cron[pg_cron] --> Edge
  Cron --> DB
  PayPal -->|signed webhook| Edge
  Edge --> PayPal
  Edge --> Gmail[Gmail API]
  App --> Sentry
```

The usual path for a change made by a user:

1. A component validates the form with React Hook Form and Zod.
2. It calls a Server Action, which parses the input again and returns a result such as `{ ok: true }` or `{ ok: false, message }`.
3. The action calls a service, which reads or writes through the user's Supabase client so RLS applies.
4. Database triggers handle side effects such as SLA clocks, audit rows, and queued email.
5. Realtime hooks in `src/hooks/` refresh other open screens.

### Supabase clients

| File                         | Runs in | Identity     | Use it for                                           |
| ---------------------------- | ------- | ------------ | ---------------------------------------------------- |
| `src/lib/supabase/client.ts` | Browser | Current user | Realtime and direct uploads                          |
| `src/lib/supabase/server.ts` | Server  | Current user | Default choice for server reads and writes           |
| `src/lib/supabase/admin.ts`  | Server  | Service role | Only what RLS can't allow. Check access in the code. |

## Core systems

### Tenancy and routing

Every workspace has a unique slug.

| Area             | Path              |
| ---------------- | ----------------- |
| Staff app        | `/{slug}/tickets` |
| Customer portal  | `/{slug}/portal`  |
| Platform console | `/platform`       |
| New workspace    | `/setup`          |

On a real domain, a workspace can also be reached by subdomain (`{slug}.example.com`). Subdomain routing is turned off for `localhost`, `*.vercel.app`, and IP addresses, so use paths there.

`src/proxy.ts` runs on requests and handles routing, session refresh, role checks, maintenance mode, and workspace blocks. The rules live in `src/lib/tenancy.ts`.

### Authentication and roles

Users sign in through Supabase Auth with a password or Google. The database function `custom_access_token_hook` adds `tenant_id`, `tenant_slug`, and `tenant_role` to each token, and RLS policies read those claims.

A token covers **one workspace at a time**, and it keeps its claims until it refreshes. Tokens last one hour by default, so a role change or removal may not take effect immediately.

| Role            | Access                                                             |
| --------------- | ------------------------------------------------------------------ |
| `tenant_admin`  | Full workspace access. One membership is the owner (`is_primary`). |
| `manager`       | Staff app, with team and policy management                         |
| `agent`         | Staff app, working tickets                                         |
| `billing_admin` | Billing and plan pages only                                        |
| `customer`      | Customer portal only                                               |

Platform console access comes from `PLATFORM_ADMIN_EMAILS` and is checked by `requirePlatformAdmin` in `src/features/platform-admin/services/platform-access.ts`.

### Tickets and SLAs

SLA logic lives in the database, not in the app:

- `supabase/schemas/functions/17_sla_engine.sql` holds business-time arithmetic, policy selection, and clock operations.
- `supabase/schemas/triggers/tickets_sla.sql` updates the clocks when a ticket changes.
- `sla_tick()` runs every 15 minutes through `pg_cron` to find breaches, and queues alerts in `sla_alert_jobs`.
- Priority changes go through the `change_ticket_priority` RPC.

The header of migration `20261009140000_ticket_sla_engine.sql` explains the design. Business hours are stored per workspace with a time zone, and a wrong time zone produces wrong SLA times.

### Billing

Each tenant has **one PayPal recurring subscription**. The `subscriptions` table is the source of truth.

| Change          | What happens                                                                      |
| --------------- | --------------------------------------------------------------------------------- |
| Free to paid    | Creates the agreement, which is the only time one is created                      |
| Upgrade         | Charges the price difference once, then revises the same agreement                |
| Downgrade       | Scheduled, then `reconcile-subscriptions` revises the agreement at period end     |
| Cancel          | Suspends the agreement, keeps access to period end, then moves the tenant to Free |
| Failed payments | Grace period, then the tenant moves to Free and the workspace is blocked          |

A workspace blocked for non-payment can still open its billing and plan pages so that it can pay.

Default plans from `supabase/schemas/seeds/01_plans_seed.sql` are below. Seat limits can be changed in the platform console, so a live database may differ.

| Plan     | Monthly price | Seats | Tickets   | Storage |
| -------- | ------------- | ----- | --------- | ------- |
| Free     | $0            | 2     | 50        | 1 GB    |
| Pro      | $29           | 15    | Unlimited | 10 GB   |
| Business | $59           | 100   | Unlimited | 50 GB   |

> [!IMPORTANT]
> `plans.code` holds the PayPal plan ID, and **all paid plans must sit under one PayPal product**. PayPal rejects a revision across products with `PLAN_PRODUCT_NOT_COMPATIBLE`. The seed file only runs on a fresh database, so change codes on an existing database with a migration.

### Email

The app doesn't send mail during a request. It adds a row to `email_jobs`, then the `email-jobs` function sends it:

1. App code or a database trigger inserts a job with a `kind`.
2. `pg_cron` calls `email-jobs` every minute while a job is due.
3. `claim_email_jobs` gives each job to one caller, so nothing is sent twice.
4. The function picks the handler for that `kind`. Most mail goes through the Gmail API, in `_shared/gmail.ts`.
5. Failed sends go back to `pending` with a backoff, so the cron is also the retry.

Supabase Auth handles team invitations to new accounts and password resets, using the SMTP settings on the hosted project. Other mail uses Gmail.

### Notifications

Database triggers create rows in `notifications` and queue emails based on `notification_prefs`. The bell updates live through Realtime. See `supabase/schemas/functions/24_notification_emails.sql` and `25_ticket_notifications.sql`.

### Platform console

Console settings reach tenants through the proxy and the brand provider. The proxy caches the maintenance status for about 10 seconds per server instance, so changes aren't instant. If the check fails, the proxy lets traffic through rather than locking every workspace out.

### Security controls

- The Content Security Policy is in `src/lib/csp.ts`, applied per request by the proxy with a nonce. Add any new external origin there. Other security headers, and the policy for static files, are in `next.config.ts`.
- Every page renders per request, because a prerendered page has no nonce and its scripts would be blocked. Don't remove `connection()` from the root layout.
- Rate limits count in Postgres through the `rate_limit_hit` RPC, with an in-memory fallback.
- Audit rows come from database triggers. Service role calls pass the acting user in the `x-audit-actor` header, so the audit row names the right person.

## Database

### Migrations and schemas

The two folders have different jobs:

- **`supabase/migrations/`** is what actually changes a database. Files run in timestamp order.
- **`supabase/schemas/`** is the readable current state, organized by object. Use it to understand a table or function. Plans, time zones, and buckets are seeded from here.

Make database changes in this order:

1. Create a migration with `supabase migration new <name>`.
2. Write the SQL by hand, and update the matching file in `supabase/schemas/`.
3. Apply it locally with `supabase db reset`, which deletes local data.
4. Regenerate types, and review the diff before keeping it:

   ```bash
   supabase gen types typescript --local > src/lib/supabase/database.types.ts
   ```

5. Run `npm run test:authz`.

There are no down migrations. To undo a change, write a new migration.

### New table checklist

- [ ] Add a `tenant_id` column and an index that supports your queries
- [ ] Enable RLS and add policies for each role that needs access
- [ ] Grant only the table privileges the API roles need
- [ ] Add audit and `updated_at` triggers where they apply
- [ ] Add attack cases to `supabase/tests/authz/cases.sql`

### Storage buckets

| Bucket               | Contents                  |
| -------------------- | ------------------------- |
| `avatars`            | User avatars              |
| `branding`           | Workspace logos           |
| `invoices`           | Invoice PDFs              |
| `ticket-attachments` | Ticket and portal uploads |

### Scheduled jobs

| Job                              | Schedule     | Runs                      | Vault secrets                                                |
| -------------------------------- | ------------ | ------------------------- | ------------------------------------------------------------ |
| `email-jobs-every-minute`        | Every minute | `email-jobs`              | `email_jobs_url`, `service_role_key`                         |
| `sla-tick-every-15-minutes`      | Every 15 min | `sla_tick()`              | None                                                         |
| `reconcile-subscriptions-hourly` | Hourly       | `reconcile-subscriptions` | `reconcile_subscriptions_url`, see [Known gaps](#known-gaps) |
| `portal-staging-upload-sweep`    | Daily 04:17  | `portal-storage-sweep`    | `portal_storage_sweep_url`, `service_role_key`               |

Create each secret once per environment:

```sql
select vault.create_secret('<value>', '<secret name>');
```

### Edge Functions

| Function                  | Called by | Purpose                                                     |
| ------------------------- | --------- | ----------------------------------------------------------- |
| `subscription`            | App       | Create, upgrade, cancel, and activate subscriptions         |
| `update-payment-method`   | App       | Change the subscription's payment method                    |
| `paypal-webhook`          | PayPal    | Handle subscription and payment events, and create invoices |
| `reconcile-subscriptions` | `pg_cron` | Apply due plan changes and repair subscription state        |
| `email-jobs`              | `pg_cron` | Send queued mail                                            |
| `portal-storage-sweep`    | `pg_cron` | Delete abandoned portal uploads                             |

Shared code is in `supabase/functions/_shared/`. Functions run on Deno, so they can't import from `src/`.

## Coding conventions

- Follow the feature module layout, and keep feature code out of `src/app/`. Route files should stay thin.
- Validate input again in every Server Action. Client validation is only for the user's convenience.
- Import server-only code with `import "server-only"`, and read variables through `src/config/` rather than `process.env`.
- Use the `@/` import alias.
- Run `npm run format`. The pre-commit hook runs it across the whole repository, then runs `npm test`, so check for unrelated changes before you commit.

### UI rules

| Topic         | Rule                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| Control sizes | `h-10` in the app, `h-11` on auth, onboarding, and portal forms, `p-2` on menu rows                                |
| Colours       | Use `slate`, not `gray`                                                                                            |
| Date and time | Use the shadcn `Calendar` and `TimePickerPopover`, not native inputs                                               |
| Dialogs       | Reuse the existing dialog patterns and `modal-notice.tsx` tones. Don't invent new popup styles.                    |
| Result pages  | Follow the centred payment success card. Blocked states use light red.                                             |
| Loading       | Don't add `loading.tsx` above sub-routes, because it causes a spinner then skeleton flash                          |
| New shadcn UI | The CLI can misfire in this repository because of the Deno setup, so check the generated files or add them by hand |

## How to make common changes

### Add a staff page

1. Create `src/app/(app)/[tenantSlug]/(base-layout)/<route>/page.tsx`.
2. Add the route to `TENANT_ROUTES` in `src/lib/tenancy.ts`.
3. Add its first path segment to `RESERVED_LABELS`, and to the `tenants_slug_not_reserved` constraint with a migration. Its current copy is in `supabase/schemas/tables/03_tenants.sql`. Otherwise a workspace could claim that slug.
4. Add a link in `src/components/shared/layout/app-sidebar.tsx`.
5. If a role shouldn't see it, update the checks in `src/lib/tenancy.ts` and `role-route-guard.tsx`, and enforce the rule in RLS.
6. Put the UI and logic in `src/features/<feature>/`.

### Add a new email

1. Add a template in `supabase/functions/email-jobs/`.
2. Add a handler for the new `kind` to `HANDLERS` in `email-jobs/index.ts`.
3. Insert the `email_jobs` row from the service or a trigger.
4. Deploy `email-jobs` **before** anything starts queuing the new kind. An unknown kind fails permanently.

### Add an environment variable

1. Add it to the schema in `src/config/env.ts` or `src/config/server-env.ts`.
2. Add it to `.env.example` and to this README.
3. Set it in every environment. `NEXT_PUBLIC_*` values are built into the app, so redeploy after changing them.

### Add an Edge Function

1. Create `supabase/functions/<name>/index.ts`.
2. Add its `verify_jwt` setting to `supabase/config.toml`. Only turn it off if the function checks the caller itself, as `paypal-webhook` does with PayPal signatures.
3. For a scheduled function, also check that the caller has `role = service_role`, because any valid user token passes `verify_jwt`.
4. Add its schedule in a migration, and raise an error when a Vault secret is missing. See `20260925130000_email_jobs_queue.sql`.

### Change a plan

- **Description, seat limit, SLA policy limit, and feature flags:** use `/platform/plans`.
- **Price or name:** these are read-only in the console. Change them with a migration, and update the plan in PayPal if the price changes.
- **New PayPal plan:** create it under the same PayPal product, then update `plans.code` with a migration.

## Testing

```bash
npm test             # Unit tests
npm run lint         # Lint
npm run build        # Type check and production build
npm run test:authz   # Needs Docker and `supabase start`
npm run test:e2e     # Needs Docker and `npm run e2e:stack`
```

| Suite         | Location                | Covers                                                                                                              |
| ------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Unit          | `src/**/*.test.ts`      | Tenancy routing, plan limits, and workspace status                                                                  |
| Authorization | `supabase/tests/authz/` | Attacks and legitimate flows, run as the real API roles                                                             |
| End-to-end    | `e2e/**/*.e2e.ts`       | Sign in, tickets, portal, roles, plan gates, console                                                                |
| Visual        | `e2e/**/visual.e2e.ts`  | Screenshots compared by Argos                                                                                       |
| Load          | `load/servicedesk.js`   | k6 read traffic on the local E2E stack: `npm run test:load -- smoke\|load\|stress\|spike`. See `docs/load-testing/` |

`test:authz` builds a throwaway database inside the local container and drops it afterwards. It never reads `.env.local` or contacts a hosted project.

```bash
# If Docker points at a dead context
DOCKER_CONTEXT=default npm run test:authz

# Leave a migration out, to confirm the attacks then succeed
AUTHZ_EXCLUDE=20261104120000 npm run test:authz
```

### End-to-end tests (Playwright)

The suite runs a production build against its own throwaway Supabase stack on ports 55xxx. It doesn't use `.env.local`: `playwright.config.ts` blanks every variable that file lists, refuses a non-local database, and never reuses a server already on port 3100. Your dev server and default local stack can keep running.

```bash
npx playwright install chromium   # First time only

npm run e2e:stack                 # Build the stack: migrations plus seed data
npm run test:e2e                  # Build the app and run everything
E2E_SKIP_BUILD=1 npm run test:e2e # Reuse the last build if the app hasn't changed

npx playwright test e2e/signed-in/tickets.e2e.ts  # One file
npx playwright test -g "internal note"            # By test name
npx playwright test --headed                      # Watch the browser
npm run test:e2e:ui                               # Interactive runner
npm run test:e2e:report                           # Last HTML report
npx playwright show-trace .e2e/results/<test>/trace.zip  # Debug a failure

npm run e2e:stack:stop            # Remove the stack and its data
```

Add `DOCKER_CONTEXT=default` in front of the stack commands if Docker points at a dead context. Rerun `npm run e2e:stack` after adding a migration, or to clear the tickets that test runs create.

When adding tests:

- Name files `*.e2e.ts`. Vitest would collect `*.spec.ts` and fail on it.
- Pick a saved session with `test.use({ storageState: sessionFile("proAdmin") })`. Accounts are listed in `e2e/support/accounts.ts`.
- Don't assert status 404 for `notFound()` on a page inside a layout. The shell has already streamed, so it answers 200. Check the screen instead.
- Don't add sign-ins per test. The app allows 10 attempts per IP in 5 minutes, and the setup project already uses 6.

Not covered: anything that needs PayPal, real email or Edge Functions, because that stack doesn't run them.

### Visual tests (Argos)

The `visual.e2e.ts` files take screenshots with `argosScreenshot`, and [Argos](https://app.argos-ci.com/tkarthick550/servicedesk) compares them against a baseline from your Git history. There's no CI for this, so send a build by hand:

```bash
npm run e2e:stack                                   # If the stack isn't running
npm run test:visual                                 # Build the app, take screenshots, upload
```

Put the project token in `.env.local` as `ARGOS_TOKEN`. The script sets `CI=true`, which is what turns on the upload. `npm run test:e2e` also takes the screenshots but sends nothing. Argos picks its baseline from commits, so commit your work before sending a build.

Never commit the token. When adding a screen:

- Add it to the table in `e2e/signed-in/visual.e2e.ts`, or `e2e/public/visual.e2e.ts` for signed-out pages. Each entry checks that the URL didn't redirect and that no error screen shows, so a broken page can't become the baseline.
- Use the `seed-juniper` workspace, which no other test writes to.
- Dates and relative times are replaced with `--` automatically. Use `figures` for totals that change, `mask` for rows whose order isn't fixed, and `element` for a dialog over a changing page.
- Compare two runs before sending a build. Any screen that differs between them will report a change on every build.

Automated tests cover the main UI flows but not Edge Functions. After changing billing, test the whole flow against the PayPal sandbox. After changing email, confirm that a real message arrives.

## Seed data

These scripts are for development only, and use the project in `.env.local`. For a non-local project, `seed-tenants.mjs` refuses to write unless you pass a matching `--project-ref`. Usage notes are at the top of each script.

```bash
# Preview, without writing anything
node --env-file=.env.local scripts/seed-tenants.mjs

# Create workspaces across every plan and subscription state
node --env-file=.env.local scripts/seed-tenants.mjs --apply --project-ref <ref>

# Remove everything the script created
node --env-file=.env.local scripts/seed-tenants.mjs --clean --project-ref <ref>

# Add invoices to test billing history pagination
node --env-file=.env.local scripts/seed-invoices.mjs --tenant <id-or-slug>
node --env-file=.env.local scripts/seed-invoices.mjs --clean
```

The data lives in `scripts/seed-data.mjs`: 15 **fictional** US companies, each with its own city, time zone, staff, two business customers, and 20 tickets with full conversation threads. No real company or person is used. `scripts/seed-data.test.mjs` checks that every address is undeliverable and every phone number is in the fictional `555-01xx` range, and that the data still matches what the e2e suite expects.

### Demo accounts

Every account uses the same password: `SEED_PASSWORD` if set when seeding, otherwise the default in `scripts/seed-tenants.mjs`. Use a strong `SEED_PASSWORD` for any deployed environment.

**Platform console:** the seed also creates `platform-admin@servicedesk-pro.com`, which belongs to no workspace, so signing in lands on `/platform`. Add it to `PLATFORM_ADMIN_EMAILS` to grant access. It never gets the shared seed password: set `PLATFORM_ADMIN_PASSWORD` before seeding, or the seed prints a random one once. `--clean` leaves it in place, and re-seeding doesn't change its password.

**Juniper Ridge Energy** (`/seed-juniper`, Business plan, Houston, TX). This is the best workspace for a full demo, because every feature is on:

| Role                              | Name              | Sign in as                               |
| --------------------------------- | ----------------- | ---------------------------------------- |
| Tenant Admin                      | David Russell     | `admin@juniper.seed.test`                |
| Manager                           | Emily Johnson     | `manager@juniper.seed.test`              |
| Agent                             | James Rodriguez   | `agent@juniper.seed.test`                |
| Billing Admin                     | Ashley Washington | `billing@juniper.seed.test`              |
| Customer (Gulf Coast Fabrication) | Jasmine Patel     | `jasmine.patel@gulfcoastfab.example`     |
| Customer (Bayou City Electric)    | Robert Hayes      | `robert.hayes@bayoucityelectric.example` |

**Cedar Health Group** (`/seed-cedar`, Pro plan, Boston, MA). Staff sign in as `admin@`, `manager@`, `agent@` and `billing@cedar.seed.test`, and customers as `dana.whitfield@northfieldclinic.example` and `marcus.bell@baysidept.example`.

**Bluepeak Software** (`/seed-bluepeak`, Free plan, Austin, TX). Staff sign in as `admin@` and `agent@bluepeak.seed.test`, and customers as `jordan.ellis@lakewaydental.example` and `priya.raman@hillcountryrealty.example`.

The other 12 workspaces cover the remaining plan and billing states (trial, past due, cancelled, expired). The seed command prints every login when it finishes.

Good to know:

- Existing seed tenants are skipped, so run `--clean` before `--apply` to rebuild them.
- Staff accounts use `*.seed.test` addresses and customers use `*.example`. Neither can receive mail. Seeded accounts carry a `seed_tenant` tag, which is how `--clean` finds them.
- Seeded PayPal IDs don't exist at PayPal, so changing plan or cancelling on a seeded workspace fails.
- Never list a seeded account in `PLATFORM_ADMIN_EMAILS` outside local and test stacks.

## Deployment

### Git workflow

Trunk-based. Feature branches merge into `main` through a pull request once CI passes. `main` is always deployable.

### Release order

GitHub Actions deploys every merge to `main` to the **development** environment. A release tag (`v1.2.3`) on a commit that has already deployed to development promotes that commit to **production**, after an approval. Each environment has its own Supabase project. Every deploy runs the CI checks, then `supabase db push`, then `supabase functions deploy`, then the app through the Vercel CLI, in that order, because new app code can depend on new database objects. Setup, releasing, hotfixes and rollback are in [docs/deployment.md](docs/deployment.md).

Migrations recorded as applied don't prove that a function was redeployed. The pipeline deploys every function on each run; check with `supabase functions list` if in doubt.

### New environment checklist

[docs/deployment.md](docs/deployment.md) covers setting up an environment: the GitHub environment, Vercel variables, the bootstrap workflow for seeds, and the dashboard-only steps (access token hook, Auth URLs, function and Vault secrets, PayPal plans and webhook). After it's up, create a workspace at `/setup`, then test a ticket, an email, and a payment.

## Operations and troubleshooting

### Where to look

| Question              | Where                                                                  |
| --------------------- | ---------------------------------------------------------------------- |
| App errors            | Sentry. `/api/sentry-test` throws a test error.                        |
| Overall health        | `/platform/health` and `/platform/logs`                                |
| Edge Function errors  | Supabase Dashboard, under Edge Functions logs                          |
| Scheduled job results | `cron.job_run_details`, and `net._http_response` for HTTP calls        |
| Email status          | `email_jobs` table                                                     |
| Billing state         | `subscriptions` and `invoices` tables, `/platform/billing`, and PayPal |
| Who changed something | `audit_logs` table, `/settings/audit`, and `/platform/audit-logs`      |

```sql
-- Recent scheduled job runs
select j.jobname, d.status, d.return_message, d.start_time
from cron.job_run_details d
join cron.job j using (jobid)
order by d.start_time desc
limit 20;

-- Email queue by state
select kind, status, count(*) from email_jobs group by 1, 2;
```

### Common problems

| Symptom                                      | Likely cause                                                                 | What to do                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Emails stay queued                           | Missing Vault secret, failing cron, or `email-jobs` not deployed             | Check `cron.job_run_details`, then the function logs             |
| Emails fail                                  | Expired `GOOGLE_REFRESH_TOKEN`, or `FROM_EMAIL` doesn't match the account    | Check `email_jobs` and the function logs, then renew the token   |
| Email buttons are missing                    | `FRONTEND_URL` isn't set                                                     | Set the secret                                                   |
| Plan changes don't apply at period end       | `reconcile-subscriptions` failing                                            | See [Known gaps](#known-gaps)                                    |
| Payment succeeded but the plan didn't change | Webhook not arriving, or wrong `PAYPAL_WEBHOOK_ID`                           | Check the PayPal webhook events and the `paypal-webhook` logs    |
| `PLAN_PRODUCT_NOT_COMPATIBLE`                | Paid plans under different PayPal products                                   | Move them under one product, then update `plans.code`            |
| User sees "unauthorized" or no tenant data   | Token has no tenant claims, because the hook is disabled or the token is old | Check the hook in Auth settings, then sign out and back in       |
| Role change has no effect yet                | Old token                                                                    | Wait for token refresh, or sign in again                         |
| SLA times are wrong                          | Wrong business hours time zone                                               | Check the policy's business hours                                |
| Sign-in redirects to the wrong place         | Auth redirect URL isn't allowed                                              | Add it in Auth settings, or `additional_redirect_urls` locally   |
| Logo or external resource doesn't load       | Blocked by the image allow list or Content Security Policy                   | Check `next.config.ts`, `src/lib/csp.ts` and the browser console |
| All tenants see the maintenance page         | Maintenance mode is on                                                       | Turn it off in `/platform/settings`, then allow about 10 seconds |
| `/platform` returns 404                      | Email isn't in `PLATFORM_ADMIN_EMAILS`                                       | Add it, then redeploy or restart                                 |
| `test:authz` says the container wasn't found | Local stack isn't running, or Docker is on another context                   | Run `supabase start`, or set `DOCKER_CONTEXT=default`            |

## Known gaps

Check these before relying on the related feature. This list was last reviewed on 2026-11-05.

| Gap                  | Details                                                                                                                                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing migration    | `config.toml` cites migration `20260918120000`, which isn't in the repository. Check production's history before its first pipeline deploy; see [docs/deployment.md](docs/deployment.md). (The reconcile job itself is now scheduled with bearer auth by `20261112110000`.) |
| Plan feature flags   | `features_json` entries are mostly plan page labels and aren't all enforced. Search the code before relying on a flag.                                                                                                                                                      |
| Routes without pages | `TENANT_ROUTES` lists routes with no page yet, including `/kb`, `/macros`, and several `/settings/*` paths.                                                                                                                                                                 |
| Generated types      | `database.types.ts` has been edited by hand in the past, so regenerating can produce unrelated changes.                                                                                                                                                                     |

## More documentation

| Document                                                                      | Use it for                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------- |
| [Security architecture](docs/security/security-architecture.md)               | System design and trust boundaries          |
| [Security assessment](docs/security/application-security-assessment.md)       | Detailed findings                           |
| [Remediation tracker](docs/security/security-remediation-tracker.md)          | Status of each finding. Next ID: `SEC-036`. |
| [Security testing methodology](docs/security/security-testing-methodology.md) | How security testing is done                |
| [Tenant isolation tests](docs/security/tenant-isolation-tests.md)             | Isolation test cases                        |
| [PayPal card metadata](docs/paypal-card-metadata.md)                          | How cards are taken, and what data exists   |
| [Code reviews](docs/reviews/)                                                 | Past reviews and their fix tracking tables  |
