/**
 * Dev-only tenant seeder: 10-15 workspaces, each with a Tenant Admin, Manager,
 * Agent, Billing Admin and 2 portal customers, spread across every plan and
 * subscription state.
 *
 *   Preview (default, reads only):
 *     node --env-file=.env.local scripts/seed-tenants.mjs [--count 15]
 *
 *   Write (every account gets DEFAULT_PASSWORD unless SEED_PASSWORD is set):
 *     node --env-file=.env.local scripts/seed-tenants.mjs \
 *       --apply --project-ref <ref> [--count 15]
 *
 *   Remove everything this script created:
 *     node --env-file=.env.local scripts/seed-tenants.mjs \
 *       --clean --project-ref <ref>
 *
 * Seeded rows are recognised by slug (seed-*) and email (*.seed.test), which is
 * what --clean deletes by. .test never resolves, so nothing can reach a real
 * inbox. Tenants that already exist are skipped, so re-running is safe.
 *
 * Seeded PayPal ids (I-SEED...) do not exist at PayPal. Nothing here sets
 * next_plan_id, pending_plan_id or grace_period_ends_at, which are the only
 * things that make reconcile-subscriptions call PayPal, so the cron ignores
 * these rows. Changing plan or cancelling on a seeded tenant in the UI WILL
 * call PayPal and fail.
 */
import { createClient } from "@supabase/supabase-js";

const SLUG_PREFIX = "seed-";
const EMAIL_SUFFIX = ".seed.test";
const MIN_TENANTS = 10;
const MAX_TENANTS = 15;
const DAY_MS = 86_400_000;
const DEFAULT_PASSWORD = "test@123";

// The first 10 alone still cover every plan + status pair below.
const TENANTS = [
  {
    key: "aurora",
    name: "Aurora Logistics",
    plan: "Free",
    status: "trialing",
    tz: "Asia/Kolkata",
  },
  {
    key: "bluepeak",
    name: "Bluepeak Software",
    plan: "Free",
    status: "active",
    tz: "Europe/London",
  },
  {
    key: "cedar",
    name: "Cedar Health Group",
    plan: "Pro",
    status: "active",
    tz: "America/New_York",
  },
  {
    key: "dunmore",
    name: "Dunmore Retail",
    plan: "Business",
    status: "active",
    tz: "America/Chicago",
  },
  {
    key: "ember",
    name: "Ember Hospitality",
    plan: "Pro",
    status: "past_due",
    tz: "Asia/Dubai",
  },
  {
    key: "fernhill",
    name: "Fernhill Education",
    plan: "Business",
    status: "past_due",
    tz: "Asia/Kolkata",
  },
  {
    key: "granite",
    name: "Granite Finance",
    plan: "Pro",
    status: "cancelled",
    tz: "Europe/Berlin",
  },
  {
    key: "harbor",
    name: "Harbor Freight Lines",
    plan: "Business",
    status: "expired",
    tz: "America/Los_Angeles",
  },
  {
    key: "ivory",
    name: "Ivory Legal Partners",
    plan: "Pro",
    status: "active",
    tz: "Asia/Singapore",
  },
  {
    key: "juniper",
    name: "Juniper Energy",
    plan: "Business",
    status: "active",
    tz: "Australia/Sydney",
  },
  {
    key: "kestrel",
    name: "Kestrel Media",
    plan: "Free",
    status: "active",
    tz: "Asia/Kolkata",
  },
  {
    key: "lumen",
    name: "Lumen Insurance",
    plan: "Pro",
    status: "active",
    tz: "Europe/Paris",
  },
  {
    key: "meridian",
    name: "Meridian Manufacturing",
    plan: "Business",
    status: "active",
    tz: "Asia/Tokyo",
  },
  {
    key: "nimbus",
    name: "Nimbus Travel",
    plan: "Free",
    status: "trialing",
    tz: "Asia/Dubai",
  },
  {
    key: "orchard",
    name: "Orchard Foods",
    plan: "Pro",
    status: "active",
    tz: "America/Toronto",
  },
];

const FIRST_NAMES = [
  "Aarav",
  "Maya",
  "Liam",
  "Sofia",
  "Noah",
  "Priya",
  "Ethan",
  "Zara",
  "Lucas",
  "Anika",
  "Omar",
  "Elena",
  "Kiran",
  "Hana",
  "Mateo",
  "Nora",
  "Ravi",
  "Chloe",
  "Samir",
  "Ingrid",
  "Tariq",
  "Lena",
  "Arjun",
  "Isla",
  "Diego",
  "Mei",
  "Felix",
  "Divya",
  "Hugo",
  "Amara",
];

