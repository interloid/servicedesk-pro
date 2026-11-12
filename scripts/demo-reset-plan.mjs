/**
 * Selection and safety rules for scripts/demo-reset.mjs, kept free of side
 * effects so they can be tested.
 *
 * The reset deletes data, so every rule here fails closed: an unparseable
 * setting, a missing project ref or an unknown host refuses to run rather than
 * guessing.
 */
import { isHostedSupabaseUrl } from "./seed-guard.mjs";
import {
  MAX_TENANTS,
  MIN_TENANTS,
  SLUG_PREFIX,
  STAFF_EMAIL_SUFFIX,
  TENANTS,
} from "./seed-data.mjs";

export const DEFAULT_GRACE_HOURS = 2;

const HOUR_MS = 3_600_000;

/** Every bucket keys its objects by `<tenant id>/...`. */
export const TENANT_BUCKETS = [
  "ticket-attachments",
  "avatars",
  "branding",
  "invoices",
];

/** Empty or whitespace-only counts as not set. */
function present(value) {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

/**
 * Grace period in hours, from --grace-hours or DEMO_RESET_GRACE_HOURS.
 * Returns { hours, error }. Anything that isn't a plain non-negative number is
 * an error, never a silent zero.
 */
export function parseGraceHours(value) {
  const text = present(value);
  if (text === undefined) return { hours: DEFAULT_GRACE_HOURS, error: null };
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return {
      hours: undefined,
      error: `Grace period "${text}" is not a number of hours.`,
    };
  }
  return { hours: Number(text), error: null };
}

/**
 * Comma-separated addresses and `@domain` entries, for example
 * "ops@example.com, @example.org". Matching ignores case.
 */
export function parseKeepList(...lists) {
  const emails = new Set();
  const domains = new Set();
  for (const list of lists) {
    for (const raw of (list ?? "").split(",")) {
      const entry = raw.trim().toLowerCase();
      if (!entry) continue;
      if (entry.startsWith("@")) {
        if (entry.length > 1) domains.add(entry.slice(1));
      } else {
        emails.add(entry);
      }
    }
  }
  return { emails, domains };
}

export function isKept(email, keep) {
  if (!email) return false;
  const address = email.toLowerCase();
  if (keep.emails.has(address)) return true;
  const domain = address.slice(address.lastIndexOf("@") + 1);
  return keep.domains.has(domain);
}

/** The rule seed-tenants.mjs --clean deletes by. */
export function isSeedAccount(user) {
  return Boolean(
    user.user_metadata?.seed_tenant ||
    user.email?.toLowerCase().endsWith(STAFF_EMAIL_SUFFIX),
  );
}

/**
 * Whether this run may touch the project at `url`.
 *
 *   env          DEMO_RESET_ALLOWED, SUPABASE_PROJECT_REF, PRODUCTION_PROJECT_REF
 *   apply        --apply was passed
 *   projectFlag  the value of --project-ref
 *
 * A hosted project must be named three times and agree: the URL, the
 * environment's SUPABASE_PROJECT_REF and (for --apply) --project-ref. A custom
 * Supabase domain can't be checked, so it is refused. A local stack only needs
 * DEMO_RESET_ALLOWED.
 *
 * Returns { hosted, projectRef, errors }.
 */
export function checkTarget(url, env, { apply = false, projectFlag } = {}) {
  const errors = [];

  if (env.DEMO_RESET_ALLOWED !== "true") {
    errors.push(
      "DEMO_RESET_ALLOWED is not 'true'. Set it only on the development demo.",
    );
  }

  if (typeof url !== "string" || !URL.canParse(url)) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL is missing or not a URL.");
    return { hosted: true, projectRef: undefined, errors };
  }

  const hosted = isHostedSupabaseUrl(url);
  const host = new URL(url).hostname.toLowerCase();
  if (!hosted) return { hosted, projectRef: "local", errors };

  const match = /^([a-z0-9]+)\.supabase\.co$/.exec(host);
  const projectRef = match?.[1];
  const expected = present(env.SUPABASE_PROJECT_REF);

  if (!projectRef) {
    errors.push(
      `${host} is not a <ref>.supabase.co URL, so the project can't be verified.`,
    );
  } else if (!expected) {
    errors.push("SUPABASE_PROJECT_REF is not set.");
  } else if (projectRef !== expected) {
    errors.push(
      `NEXT_PUBLIC_SUPABASE_URL is project ${projectRef}, but SUPABASE_PROJECT_REF is ${expected}.`,
    );
  }

  const production = present(env.PRODUCTION_PROJECT_REF);
  if (production && projectRef === production) {
    errors.push(`Project ${projectRef} is PRODUCTION_PROJECT_REF.`);
  }

  if (apply && projectRef && projectFlag !== projectRef) {
    errors.push(
      `--apply on a hosted project needs --project-ref ${projectRef}.`,
    );
  }

  return { hosted, projectRef, errors };
}

/**
 * Splits workspaces into
 *   deleted   visitor workspaces older than the grace period
 *   seeded    seed-* workspaces, which seed-tenants.mjs --clean rebuilds
 *   recent    visitor workspaces still inside the grace period (kept)
 */
