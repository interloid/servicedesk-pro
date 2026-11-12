/**
 * Nightly reset of the public development demo. Puts the project back to what
 * scripts/seed-tenants.mjs creates, minus anything a visitor is still using:
 *
 *   1. Visitor workspaces (any slug not starting seed-) created more than the
 *      grace period ago are deleted. Every public table cascades from
 *      public.tenants, so one delete per workspace removes its tickets,
 *      customers, memberships, invoices, subscriptions and the rest.
 *   2. Their Storage objects are removed (Storage does not cascade): everything
 *      under `<tenant id>/` in the ticket-attachments, avatars, branding and
 *      invoices buckets.
 *   3. seed-tenants.mjs --clean deletes the seeded workspaces and accounts,
 *      with whatever visitors changed in them; their Storage objects go too.
 *   4. Auth users that now belong to no workspace are deleted, except seeded
 *      accounts, platform admins, the keep-list and accounts created inside
 *      the grace period.
 *   5. seed-tenants.mjs --apply rebuilds the seeded workspaces.
 *
 * Dry run (default; reads only, prints what would go):
 *   node --env-file=.env.local scripts/demo-reset.mjs
 *
 * Reset:
 *   node --env-file=.env.local scripts/demo-reset.mjs --apply --project-ref <ref>
 *
 * Options:
 *   --grace-hours <n>  keep workspaces and accounts younger than this
 *                      (default DEMO_RESET_GRACE_HOURS, else 2)
 *   --list             also print the addresses of accounts to delete (never
 *                      used by the workflow, whose logs are shared)
 *
 * Settings (environment):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   DEMO_RESET_ALLOWED=true   required, even for a dry run
 *   SUPABASE_PROJECT_REF      must match the URL on a hosted project
 *   PRODUCTION_PROJECT_REF    optional; refused if it matches
 *   PLATFORM_ADMIN_EMAILS     kept
 *   DEMO_RESET_KEEP_EMAILS    kept: addresses and @domain entries
 *   SEED_PASSWORD, PLATFORM_ADMIN_PASSWORD  for the rebuild (seed-guard.mjs
 *                             rules), checked before anything is deleted
 *
 * Rules are in scripts/demo-reset-plan.mjs. Nothing printed here includes a
 * password, and addresses are only printed with --list.
 *
 * PayPal: deleting a workspace never calls PayPal. In development that's the
 * sandbox, so a visitor's sandbox subscription is simply left behind there.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  TENANT_BUCKETS,
  checkTarget,
  chunk,
  parseGraceHours,
  parseKeepList,
  planUsers,
  planWorkspaces,
  summaryMarkdown,
} from "./demo-reset-plan.mjs";
import { PLATFORM_ADMIN_EMAIL, SLUG_PREFIX } from "./seed-data.mjs";
import {
  MIN_HOSTED_PASSWORD_LENGTH,
  resolveSeedPasswords,
} from "./seed-guard.mjs";

const PAGE = 1000;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);
const apply = has("apply");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function refuse(problems) {
  console.error(
    `Refusing to run the demo reset:\n` +
      problems.map((problem) => `  - ${problem}`).join("\n") +
      `\nNothing was changed.`,
  );
  process.exit(1);
}

if (!url || !serviceKey) {
  refuse(["NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set."]);
}

const target = checkTarget(url, process.env, {
  apply,
  projectFlag: flag("project-ref"),
});
const grace = parseGraceHours(
  flag("grace-hours") ?? process.env.DEMO_RESET_GRACE_HOURS,
);
if (target.errors.length > 0 || grace.error) {
  refuse([...target.errors, ...(grace.error ? [grace.error] : [])]);
}

const { projectRef, hosted } = target;
const graceHours = grace.hours;

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

/** Every row, a page at a time: a short read would make members look orphaned. */
async function selectAll(build, label) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const page = await must(build().range(from, from + PAGE - 1), label);
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

