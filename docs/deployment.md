# Deployment

Trunk-based, with tag promotion. Deploys run from GitHub Actions; nobody deploys from a laptop.

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

## One-time setup

### 1. GitHub environments, branch and tag rules

In **Settings → Environments**, create:

- **`development`**: under deployment branches and tags, allow the branch `main`.
- **`production`**: under deployment branches and tags, allow tags matching `v*` only. Add required reviewers, so every production deploy waits for an approval.

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

In **Settings → Rules → Rulesets**:

- **Branch ruleset for `main`:** require a pull request and the `Lint, types, tests, build`, `Authorization suite` and `Dependency and secret scan` checks, and block force pushes and deletion.
- **Tag ruleset for `v*`:** restrict creation, update and deletion to maintainers, so only they can release, and a release tag can't be moved after the fact.

### 2. Vercel

Set the app variables (see the README's environment variables section) in the Vercel project:

- **Production:** the production Supabase URL and keys, the production site URL, live PayPal, and the production Sentry environment.
- **Preview, scoped to the `main` branch:** the development Supabase URL and keys, the development site URL, PayPal sandbox values, and a separate Sentry environment.

The workflow pulls these with `vercel pull --environment=preview --git-branch=main` for development, and `--environment=production` for a release. If PR previews are on, unscoped Preview variables apply to them. Point those at the development project, never production. A preview runs the PR's code before its migrations are applied, so expect schema-changing PRs to look broken there.

### 3. The development Supabase project

1. Create the project, and add its values to the `development` environment (step 1).
2. Merge to `main` (or run the Deploy workflow on `main`). The deploy builds the whole schema from the migrations. This works from an empty database since migration `20260810045832` records the platform's default grants, and `20260831162650` was made safe to re-run.
3. Run **Actions → Bootstrap development database**.
4. In the dev project's dashboard, do the steps the CLI can't:
   - Enable the custom access token hook (`public.custom_access_token_hook`) under Auth → Hooks. Tenant claims and RLS depend on it.
   - Set the Auth site URL and redirect URLs to the dev domain.
   - Set function secrets with `supabase secrets set --project-ref <dev ref> ...` (README, "Edge Functions"). Use **PayPal sandbox** credentials, and a **test Gmail account**, so development can't email real people or take real payments.
   - Create the Vault secrets the cron jobs read: `service_role_key`, `email_jobs_url`, `reconcile_subscriptions_url` and `portal_storage_sweep_url` (README, "Scheduled jobs").
   - Create sandbox PayPal plans under one product, and update `plans.code` in the dev database to match. The seed has production plan IDs.
   - Register the dev `paypal-webhook` URL with PayPal sandbox, and set `PAYPAL_WEBHOOK_ID`.
5. Optionally load demo data: `node --env-file=<dev env file> scripts/seed-tenants.mjs --apply --project-ref <dev ref>`.

### 4. Before the first production release

Run this once from a machine with production access, and read the output:

```bash
supabase link --project-ref <production ref>
supabase migration list
```

Every version listed as applied on the remote must exist in `supabase/migrations/`. `supabase/config.toml` mentions `20260918120000`, which is not in this repository. If production has it, the dry-run step will stop the first release. Decide what that migration was before using `supabase migration repair`; don't repair it blind.

### 5. Retire `develop`

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
