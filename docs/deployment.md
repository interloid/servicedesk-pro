# Deployment

Trunk-based, with tag promotion. Deploys run from GitHub Actions; nobody deploys from a laptop.

This guide covers all three environments (local, development and production), where their secrets live, how Vercel deploys through GitHub Actions, and how to release and roll back.

```
feature/x ──PR──► main ──automatic──► development
                    │
              tag v1.4.0 ──approval──► production   (same commit, rebuilt for production)
```

| Trigger          | GitHub environment | Supabase project         | App (Vercel)                         |
| ---------------- | ------------------ | ------------------------ | ------------------------------------ |
| Merge to `main`  | `development`      | separate dev project     | Preview deployment, optional alias   |
| Tag `vX.Y.Z`     | `production`       | production project       | Production deployment                |
| Pull request     | none               | none (CI only)           | Vercel's own PR previews, if enabled |
| Developer laptop | none               | local (`supabase start`) | `npm run dev`                        |

Development and production always run the same history: production is an earlier point of `main`, never a separate branch. Every migration reaches development first, in the same order production will get it.

## What runs

- **`.github/workflows/ci.yml`** runs on every pull request: lint, format, type check, unit tests, production build (with placeholder values), the authorization suite (`npm run test:authz`), `npm audit --omit=dev --audit-level=high`, and a TruffleHog secret scan.
- **`.github/workflows/deploy.yml`**:
  - **Push to `main`:** runs the CI checks, then deploys to development.
  - **Push of a `v*` tag:** first checks that the tag looks like `v1.2.3`, that its commit is on `main`, and that the commit has a successful development deployment. Then it runs the CI checks, waits for approval on the `production` environment, and deploys to production.
  - **Each deploy, in order:** `supabase migration list` and `supabase db push --dry-run` (these stop before anything changes if the project has migrations this commit doesn't), then `supabase db push`, then `supabase functions deploy`, then the app, built and deployed with the Vercel CLI.
  - **Vercel's own Git deploys** are off for `main` (`vercel.json`), so new app code never goes live before its migration. Tags never trigger Vercel by themselves.
  - **One deploy per environment at a time**, and a running deploy is never cancelled.
- **`.github/workflows/bootstrap-development.yml`** is run once, by hand, for a new development project. It loads plans, time zones and storage buckets, which `db push` never runs. It refuses the production project and does nothing if plans already exist.

## Where secrets live

For deployed environments, **the GitHub environment is the one place to set values**. Every deploy copies the app variables into Vercel and the Edge Function secrets into Supabase (`scripts/ci/sync-env.mjs`), so nobody edits them in the Vercel or Supabase dashboards. A value edited there is overwritten by the next deploy.

GitHub never shows a secret again after it's saved, so the master copy of every value is kept in the team password manager, in one vault per environment: a Local/Dev vault (sandbox and test credentials, shared with all developers) and a Production vault (as few people as possible). Update a value there first, then in GitHub, then run **Actions → Deploy**. Never commit a secret; every `.env` file except `.env.example` is git-ignored.

| What                                                                                                                                                              | Local                                         | Development                                                                     | Production                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| App variables: `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_MANAGEMENT_TOKEN`, `PLATFORM_ADMIN_EMAILS`, Sentry, PayPal client ID | `.env.local`, from `supabase start`           | GitHub → Environments → `development` (synced to Vercel Preview, branch `main`) | GitHub → Environments → `production` (synced to Vercel Production) |
| Edge Function secrets: `PAYPAL_*`, `GOOGLE_*`, `FROM_EMAIL`, `FRONTEND_URL`                                                                                       | `.env.local`, group 7                         | GitHub → Environments → `development` (synced to the dev project)               | GitHub → Environments → `production` (synced to the prod project)  |
| Cron secrets: `service_role_key`, `email_jobs_url`, `reconcile_subscriptions_url`, `portal_storage_sweep_url`                                                     | Local Vault, only if you run the crons        | Dev project → Vault                                                             | Prod project → Vault                                               |
| Deploy credentials: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `VERCEL_TOKEN`, `SUPABASE_DB_URL` (dev only)                                                 | Not needed                                    | GitHub → Environments → `development`                                           | GitHub → Environments → `production`                               |
| Auth provider settings (Google sign-in, SMTP)                                                                                                                     | Shell variables when running `supabase start` | Dev project → Authentication                                                    | Prod project → Authentication                                      |

Rules:

- Developers never hold production secrets. Local work uses local Supabase; shared testing uses development, with PayPal **sandbox** and a **test** Gmail account.
- No key is shared between environments, so a leak in development can't reach production.
- Anything marked secret below goes in GitHub **secrets**, never **variables**: variables are printed in logs. The deploy refuses a secret stored as a variable.
- The service-role key bypasses all row-level security. Keep it server-side only (never in a `NEXT_PUBLIC_` variable), in Vercel, Supabase Vault and Edge Functions.

### Values per GitHub environment

Set each of these in both `development` and `production`, with that environment's values. The deploy stops before changing anything if a required one is missing, and lists every missing name.

| Name                                                                                                                                 | Kind     | Required | Goes to        |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------- | -------------- |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `VERCEL_TOKEN`                                                                      | Secret   | Yes      | The deploy     |
| `SUPABASE_PROJECT_REF`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`                                                                         | Variable | Yes      | The deploy     |
| `APP_DOMAIN_ALIAS` (development only)                                                                                                | Variable | No       | The deploy     |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_DOMAIN`, `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_SITE_DESCRIPTION`                            | Variable | Yes      | Vercel         |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                                                          | Variable | Yes      | Vercel         |
| `SUPABASE_SERVICE_ROLE_KEY`                                                                                                          | Secret   | Yes      | Vercel         |
| `NEXT_PUBLIC_TWITTER_HANDLE`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Variable | No       | Vercel         |
| `PLATFORM_ADMIN_EMAILS`                                                                                                              | Either   | No       | Vercel         |
| `SUPABASE_MANAGEMENT_TOKEN`, `SENTRY_AUTH_TOKEN`                                                                                     | Secret   | No       | Vercel         |
| `PAYPAL_BASE_URL`, `PAYPAL_CLIENT_ID`, `PAYPAL_WEBHOOK_ID`, `GOOGLE_CLIENT_ID`, `FROM_EMAIL`, `FRONTEND_URL`                         | Variable | Yes      | Edge Functions |
| `PAYPAL_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`                                                               | Secret   | Yes      | Edge Functions |

`SUPABASE_PROJECT_REF` also reaches the app. The deploy also checks that `NEXT_PUBLIC_SUPABASE_URL` belongs to `SUPABASE_PROJECT_REF`, and that development never uses live PayPal. An optional value left empty in GitHub is left as it is in Vercel. To change a value, edit it in GitHub and run **Actions → Deploy** (on `main` for development, on the release tag for production).

## 1. Local setup (each developer)

1. Install Node 24 (`nvm use` reads `.nvmrc`), Docker Desktop, the Supabase CLI, and PostgreSQL 15+ (for `npm run test:authz`).
2. Clone the repository, then run `npm install`.
3. Run `supabase start`. It prints a local API URL, an anon key and a service-role key. These are local-only and harmless.
4. Run `cp .env.example .env.local`, then set `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and the two keys from step 3. Leave PayPal, Sentry and the others empty, or use the **sandbox** values from the Local/Dev vault.
5. Make sure there is no `.env` holding hosted keys. Next.js loads `.env` as well as `.env.local`, so a leftover file with production keys makes local runs write to production.
6. Optional, Edge Functions: fill group 7 of `.env.local` with sandbox PayPal and test Gmail values, then run `supabase functions serve --env-file .env.local`.
7. Optional, demo data: run `node --env-file=.env.local scripts/seed-tenants.mjs --apply --project-ref <project_id from supabase/config.toml>`.
8. Run `npm run dev`. The app is at http://localhost:3000, and local email lands at http://127.0.0.1:54324.
9. Before opening a pull request, run `npm run lint`, `npm test` and `npm run test:authz`.

## 2. Development setup (deployed from `main`)

### A. Supabase project

1. In the Supabase dashboard, create a project (for example `servicedesk-dev`) in the same region as production.
2. Save these to the Local/Dev vault: the project ref, the database password, the anon key, the service-role key, and the **session pooler** connection string (from the **Connect** button).

### B. GitHub `development` environment

1. Go to **Settings → Environments → New environment** and name it `development`.
2. Under **Deployment branches and tags**, choose "Selected branches and tags" and add the branch `main`.
3. Add these **secrets**, plus the secret app and function values from [Values per GitHub environment](#values-per-github-environment):
   - `SUPABASE_ACCESS_TOKEN`: from Supabase **Account → Access Tokens**, ideally created by a dedicated deploy account.
   - `SUPABASE_DB_PASSWORD`: the dev database password.
   - `SUPABASE_DB_URL`: the dev session pooler connection string, used only by the bootstrap workflow.
   - `VERCEL_TOKEN`: see [section 4](#4-vercel-deploys-through-github-actions).
4. Add these **variables**, plus the public app and function values from the same table:
   - `SUPABASE_PROJECT_REF`: the dev project ref.
   - `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`: see section 4.
   - `PRODUCTION_PROJECT_REF`: the production ref, so the bootstrap workflow can refuse it.
   - `APP_DOMAIN_ALIAS` (optional): a fixed dev domain such as `dev.example.com`, added in Vercel first.

### C. Development values

All of these go in the GitHub `development` environment; the deploy writes them to Vercel **Preview, branch `main`**, and to the dev project's Edge Function secrets:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, from the dev project.
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_DOMAIN` and `FRONTEND_URL`, set to the dev domain.
- `NEXT_PUBLIC_SITE_NAME` and `NEXT_PUBLIC_SITE_DESCRIPTION`.
- PayPal **sandbox**: `PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` and `PAYPAL_WEBHOOK_ID`, and the same client ID as `NEXT_PUBLIC_PAYPAL_CLIENT_ID`.
- A **test** Gmail account: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` and `FROM_EMAIL`.
- `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN`, pointing at a separate Sentry environment or project.
- `PLATFORM_ADMIN_EMAILS`, set to a real admin's login, never a seeded demo account.

Unscoped Preview variables in Vercel (used by pull-request previews) aren't touched by the deploy. If pull-request previews are on, unscoped Preview variables apply to them. Point those at the dev project, never production. A preview runs the PR's code before its migrations are applied, so expect schema-changing PRs to look broken there.

### D. First deploy and one-time database setup

1. Merge to `main`, or run **Actions → Deploy** on `main`. The deploy builds the whole schema from the migrations. This works from an empty database because migration `20260810045832` records the platform's default grants and `20260831162650` was made safe to re-run.
2. Run **Actions → Bootstrap development database** to load plans, time zones and buckets.
3. In the dev Supabase dashboard:
   - Under **Authentication → Hooks**, enable "Customize Access Token" with `public.custom_access_token_hook`. Tenant claims and RLS depend on it.
   - Under **Authentication → URL Configuration**, set the site URL and the redirect URLs to the dev domain.
   - In the **SQL editor**, create the Vault secrets once:
     ```sql
     select vault.create_secret('<dev service role key>', 'service_role_key');
     select vault.create_secret('https://<dev-ref>.supabase.co/functions/v1/email-jobs', 'email_jobs_url');
     select vault.create_secret('https://<dev-ref>.supabase.co/functions/v1/reconcile-subscriptions', 'reconcile_subscriptions_url');
     select vault.create_secret('https://<dev-ref>.supabase.co/functions/v1/portal-storage-sweep', 'portal_storage_sweep_url');
     ```
4. In PayPal **sandbox**:
   1. Create the plans under one product.
   2. Update `plans.code` in the dev database to the sandbox plan IDs (the seed has production IDs).
   3. Register `https://<dev-ref>.supabase.co/functions/v1/paypal-webhook` as the webhook URL.
   4. Set `PAYPAL_WEBHOOK_ID` in the GitHub `development` environment, then run **Actions → Deploy** on `main`.
5. Optional: load demo data with `node --env-file=<dev env file> scripts/seed-tenants.mjs --apply --project-ref <dev ref>`.
6. Check it end to end: open the dev URL, create a workspace at `/setup`, raise a ticket, confirm the email reaches the test inbox, and make a sandbox payment.

## 3. Production setup (deployed by release tags)

### A. GitHub `production` environment

1. Go to **Settings → Environments → New environment** and name it `production`.
2. Under **Deployment branches and tags**, add the tag pattern `v*` only.
3. Turn on **Required reviewers**, so every production deploy waits for an approval.
4. Add every secret and variable from [Values per GitHub environment](#values-per-github-environment), with production values: the production project, live PayPal (`PAYPAL_BASE_URL=https://api-m.paypal.com`), the real Gmail account, the production site URL and the production Sentry environment. Don't add `SUPABASE_DB_URL` here.

### B. Repository rules

In **Settings → Rules → Rulesets**, create two rulesets:

- **Branch `main`:** require a pull request and the `Lint, types, tests, build`, `Authorization suite` and `Dependency and secret scan` checks, and block force pushes and deletion.
- **Tags `v*`:** restrict creation, update and deletion to maintainers, so only they can release and a release tag can't be moved afterwards.

### C. Vercel Production variables

Nothing to set by hand. Each production deploy writes the `production` environment's app values to Vercel **Production**. A Vercel variable shared across environments (for example "All Environments") is split: production gets its own copy, and the others keep the old value.

### D. Prepare the production Supabase project

The first release switches the live app to the production project as soon as it deploys, because it writes the `production` values to Vercel. So the project must be complete **before** the first tag. Do this once, from a trusted machine with the Production vault:

1. Create the project in the same region as development, and save its ref, database password, anon key and service-role key to the Production vault.
2. Build the schema, and read the output of each command:
   ```bash
   supabase link --project-ref <production ref>
   supabase migration list    # a new project lists nothing on the remote
   supabase db push
   ```
3. In the **SQL editor**, run the contents of `supabase/schemas/seeds/01_plans_seed.sql`, `supabase/schemas/seeds/02_timezone_seed.sql` and `supabase/schemas/storage/buckets.sql`, in that order. `db push` never runs them.
4. Under **Authentication → Hooks**, enable "Customize Access Token" with `public.custom_access_token_hook`. Under **Authentication → URL Configuration**, set the production site URL and redirect URLs. Configure SMTP and Google sign-in if you use them.
5. Create the Vault secrets, as in [development step D3](#d-first-deploy-and-one-time-database-setup), with the production ref and service-role key. Migration `20261112110000` reschedules the reconcile job with `service_role_key` and `reconcile_subscriptions_url`.
6. In PayPal **live**, confirm that `plans.code` matches your live plan IDs, register `https://<production ref>.supabase.co/functions/v1/paypal-webhook` as the webhook URL, and put its ID in the GitHub `production` environment as `PAYPAL_WEBHOOK_ID`.

### E. Existing projects and migration history

Before a project's first deploy from this workflow, run `supabase migration list` against it. Every version listed as applied on the remote must exist in `supabase/migrations/`. `supabase/config.toml` mentions `20260918120000`, which is not in this repository. If a project has it, the dry-run step stops the deploy. Decide what that migration was before using `supabase migration repair`; don't repair it blind.

### F. First release

Follow [Releasing to production](#releasing-to-production) below. Afterwards, run these checks:

1. Run `select status_code from net._http_response order by created desc limit 20;` and confirm 200s from `reconcile-subscriptions` after the next hourly run.
2. Upload an avatar.
3. Assign a ticket.
4. Sign in as a customer.

## 4. Vercel deploys through GitHub Actions

GitHub Actions builds and deploys the app with the Vercel CLI, after the database and functions are updated. `vercel.json` turns off Vercel's own automatic deploys for `main`, so Vercel never builds code before its migration has run. Tags never trigger Vercel by themselves.

### One-time setup

1. **Token:** in Vercel, go to **Account Settings → Tokens → Create**. Scope the token to the team and give it an expiry. Add it to both GitHub environments as `VERCEL_TOKEN`.
2. **Project and team IDs:** in the repository, run `npx vercel link` and choose the existing project. It writes `.vercel/project.json` (git-ignored) containing `orgId` and `projectId`. Add these to both GitHub environments as `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`.
3. **Variables:** set nothing in Vercel. Each deploy writes the GitHub environment's app values to Vercel: Production for a release, Preview scoped to `main` for development. The token needs access to the project's environment variables, which a team-scoped token has.
4. **Domains:** in **Project → Settings → Domains**, assign the production domain to Production. For development, add the dev domain to the project without assigning it, then set `APP_DOMAIN_ALIAS` in the `development` environment. Each development deploy points that domain at the new build.
5. **Git connection:** leave the repository connected. `vercel.json` stops automatic deploys of `main`; pull-request previews (if enabled) still work.

### What the workflow does

| Step                        | Development (push to `main`)                          | Production (tag `v*`)                                                                         |
| --------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Sync variables from GitHub  | Preview, branch `main`                                | Production                                                                                    |
| Pull settings and variables | `vercel pull --environment=preview --git-branch=main` | `vercel pull --environment=production`                                                        |
| Build on the GitHub runner  | `vercel build --environment=preview`                  | `vercel build --environment=production`                                                       |
| Upload and publish          | `vercel deploy --prebuilt --environment=preview`      | `vercel deploy --prebuilt --environment=production`, which goes live on the production domain |
| Domain                      | `vercel alias set <url> $APP_DOMAIN_ALIAS`, if set    | The production domain, automatically                                                          |

The app is built separately for each environment from the same commit, because the Supabase URL and keys are compiled into the build.

## 5. Retire `develop`

The old `develop` branch is no longer deployed. Merge anything still on it into `main` through a pull request, then delete it.

## Day to day

### Shipping a change

1. Branch from `main`, open a PR, and merge when CI passes. Development updates automatically.
2. Test on development.

### Releasing to production

When development looks right, tag the commit that's on it. Use the latest `main` commit, or an earlier one whose development deploy succeeded:

```bash
git switch main && git pull
git tag -a v1.4.0 -m "v1.4.0"
git push origin v1.4.0
```

Then approve the deploy under **Actions → Deploy**. Use semantic versions: patch for fixes, minor for features, major for breaking changes. A GitHub release can be drafted from the tag for release notes.

Work that's merged but not ready for clients goes out with the next tag. Keep it behind a feature flag, or don't merge it yet.

### Hotfix

Hotfixes go through `main` like everything else, so production never runs a commit that development didn't:

1. Fix it in a PR into `main`, and merge. Development deploys it.
2. Check it on development, then tag a patch version (`v1.4.1`) and approve.

If `main` already holds work that mustn't reach clients yet, keep that work behind a feature flag (the normal case), or revert it in a PR, release the fix, then restore it in a follow-up PR. The release check deliberately refuses tags that aren't on `main`, so there is no side route to production.

### Rolling back

- **App, fastest:** in Vercel, promote the previous production deployment (Deployments → ⋯ → Promote to Production).
- **App, from the pipeline:** run **Actions → Deploy** on the previous tag with **"App only"** ticked. That skips migrations and functions; an older commit can't run `db push` against a newer schema anyway. Use it only for rollbacks, never to release a new tag.
- **Database:** there are no down migrations. Write a new migration that undoes the change, merge it, and release it like any other change.
- **Edge Functions:** revert the commit on `main` and release, or run `supabase functions deploy <name>` from the previous tag.

## Migrations

- Migrations are forward-only. Name new ones later than every existing one; with one trunk, that's simply "newer than what's on `main`".
- Every migration runs on development before production, from the same commit, in the same order.