const LAST_NAMES = [
  "Sharma",
  "Okafor",
  "Bennett",
  "Rossi",
  "Nakamura",
  "Iyer",
  "Fischer",
  "Haddad",
  "Silva",
  "Larsen",
  "Menon",
  "Novak",
  "Reyes",
  "Kaur",
  "Dubois",
  "Tanaka",
  "Mensah",
  "Walsh",
  "Petrov",
  "Nair",
  "Costa",
  "Lindgren",
  "Rahman",
  "Moreau",
  "Ortiz",
];

const CUSTOMER_COMPANIES = [
  "Halden Works",
  "Quillon Labs",
  "Tessera Group",
  "Marlow & Finch",
  "Pinecrest Co",
  "Vantor Systems",
  "Ashgrove Ltd",
  "Corvid Analytics",
  "Solenne Studio",
  "Brightwater Inc",
];

const STAFF_ROLES = [
  { local: "admin", role: "tenant_admin", label: "Tenant Admin" },
  { local: "manager", role: "manager", label: "Manager" },
  { local: "agent", role: "agent", label: "Agent" },
  { local: "billing", role: "billing_admin", label: "Billing Admin" },
];

const CUSTOMER_LOCALS = ["customer1", "customer2"];

const SLA_TARGETS = [
  { priority: "Urgent", first_response_mins: 30, resolution_mins: 240 },
  { priority: "High", first_response_mins: 60, resolution_mins: 480 },
  { priority: "Normal", first_response_mins: 240, resolution_mins: 1440 },
  { priority: "Low", first_response_mins: 480, resolution_mins: 2880 },
];

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run with: node --env-file=.env.local scripts/seed-tenants.mjs",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const hostname = new URL(url).hostname;
const projectRef = hostname.split(".")[0];
const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

/** Writes must name the project they target, so .env.local can't pick it silently. */
function requireProjectRef() {
  if (isLocal || flag("project-ref") === projectRef) return;

  console.error(
    `Refusing to write: this targets project "${projectRef}".\n` +
      `If that is intended, add --project-ref ${projectRef}`,
  );
  process.exit(1);
}

function peopleFor(spec, tenantIndex) {
  const person = (slot) => {
    const n = tenantIndex * 6 + slot;
    const first = FIRST_NAMES[n % FIRST_NAMES.length];
    const last = LAST_NAMES[(n * 7 + tenantIndex) % LAST_NAMES.length];
    return `${first} ${last}`;
  };
  const email = (local) => `${local}@${spec.key}${EMAIL_SUFFIX}`;

  return {
    staff: STAFF_ROLES.map((staff, slot) => ({
      ...staff,
      email: email(staff.local),
      fullName: person(slot),
    })),
    customers: CUSTOMER_LOCALS.map((local, i) => ({
      email: email(local),
      fullName: person(STAFF_ROLES.length + i),
      company:
        CUSTOMER_COMPANIES[(tenantIndex * 2 + i) % CUSTOMER_COMPANIES.length],
      // 555-01xx numbers are reserved for fiction.
      phone: `+1-202-555-01${String(tenantIndex * 2 + i).padStart(2, "0")}`,
    })),
  };
}

const daysFromNow = (days) =>
  new Date(Date.now() + days * DAY_MS).toISOString();

/** Dates and billing columns for each state, shaped like what billing itself writes. */
function subscriptionState(spec) {
  const agreement = `I-SEED${spec.key.toUpperCase()}`;

  if (spec.plan === "Free") {
    return spec.status === "trialing"
      ? { start: 0, end: 15, agreement: null, extra: {} }
      : { start: -30, end: null, agreement: null, extra: {} };
  }

  switch (spec.status) {
    case "active":
      return {
        start: -10,
        end: 20,
        agreement,
        extra: { paypal_status: "ACTIVE", payment_status: "paid" },
      };
    case "past_due":
      // PayPal keeps retrying while past due, so the agreement stays ACTIVE.
      // grace_period_ends_at stays null: see the note at the top of this file.
      return {
        start: -35,
        end: -5,
        agreement,
        extra: {
          paypal_status: "ACTIVE",
          payment_status: "failed",
          payment_failure_count: 2,
          last_payment_failure_at: daysFromNow(-2),
        },
      };
    case "cancelled":
      // 'customer' on purpose: 'system' or 'paypal' would auto-block the tenant.
      return {
        start: -45,
        end: -15,
        agreement,
        extra: {
          paypal_status: "CANCELLED",
          cancelled_at: daysFromNow(-15),
          cancellation_source: "customer",
        },
      };
    case "expired":
      return {
        start: -75,
        end: -45,
        agreement,
        extra: { paypal_status: "EXPIRED" },
      };
    default:
      throw new Error(`Unknown status ${spec.status}`);
  }
}