async function listAllUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`listUsers: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 200) return users;
  }
}

/** Memberships and portal-customer links into the given workspaces. */
async function linksInto(tenantIds) {
  const links = [];
  for (const ids of chunk(tenantIds, 100)) {
    const memberships = await selectAll(
      () =>
        supabase
          .from("memberships")
          .select("user_id, tenant_id")
          .in("tenant_id", ids)
          .order("id"),
      "memberships",
    );
    const customers = await selectAll(
      () =>
        supabase
          .from("customers")
          .select("portal_user_id, tenant_id")
          .in("tenant_id", ids)
          .not("portal_user_id", "is", null)
          .order("id"),
      "customers",
    );
    links.push(
      ...memberships,
      ...customers.map((c) => ({
        user_id: c.portal_user_id,
        tenant_id: c.tenant_id,
      })),
    );
  }
  return links;
}

/** Every object path under `prefix`, walking folders (list() isn't recursive). */
async function listObjects(bucket, prefix) {
  const paths = [];
  for (let offset = 0; ; offset += PAGE) {
    const items = await must(
      supabase.storage.from(bucket).list(prefix, { limit: PAGE, offset }),
      `list ${bucket}/${prefix}`,
    );
    for (const item of items) {
      const path = `${prefix}/${item.name}`;
      // Folders come back without an id.
      if (item.id === null) paths.push(...(await listObjects(bucket, path)));
      else paths.push(path);
    }
    if (items.length < PAGE) return paths;
  }
}

/** Removes every object a workspace owns. Returns the number removed. */
async function purgeStorage(tenantIds) {
  let removed = 0;
  for (const bucket of TENANT_BUCKETS) {
    for (const tenantId of tenantIds) {
      const paths = await listObjects(bucket, tenantId);
      for (const batch of chunk(paths, 100)) {
        await must(
          supabase.storage.from(bucket).remove(batch),
          `remove from ${bucket}`,
        );
        removed += batch.length;
      }
    }
  }
  return removed;
}

async function countObjects(tenantIds) {
  let count = 0;
  for (const bucket of TENANT_BUCKETS) {
    for (const tenantId of tenantIds) {
      count += (await listObjects(bucket, tenantId)).length;
    }
  }
  return count;
}

/**
 * memberships.invited_by and tickets.assignee_user_id have no ON DELETE
 * action, so a reference from a surviving workspace would block deleteUser.
 */
async function releaseReferences(userIds) {
  for (const ids of chunk(userIds, 100)) {
    await must(
      supabase
        .from("memberships")
        .update({ invited_by: null })
        .in("invited_by", ids),
      "clear memberships.invited_by",
    );
    await must(
      supabase
        .from("tickets")
        .update({ assignee_user_id: null })
        .in("assignee_user_id", ids),
      "clear tickets.assignee_user_id",
    );
  }
}

/** Runs seed-tenants.mjs with the already-verified project ref. */
function runSeed(mode) {
  const script = join(
    dirname(fileURLToPath(import.meta.url)),
    "seed-tenants.mjs",
  );
  const refArgs = hosted ? ["--project-ref", projectRef] : [];
  execFileSync(process.execPath, [script, `--${mode}`, ...refArgs], {
    stdio: "inherit",
    env: process.env,
  });
}

function writeSummary(counts) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  appendFileSync(file, summaryMarkdown({ apply, projectRef, counts }));
}

// ── Plan ──────────────────────────────────────────────────────────────────────

const now = Date.now();
const tenants = await selectAll(
  () => supabase.from("tenants").select("id, slug, created_at").order("id"),
  "tenants",
);
const workspaces = planWorkspaces(tenants, { now, graceHours });
const survivors = workspaces.recent.map((t) => t.id);

const users = await listAllUsers();
const adminExists = users.some(
  (user) => user.email?.toLowerCase() === PLATFORM_ADMIN_EMAIL,
);

const protectedEmails = new Set([
  PLATFORM_ADMIN_EMAIL,
  ...parseKeepList(process.env.PLATFORM_ADMIN_EMAILS).emails,
]);
const keep = parseKeepList(process.env.DEMO_RESET_KEEP_EMAILS);

async function planAccounts(currentUsers, alive) {
  return planUsers({
    users: currentUsers,
    links: await linksInto(alive),
    survivors: alive,
    protectedEmails,
    keep,
    now,
    graceHours,
  });
}

const accounts = await planAccounts(users, survivors);

console.log(
  `Project: ${projectRef}${hosted ? "" : " (local stack)"}   grace period: ${graceHours}h`,
);
console.log(
  `Workspaces: ${workspaces.deleted.length} visitor to delete, ` +
    `${workspaces.recent.length} visitor inside the grace period (kept), ` +
    `${workspaces.seeded.length} seeded to rebuild.`,
);
for (const tenant of workspaces.deleted) {
  console.log(`  delete  ${tenant.slug}  (created ${tenant.created_at})`);
}
const keptTotal = Object.values(accounts.kept).reduce((a, b) => a + b, 0);
console.log(
  `Accounts: ${accounts.remove.length} to delete, ${keptTotal} kept ` +
    `(${Object.entries(accounts.kept)
      .map(([reason, n]) => `${reason} ${n}`)
      .join(", ")}).`,
);
if (has("list")) {
  for (const user of accounts.remove) console.log(`  delete  ${user.email}`);
}

if (!apply) {
  const doomed = [...workspaces.deleted, ...workspaces.seeded].map((t) => t.id);
  const objects = await countObjects(doomed);
  console.log(
    `Storage: ${objects} object(s) under deleted or rebuilt workspaces.\n` +
      `Seeded workspaces would be rebuilt with seed-tenants.mjs --clean, then --apply.\n` +
      `\nDry run, nothing was changed. To reset:\n` +
      `  node --env-file=.env.local scripts/demo-reset.mjs --apply${hosted ? ` --project-ref ${projectRef}` : ""}`,
  );
  writeSummary({
    workspacesDeleted: workspaces.deleted.length,
    workspacesRecent: workspaces.recent.length,
    seededRebuilt: workspaces.seeded.length,
    objectsRemoved: objects,
    usersDeleted: accounts.remove.length,
    usersKept: keptTotal,
    failures: 0,
  });
  process.exit(0);
}

// ── Apply ─────────────────────────────────────────────────────────────────────

// The rebuild runs after the seeded workspaces are gone, so its password rules
// are checked now: refusing then would leave the demo with no workspaces.
const passwords = resolveSeedPasswords(process.env, { hosted, adminExists });
if (passwords.errors.length > 0) {
  refuse([
    ...passwords.errors,
    `Set SEED_PASSWORD (and PLATFORM_ADMIN_PASSWORD if the platform admin doesn't exist yet) to different random values of at least ${MIN_HOSTED_PASSWORD_LENGTH} characters.`,
  ]);
}

