# Deployment

Deploys run from GitHub Actions. Nobody deploys from a laptop.

| Branch    | GitHub environment | Supabase project     | App (Vercel)                         |
| --------- | ------------------ | -------------------- | ------------------------------------ |
| `main`    | `production`       | production project   | Production deployment                |
| `develop` | `development`      | separate dev project | Preview deployment, optional alias   |
| PRs       | none               | none (CI only)       | Vercel's own PR previews, if enabled |

## What runs

- **`.github/workflows/ci.yml`** runs on every pull request: lint, format, type check, unit tests, production build (with placeholder values), the authorization suite (`npm run test:authz`), `npm audit --omit=dev --audit-level=high`, and a TruffleHog secret scan.
- **`.github/workflows/deploy.yml`** runs on every push to `main` or `develop`, in this order. A failed step stops everything after it.
  1. The CI checks above.
  2. `supabase migration list` and `supabase db push --dry-run`. These fail before anything changes if the project has migrations this repository doesn't.
  3. `supabase db push`.
  4. `supabase functions deploy` (all functions, with `verify_jwt` from `supabase/config.toml`).
  5. The app, built and deployed with the Vercel CLI.

  Vercel's own Git deploys are switched off for `main` and `develop` in `vercel.json`, so new app code never goes live before its migration. Deploys on one branch never run in parallel, and a running deploy is never cancelled.

- **`.github/workflows/bootstrap-development.yml`** is run once, by hand, for a new development project. It loads plans, time zones and storage buckets, which `db push` never runs. It refuses the production project and does nothing if plans already exist.

## One-time setup

### 1. GitHub environments

In **Settings → Environments**, create:

- **`production`**: under deployment branches, allow `main` only. Add yourself (or a teammate) as a required reviewer, so each production deploy waits for an approval.
- **`development`**: under deployment branches, allow `develop` only.

Add these to each environment:

| Name                    | Kind     | Value                                                                                          |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | secret   | A Supabase access token (Account → Access Tokens). Prefer one from a dedicated deploy account. |
| `SUPABASE_DB_PASSWORD`  | secret   | That environment's database password                                                           |
| `SUPABASE_PROJECT_REF`  | variable | That environment's project ref                                                                 |
| `VERCEL_TOKEN`          | secret   | A Vercel token scoped to the team                                                              |
| `VERCEL_ORG_ID`         | variable | From `.vercel/project.json` after `vercel link`, or the team settings                          |
| `VERCEL_PROJECT_ID`     | variable | Same                                                                                           |

Development only:

| Name                     | Kind     | Value                                                                                     |
| ------------------------ | -------- | ----------------------------------------------------------------------------------------- |
| `SUPABASE_DB_URL`        | secret   | The dev project's session pooler connection string, for the bootstrap workflow only       |
| `PRODUCTION_PROJECT_REF` | variable | The production ref, so the bootstrap workflow can refuse it                               |
| `APP_DOMAIN_ALIAS`       | variable | Optional fixed domain for the dev app, such as `dev.example.com` (add it in Vercel first) |

In **Settings → Branches**, protect `main` and `develop`. Require a pull request and the `Lint, types, tests, build`, `Authorization suite` and `Dependency and secret scan` checks.

### 2. Vercel

Set the app variables (see the README's environment variables section) per environment in the Vercel project:

- **Production:** the production Supabase URL and keys, and the production site URL.
- **Preview, scoped to the `develop` branch:** the development Supabase URL and keys, the development site URL, PayPal sandbox values, and a separate Sentry environment.

The workflow pulls these with `vercel pull --environment=preview --git-branch=develop`. So unscoped Preview variables also reach `develop` unless a branch-scoped one overrides them.

### 3. The development Supabase project

1. Create the project, and add its values to the `development` environment (step 1).
2. Push or merge to `develop`. The deploy builds the whole schema from the migrations. This works from an empty database since migration `20260810045832` records the platform's default grants and `20260831162650` was made safe to re-run.
3. Run **Actions → Bootstrap development database**.
4. In the dev project's dashboard, do the steps the CLI can't:
   - Enable the custom access token hook (`public.custom_access_token_hook`) under Auth → Hooks. Tenant claims and RLS depend on it.
   - Set the Auth site URL and redirect URLs to the dev domain.
   - Set function secrets with `supabase secrets set --project-ref <dev ref> ...` (README, "Edge Functions"). Use **PayPal sandbox** credentials, and a **test Gmail account**, so the dev environment can't email real people or take real payments.
   - Create the Vault secrets the cron jobs read: `service_role_key`, `email_jobs_url`, `reconcile_subscriptions_url` and `portal_storage_sweep_url` (README, "Scheduled jobs").
   - Create sandbox PayPal plans under one product, and update `plans.code` in the dev database to match. The seed has production plan IDs.
   - Register the dev `paypal-webhook` URL with PayPal sandbox, and set `PAYPAL_WEBHOOK_ID`.
5. Optionally load demo data: `node --env-file=<dev env file> scripts/seed-tenants.mjs --apply --project-ref <dev ref>`.

### 4. Before the first production deploy

Run this once from a machine with production access, and read the output:

```bash
supabase link --project-ref <production ref>
supabase migration list
```

Every version listed as applied on the remote must exist in `supabase/migrations/`. `supabase/config.toml` mentions `20260918120000`, which is not in this repository. If production has it, the dry-run step will stop the first deploy. Decide what that migration was before using `supabase migration repair`; don't repair it blind.

## Day to day

- Work on a feature branch, open a PR into `develop`, and merge when CI passes. That deploys to development.
- Open a PR from `develop` into `main`, and merge. The production deploy waits for the environment approval, then runs.
- Migrations are forward-only. Name new ones later than every existing one, or `db push` refuses them on an environment that already has newer versions.

## Rolling back

- **App:** in Vercel, promote the previous production deployment (Deployments → ⋯ → Promote), or revert the commit on `main`.
- **Database:** there are no down migrations. Write a new migration that undoes the change, and merge it the normal way.
- **Edge Functions:** revert the commit and let the pipeline redeploy, or run `supabase functions deploy <name>` from the previous commit.