async function loadPlans() {
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, seat_limit")
    .eq("is_active", true);
  if (error) throw error;

  const byName = new Map(data.map((plan) => [plan.name, plan]));
  for (const name of new Set(TENANTS.map((spec) => spec.plan))) {
    if (!byName.has(name)) throw new Error(`No active plan named "${name}".`);
  }
  return byName;
}

async function loadTimezones() {
  const { data, error } = await supabase
    .from("timezones")
    .select("id, code")
    .in("code", [...new Set(TENANTS.map((spec) => spec.tz))]);
  if (error) throw error;

  const byCode = new Map(data.map((tz) => [tz.code, tz.id]));
  for (const spec of TENANTS) {
    if (!byCode.has(spec.tz)) throw new Error(`No timezone "${spec.tz}".`);
  }
  return byCode;
}

async function existingSlugs() {
  const { data, error } = await supabase
    .from("tenants")
    .select("slug")
    .like("slug", `${SLUG_PREFIX}%`);
  if (error) throw error;
  return new Set(data.map((row) => row.slug));
}

async function createAuthUser(email, fullName, password) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function seedTenant(spec, tenantIndex, plans, timezones, password) {
  const slug = `${SLUG_PREFIX}${spec.key}`;
  const { staff, customers } = peopleFor(spec, tenantIndex);
  const [owner, ...team] = staff;
  const plan = plans.get(spec.plan);

  // The seat trigger reads the plan at insert time, so a plan too small for
  // four staff (Free has 2) is provisioned on the roomiest plan and moved to
  // its real plan after everyone is in. Same for cancelled/expired below.
  const fits = plan.seat_limit === 0 || plan.seat_limit >= STAFF_ROLES.length;
  const roomiest = [...plans.values()].sort(
    (a, b) => b.seat_limit - a.seat_limit,
  )[0];

  const ownerId = await createAuthUser(owner.email, owner.fullName, password);

  // The real signup path: tenant, trial subscription, owner, business hours,
  // default SLA and system saved views. It is also the only way to set
  // is_primary, which protect_primary_membership blocks elsewhere.
  const provisioned = await must(
    supabase.rpc("provision_tenant", {
      p_user_id: ownerId,
      p_email: owner.email,
      p_full_name: owner.fullName,
      p_organization_name: spec.name,
      p_portal_slug: slug,
      p_plan_id: (fits ? plan : roomiest).id,
      p_timezone_id: timezones.get(spec.tz),
      p_working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      p_day_start: "09:00",
      p_day_end: "18:00",
      p_sla: SLA_TARGETS,
    }),
    `provision_tenant ${slug}`,
  );
  const tenantId = provisioned[0].tenant_id;
  const joinedAt = new Date().toISOString();

  const addPerson = async (person, role) => {
    const userId = await createAuthUser(
      person.email,
      person.fullName,
      password,
    );

    await must(
      supabase
        .from("users")
        .upsert(
          { id: userId, email: person.email, full_name: person.fullName },
          { onConflict: "id" },
        ),
      `users ${person.email}`,
    );
    await must(
      supabase.from("memberships").insert({
        tenant_id: tenantId,
        user_id: userId,
        role,
        status: "active",
        invited_by: ownerId,
        joined_at: joinedAt,
      }),
      `membership ${person.email}`,
    );
    return userId;
  };

  for (const member of team) {
    await addPerson(member, member.role);
  }

  for (const customer of customers) {
    const userId = await addPerson(customer, "customer");
    await must(
      supabase.from("customers").insert({
        tenant_id: tenantId,
        email: customer.email,
        full_name: customer.fullName,
        company: customer.company,
        phone: customer.phone,
        portal_user_id: userId,
        // Skip the first-visit wizard and password prompt: they log in with one.
        portal_onboarded_at: joinedAt,
        portal_password_prompted_at: joinedAt,
      }),
      `customer ${customer.email}`,
    );
  }

  // Keeps subscriptions and tenants in step, the same call billing uses.
  const state = subscriptionState(spec);
  const applied = await must(
    supabase.rpc("apply_subscription_plan", {
      p_tenant_id: tenantId,
      p_plan_id: plan.id,
      p_status: spec.status,
      p_seats: Math.max(plan.seat_limit, 1),
      p_current_period_start: daysFromNow(state.start),
      p_current_period_end: state.end === null ? null : daysFromNow(state.end),
      p_clear_period_end: state.end === null,
      p_paypal_subscription_id: state.agreement,
    }),
    `apply_subscription_plan ${slug}`,
  );
  if (applied !== true) throw new Error(`Plan not applied to ${slug}.`);

  if (Object.keys(state.extra).length > 0) {
    await must(
      supabase
        .from("subscriptions")
        .update(state.extra)
        .eq("tenant_id", tenantId),
      `subscription state ${slug}`,
    );
  }
}