let failures = 0;

// 1-2. Visitor workspaces, then their files.
for (const ids of chunk(
  workspaces.deleted.map((t) => t.id),
  50,
)) {
  await must(
    supabase.from("tenants").delete().in("id", ids),
    "delete workspaces",
  );
}
console.log(`Deleted ${workspaces.deleted.length} visitor workspace(s).`);

// 3. Seeded workspaces and accounts. Their old ids are known from the plan, so
// their files can be removed once the rows are gone. From here on a failed
// step is counted and the rest still runs, so the rebuild always gets a turn.
try {
  runSeed("clean");
} catch (error) {
  failures++;
  console.error(`seed-tenants.mjs --clean failed: ${error.message}`);
}

let objectsRemoved = 0;
try {
  objectsRemoved = await purgeStorage(
    [...workspaces.deleted, ...workspaces.seeded].map((t) => t.id),
  );
} catch (error) {
  failures++;
  console.error(`Removing storage objects failed: ${error.message}`);
}
console.log(`Removed ${objectsRemoved} storage object(s).`);

// 4. Accounts, re-planned against what is there now: --clean removed the
// seeded ones, and someone may have signed up or created a workspace since the
// first read. Every workspace still here is a visitor's that survives (the
// seeded ones are gone until the rebuild, which adds only seeded accounts).
let usersDeleted = 0;
let usersKept = 0;
try {
  const remaining = await selectAll(
    () => supabase.from("tenants").select("id, slug").order("id"),
    "tenants",
  );
  const alive = remaining
    .filter((t) => !t.slug?.startsWith(SLUG_PREFIX))
    .map((t) => t.id);
  const after = await planAccounts(await listAllUsers(), alive);
  usersKept = Object.values(after.kept).reduce((a, b) => a + b, 0);
  await releaseReferences(after.remove.map((user) => user.id));
  for (const user of after.remove) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      failures++;
      // The id, not the address: this log is shared.
      console.error(`  could not delete account ${user.id}: ${error.message}`);
    } else {
      usersDeleted++;
    }
  }
} catch (error) {
  failures++;
  console.error(`Deleting accounts failed: ${error.message}`);
}
console.log(`Deleted ${usersDeleted} account(s).`);

// 5. Rebuild.
let seededRebuilt = 0;
try {
  runSeed("apply");
  const rebuilt = await must(
    supabase.from("tenants").select("id").like("slug", `${SLUG_PREFIX}%`),
    "seeded workspaces",
  );
  seededRebuilt = rebuilt.length;
} catch (error) {
  failures++;
  console.error(`Rebuilding the seeded workspaces failed: ${error.message}`);
}

writeSummary({
  workspacesDeleted: workspaces.deleted.length,
  workspacesRecent: workspaces.recent.length,
  seededRebuilt,
  objectsRemoved,
  usersDeleted,
  usersKept,
  failures,
});

if (failures > 0) process.exit(1);
console.log("Demo reset complete.");