export function planWorkspaces(tenants, { now, graceHours }) {
  const cutoff = now - graceHours * HOUR_MS;
  const deleted = [];
  const seeded = [];
  const recent = [];

  for (const tenant of tenants) {
    if (tenant.slug?.startsWith(SLUG_PREFIX)) {
      seeded.push(tenant);
      continue;
    }
    const created = Date.parse(tenant.created_at);
    // An unreadable date is treated as new: kept, never deleted by mistake.
    if (Number.isNaN(created) || created > cutoff) recent.push(tenant);
    else deleted.push(tenant);
  }
  return { deleted, seeded, recent };
}

/**
 * Picks the Auth users to delete once the workspace step is done.
 *
 *   users        every auth user: { id, email, created_at, user_metadata }
 *   links        { user_id, tenant_id } for memberships and portal customers
 *   survivors    ids of workspaces that outlive the reset (the recent ones;
 *                seeded workspaces are rebuilt with only seeded accounts)
 *   protectedEmails  platform admins, always kept
 *   keep         from parseKeepList
 *
 * Returns { remove, kept } where kept counts each reason once per user, in
 * order: seeded, platformAdmin, keepList, recent, member.
 */
export function planUsers({
  users,
  links,
  survivors,
  protectedEmails,
  keep,
  now,
  graceHours,
}) {
  const cutoff = now - graceHours * HOUR_MS;
  const alive = new Set(survivors);
  const belongs = new Set(
    links.filter((l) => alive.has(l.tenant_id)).map((l) => l.user_id),
  );
  const admins = new Set(
    [...protectedEmails].map((email) => email.trim().toLowerCase()),
  );

  const remove = [];
  const kept = {
    seeded: 0,
    platformAdmin: 0,
    keepList: 0,
    recent: 0,
    member: 0,
  };

  for (const user of users) {
    const email = user.email?.toLowerCase();
    const created = Date.parse(user.created_at);
    if (isSeedAccount(user)) kept.seeded++;
    else if (email && admins.has(email)) kept.platformAdmin++;
    else if (isKept(email, keep)) kept.keepList++;
    else if (Number.isNaN(created) || created > cutoff) kept.recent++;
    else if (belongs.has(user.id)) kept.member++;
    else remove.push(user);
  }
  return { remove, kept };
}

/**
 * What must be undone before seed-tenants.mjs --clean deletes the seeded
 * accounts, or a row in a surviving visitor workspace would block it:
 *
 *   userIds      seeded accounts; their tickets.assignee_user_id and
 *                memberships.invited_by in surviving workspaces are cleared
 *   memberships  ids of seeded accounts' memberships in surviving workspaces.
 *                A primary (owner) membership can't be deleted on its own, so
 *                it is left to cascade when the account goes.
 *
 * `links` are from the reset's membership query: { membership_id, user_id,
 * tenant_id, is_primary }; portal-customer links (no membership_id) are
 * ignored, since customers.portal_user_id is ON DELETE SET NULL.
 */
export function planSeedRelease({ users, links, survivors }) {
  const seeded = new Set(users.filter(isSeedAccount).map((user) => user.id));
  const alive = new Set(survivors);
  const memberships = links
    .filter(
      (link) =>
        link.membership_id &&
        !link.is_primary &&
        seeded.has(link.user_id) &&
        alive.has(link.tenant_id),
    )
    .map((link) => link.membership_id);
  return { userIds: [...seeded], memberships };
}

/**
 * The --count to rebuild with: seed-tenants.mjs seeds TENANTS in order, so this
 * is one past the last known seeded slug present, kept within the script's
 * limits. Unknown seed-* slugs (a visitor can pick one) don't count. None at
 * all means the seeder's default.
 */
export function seedCountToRebuild(slugs) {
  const present = new Set(slugs);
  let last = -1;
  TENANTS.forEach((spec, index) => {
    if (present.has(`${SLUG_PREFIX}${spec.key}`)) last = index;
  });
  if (last === -1) return MAX_TENANTS;
  return Math.min(MAX_TENANTS, Math.max(MIN_TENANTS, last + 1));
}

/** Splits `items` into arrays of at most `size`, for `.in()` filters. */
export function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** Markdown for $GITHUB_STEP_SUMMARY: counts only, never an address. */
export function summaryMarkdown({ apply, projectRef, counts }) {
  const rows = [
    ["Visitor workspaces deleted", counts.workspacesDeleted],
    ["Visitor workspaces kept (inside grace period)", counts.workspacesRecent],
    ["Seeded workspaces rebuilt", counts.seededRebuilt],
    ["Storage objects removed", counts.objectsRemoved],
    ["Accounts deleted", counts.usersDeleted],
    ["Accounts kept", counts.usersKept],
    ["Failures", counts.failures],
  ];
  return [
    `### Demo reset ${apply ? "" : "(dry run) "}on \`${projectRef}\``,
    "",
    "| | Count |",
    "| --- | ---: |",
    ...rows.map(([label, n]) => `| ${label} | ${n ?? 0} |`),
    "",
  ].join("\n");
}