async function listSeedAuthUsers() {
  const found = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    found.push(
      ...data.users.filter((user) => user.email?.endsWith(EMAIL_SUFFIX)),
    );
    if (data.users.length < 200) return found;
  }
}

async function removeSeedData({ slugs } = {}) {
  let query = supabase.from("tenants").delete();
  query = slugs
    ? query.in("slug", slugs)
    : query.like("slug", `${SLUG_PREFIX}%`);
  const tenants = await must(query.select("slug"), "delete tenants");

  const domains = slugs?.map(
    (slug) => `@${slug.slice(SLUG_PREFIX.length)}${EMAIL_SUFFIX}`,
  );
  const users = (await listSeedAuthUsers()).filter(
    (user) => !domains || domains.some((d) => user.email.endsWith(d)),
  );
  for (const user of users) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`deleteUser ${user.email}: ${error.message}`);
  }
  return { tenants: tenants.length, users: users.length };
}

function printPlan(specs, plans) {
  console.table(
    specs.map((spec) => ({
      slug: `${SLUG_PREFIX}${spec.key}`,
      name: spec.name,
      plan: spec.plan,
      subscription: spec.status,
      seat_limit: plans.get(spec.plan).seat_limit,
      staff: STAFF_ROLES.length,
      customers: CUSTOMER_LOCALS.length,
    })),
  );
}

function printCredentials(specs) {
  const rows = [];
  specs.forEach((spec) => {
    const { staff, customers } = peopleFor(spec, TENANTS.indexOf(spec));
    for (const member of staff) {
      rows.push({ tenant: spec.key, role: member.label, email: member.email });
    }
    for (const customer of customers) {
      rows.push({ tenant: spec.key, role: "Customer", email: customer.email });
    }
  });
  console.table(rows);
}

const count = Number(flag("count") ?? MAX_TENANTS);
if (!Number.isInteger(count) || count < MIN_TENANTS || count > MAX_TENANTS) {
  console.error(`--count must be between ${MIN_TENANTS} and ${MAX_TENANTS}`);
  process.exit(1);
}
const specs = TENANTS.slice(0, count);

if (has("clean")) {
  requireProjectRef();
  const removed = await removeSeedData();
  console.log(
    `Removed ${removed.tenants} seeded tenant(s) and ${removed.users} seeded user(s) from ${projectRef}.`,
  );
  process.exit(0);
}

const [plans, timezones, existing] = await Promise.all([
  loadPlans(),
  loadTimezones(),
  existingSlugs(),
]);

const todo = specs.filter((spec) => !existing.has(`${SLUG_PREFIX}${spec.key}`));
console.log(`Project: ${projectRef}`);
printPlan(specs, plans);
console.log(
  `${todo.length} to create, ${specs.length - todo.length} already there.`,
);

if (!has("apply")) {
  console.log(
    `\nPreview only, nothing was written. To write:\n` +
      `  node --env-file=.env.local scripts/seed-tenants.mjs --apply --project-ref ${projectRef} --count ${count}`,
  );
  process.exit(0);
}

requireProjectRef();

const password = process.env.SEED_PASSWORD ?? DEFAULT_PASSWORD;

for (const spec of todo) {
  const slug = `${SLUG_PREFIX}${spec.key}`;
  try {
    await seedTenant(spec, TENANTS.indexOf(spec), plans, timezones, password);
    console.log(`  ok  ${slug} (${spec.plan}, ${spec.status})`);
  } catch (error) {
    // Don't leave half a workspace behind: a re-run skips any slug that exists.
    console.error(
      `  FAILED ${slug}: ${error.message}\n  Rolling this tenant back.`,
    );
    await removeSeedData({ slugs: [slug] });
    process.exit(1);
  }
}

printCredentials(todo);
if (todo.length > 0) {
  console.log(`Password for all of the above: ${password}`);
}
