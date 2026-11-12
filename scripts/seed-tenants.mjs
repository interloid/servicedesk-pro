/**
 * Dev-only tenant seeder: 10-15 workspaces spread across every plan and
 * subscription state, each with 2 portal customers and:
 *
 *   Free      2 staff (Tenant Admin, Agent), the plan's full seat limit
 *   Pro       15 staff, the plan's full seat limit
 *   Business  4 staff (Tenant Admin, Manager, Agent, Billing Admin)
 *
 *   Tickets   10 per customer (a different set for each of the two), covering
 *             every status, with descriptions and conversation threads
 *   Invoices  12 monthly invoices covering every status on paid plans. Free
 *             tenants get none, since nothing is ever charged.
 *
 *   Preview (default, reads only):
 *     node --env-file=.env.local scripts/seed-tenants.mjs [--count 15]
 *
 *   Write (every demo account gets SEED_PASSWORD):
 *     node --env-file=.env.local scripts/seed-tenants.mjs \
 *       --apply --project-ref <ref> [--count 15]
 *
 *   Remove everything this script created:
 *     node --env-file=.env.local scripts/seed-tenants.mjs \
 *       --clean --project-ref <ref>
 *
 * Passwords (rules in scripts/seed-guard.mjs; neither is ever printed):
 *   SEED_PASSWORD            shared by every demo account. Optional on a local
 *                            stack (falls back to the committed default);
 *                            required, non-default and at least 12 characters
 *                            on any hosted project, or nothing is written.
 *   PLATFORM_ADMIN_PASSWORD  the platform admin's, never the shared one. Same
 *                            rule on a hosted project when the account is new;
 *                            locally a random one is printed once if unset.
 *
 * The data itself (fictional US companies, people and ticket conversations) is in
 * scripts/seed-data.mjs.
 *
 * Seeded rows are recognised by slug (seed-*), and seeded accounts by the
 * seed_tenant tag in their user metadata (older seeds: a *.seed.test email),
 * which is what --clean deletes by. Staff emails end in .seed.test and customer
 * emails in .example; neither resolves, so nothing can reach a real inbox.
 * Tenants that already exist are skipped, so re-running is safe, but they keep
 * what they had: run --clean first to rebuild them with this data.
 *
 * Ticket triggers queue real mail, which the email-jobs cron would try to send
 * to these addresses. Seeded staff get email alerts switched off before
 * any ticket exists (that also covers later SLA alerts), and the customer mail
 * the inserts queue is deleted straight after them. A cron run landing inside
 * that gap can still try a few, which only bounce.
 *
 * Seeded PayPal ids (I-SEED...) do not exist at PayPal. Nothing here sets
 * next_plan_id, pending_plan_id or grace_period_ends_at, which are the only
 * things that make reconcile-subscriptions call PayPal, so the cron ignores
 * these rows. Changing plan or cancelling on a seeded tenant in the UI WILL
 * call PayPal and fail.
 */
import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import {
  MIN_HOSTED_PASSWORD_LENGTH,
  isHostedSupabaseUrl,
  resolveSeedPasswords,
} from "./seed-guard.mjs";
import {
  MAX_TENANTS,
  MIN_TENANTS,
  SLUG_PREFIX,
  STAFF_BY_PLAN,
  STAFF_EMAIL_SUFFIX,
  TENANTS,
  TICKET_PLANS,
  fillTemplate,
  firstName,
  peopleFor,
} from "./seed-data.mjs";

const DAY_MS = 86_400_000;

const PLATFORM_ADMIN_EMAIL = "platform-admin@servicedesk-pro.com";
const PLATFORM_ADMIN_NAME = "Platform Admin";

// The plan really must have room: a roster over the limit would hit the seat
// trigger, and one that merely differs would no longer test the limit asked for.
const EXPECTED_SEAT_LIMITS = { Free: 2, Pro: 15 };

const HOUR_MS = 3_600_000;

const INVOICE_MONTHS = 12;

const NO_EMAIL_PREFS = {
  email: {
    assigned: false,
    replies: false,
    sla: false,
    mention: false,
    created: false,
    reopened: false,
  },
  in_app: {
    assigned: true,
    replies: true,
    sla: true,
    mention: true,
    created: true,
    reopened: true,
  },
};

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
const isLocal = !isHostedSupabaseUrl(url);

/** Writes must name the project they target, so .env.local can't pick it silently. */
function requireProjectRef() {
  if (isLocal || flag("project-ref") === projectRef) return;

  console.error(
    `Refusing to write: this targets project "${projectRef}".\n` +
      `If that is intended, add --project-ref ${projectRef}`,
  );
  process.exit(1);
}

const daysFromNow = (days) =>
  new Date(Date.now() + days * DAY_MS).toISOString();
const hoursAgo = (hours) =>
  new Date(Date.now() - hours * HOUR_MS).toISOString();

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
    .select("id, name, seat_limit, price_month")
    .eq("is_active", true);
  if (error) throw error;

  const byName = new Map(data.map((plan) => [plan.name, plan]));
  for (const name of new Set(TENANTS.map((spec) => spec.plan))) {
    if (!byName.has(name)) throw new Error(`No active plan named "${name}".`);
  }
  for (const [name, limit] of Object.entries(EXPECTED_SEAT_LIMITS)) {
    const actual = byName.get(name).seat_limit;
    if (actual !== limit) {
      throw new Error(
        `Plan "${name}" has seat_limit ${actual}, expected ${limit}. Fix the plan first.`,
      );
    }
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

/** seedTenant tags the account, which is what --clean finds it by. */
async function createAuthUser(email, fullName, password, seedTenant) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, seed_tenant: seedTenant },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

/**
 * The platform console operator: in no workspace, so sign-in lands on
 * /platform, and untagged, so --clean leaves it alone. It never gets the shared
 * seed password -- PLATFORM_ADMIN_PASSWORD, or a random one printed once.
 * Access itself still comes from PLATFORM_ADMIN_EMAILS, not from this account.
 */
async function platformAdminExists() {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    if (data.users.some((user) => user.email === PLATFORM_ADMIN_EMAIL)) {
      return true;
    }
    if (data.users.length < 200) return false;
  }
}

/** adminPassword: from resolveSeedPasswords; undefined means generate one. */
async function ensurePlatformAdmin(exists, adminPassword) {
  if (exists) return { created: false };

  const password = adminPassword ?? randomBytes(18).toString("base64url");
  const { data, error } = await supabase.auth.admin.createUser({
    email: PLATFORM_ADMIN_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: PLATFORM_ADMIN_NAME },
  });
  if (error)
    throw new Error(`createUser ${PLATFORM_ADMIN_EMAIL}: ${error.message}`);

  // Audit rows name their actor through public.users, so the console's own
  // writes need the row even though no workspace does.
  await must(
    supabase.from("users").upsert({
      id: data.user.id,
      email: PLATFORM_ADMIN_EMAIL,
      full_name: PLATFORM_ADMIN_NAME,
    }),
    `users ${PLATFORM_ADMIN_EMAIL}`,
  );

  return {
    created: true,
    password: adminPassword ? null : password,
  };
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

  const ownerId = await createAuthUser(
    owner.email,
    owner.fullName,
    password,
    spec.key,
  );

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
      p_plan_id: plan.id,
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
  const staffIds = new Map([[owner.local, ownerId]]);

  const addPerson = async (person, role) => {
    const userId = await createAuthUser(
      person.email,
      person.fullName,
      password,
      spec.key,
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
    staffIds.set(member.local, await addPerson(member, member.role));
  }

  // Before any ticket exists: see the note at the top of this file.
  await must(
    supabase.from("notification_prefs").insert(
      [...staffIds.values()].map((userId) => ({
        tenant_id: tenantId,
        user_id: userId,
        channel_json: NO_EMAIL_PREFS,
      })),
    ),
    `notification_prefs ${slug}`,
  );

  const customerRows = [];
  for (const [index, customer] of customers.entries()) {
    const userId = await addPerson(customer, "customer");
    const row = await must(
      supabase
        .from("customers")
        .insert({
          tenant_id: tenantId,
          email: customer.email,
          full_name: customer.fullName,
          company: customer.company,
          phone: customer.phone,
          portal_user_id: userId,
          // Skip the first-visit wizard and password prompt: they log in with one.
          portal_onboarded_at: joinedAt,
          portal_password_prompted_at: joinedAt,
        })
        .select("id")
        .single(),
      `customer ${customer.email}`,
    );
    customerRows.push({ ...row, ...customer, plan: TICKET_PLANS[index] });
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

  const agents = staff
    .filter((member) => member.role === "agent")
    .map((member) => ({
      id: staffIds.get(member.local),
      fullName: member.fullName,
    }));
  const ticketCount = await seedTickets(
    tenantId,
    spec,
    customerRows,
    agents,
    slug,
  );
  const invoiceCount =
    Number(plan.price_month) > 0
      ? await seedInvoices(tenantId, spec, plan, owner.email, slug)
      : 0;

  return { staff: staff.length, tickets: ticketCount, invoices: invoiceCount };
}

/** Tickets go in as one statement per tenant; the number trigger handles that. */
async function seedTickets(tenantId, spec, customerRows, agents, slug) {
  const planned = customerRows.flatMap((customer, c) =>
    customer.plan.map((item, i) => {
      // New tickets are still in the queue, with nobody on them.
      const agent =
        item.status === "new"
          ? null
          : agents[(c * customer.plan.length + i) % agents.length];
      const values = {
        customer: firstName(customer.fullName),
        agent: agent ? firstName(agent.fullName) : "",
        company: customer.company,
        tenant: spec.name,
      };
      return { item, customer, agent, values };
    }),
  );

  const tickets = await must(
    supabase
      .from("tickets")
      .insert(
        planned.map(({ item, customer, agent, values }) => ({
          tenant_id: tenantId,
          subject: fillTemplate(item.subject, values),
          description: fillTemplate(item.description, values),
          status: item.status,
          priority: item.priority,
          requester_customer_id: customer.id,
          assignee_user_id: agent?.id ?? null,
          created_at: hoursAgo(item.age),
          resolved_at: item.resolvedAgo ? hoursAgo(item.resolvedAgo) : null,
          closed_at: item.closedAgo ? hoursAgo(item.closedAgo) : null,
        })),
      )
      .select("id, subject, requester_customer_id"),
    `tickets ${slug}`,
  );

  // Matched on requester and subject, which are unique within a tenant.
  const ticketIdFor = new Map(
    tickets.map((t) => [`${t.requester_customer_id}|${t.subject}`, t.id]),
  );
  const messages = planned.flatMap(({ item, customer, agent, values }) =>
    item.thread.map((message) => ({
      tenant_id: tenantId,
      ticket_id: ticketIdFor.get(
        `${customer.id}|${fillTemplate(item.subject, values)}`,
      ),
      author_type: message.by === "customer" ? "customer" : "agent",
      author_id: message.by === "customer" ? customer.id : agent.id,
      body: fillTemplate(message.body, values),
      visibility: message.by === "note" ? "internal" : "public",
      created_at: hoursAgo(item.age - message.at),
    })),
  );

  if (messages.length > 0) {
    await must(
      supabase.from("ticket_messages").insert(messages),
      `ticket_messages ${slug}`,
    );
  }

  await must(
    supabase.from("email_jobs").delete().eq("tenant_id", tenantId),
    `email_jobs ${slug}`,
  );

  return tickets.length;
}

/**
 * Monthly charges at the plan's flat price, oldest first so numbers count up.
 * The newest lines up with the subscription: a past_due tenant's latest charge
 * failed and every other tenant's was paid. The earlier ones cover the rest.
 */
async function seedInvoices(tenantId, spec, plan, billingEmail, slug) {
  const state = subscriptionState(spec);
  const { id: subscriptionId } = await must(
    supabase
      .from("subscriptions")
      .select("id")
      .eq("tenant_id", tenantId)
      .single(),
    `subscription ${slug}`,
  );

  const amount = Number(plan.price_month);
  const newestStart = new Date(Date.now() + state.start * DAY_MS);
  const isRunning = spec.status === "active" || spec.status === "past_due";

  const statusFor = (monthsBack) => {
    if (monthsBack === 0) return spec.status === "past_due" ? "failed" : "paid";
    if (monthsBack === 1) return "pending";
    if (monthsBack === 3) return "failed";
    if (monthsBack === 5) return "refunded";
    return "paid";
  };

  const rows = [];
  for (let back = INVOICE_MONTHS - 1, seq = 1; back >= 0; back--, seq++) {
    const start = new Date(newestStart);
    start.setUTCMonth(start.getUTCMonth() - back);
    const next = new Date(start);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const end = new Date(next.getTime() - DAY_MS);

    const status = statusFor(back);
    const settled = status === "paid" || status === "refunded";
    const number = String(seq).padStart(3, "0");

    rows.push({
      tenant_id: tenantId,
      // Same tag as seed-invoices.mjs, which can also clean these up.
      paypal_txn_id: `SEED-${slug}-${number}`,
      invoice_number: `INV-${number}`,
      invoice_type: "recurring",
      subscription_id: subscriptionId,
      paypal_subscription_id: state.agreement,
      amount,
      subtotal: amount,
      tax: 0,
      amount_paid: settled ? amount : 0,
      balance_due: settled ? 0 : amount,
      currency: "USD",
      status,
      plan_name: plan.name,
      seats: plan.seat_limit,
      payment_method: "PayPal",
      period_start: start.toISOString().slice(0, 10),
      period_end: end.toISOString().slice(0, 10),
      paid_at: settled ? start.toISOString() : null,
      // Only the newest invoice of a running subscription has a next charge.
      next_billing_date: isRunning && back === 0 ? next.toISOString() : null,
      next_billing_amount: isRunning && back === 0 ? amount : null,
      billing_email: billingEmail,
      created_at: start.toISOString(),
    });
  }

  await must(supabase.from("invoices").insert(rows), `invoices ${slug}`);
  return rows.length;
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
      ...data.users.filter(
        (user) =>
          user.user_metadata?.seed_tenant ||
          user.email?.endsWith(STAFF_EMAIL_SUFFIX),
      ),
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

  const keys = slugs?.map((slug) => slug.slice(SLUG_PREFIX.length));
  const users = (await listSeedAuthUsers()).filter(
    (user) =>
      !keys ||
      keys.some(
        (key) =>
          user.user_metadata?.seed_tenant === key ||
          user.email?.endsWith(`@${key}${STAFF_EMAIL_SUFFIX}`),
      ),
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
      staff: STAFF_BY_PLAN[spec.plan].length,
      customers: spec.customers.length,
      tickets: spec.customers.reduce(
        (sum, _, i) => sum + TICKET_PLANS[i].length,
        0,
      ),
      invoices:
        Number(plans.get(spec.plan).price_month) > 0 ? INVOICE_MONTHS : 0,
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

// Checked before the first write: on a hosted project the committed default
// would let anyone reading this repository sign in as every demo account.
const adminExists = await platformAdminExists();
const {
  seedPassword: password,
  adminPassword,
  usingDefault,
  errors: passwordErrors,
} = resolveSeedPasswords(process.env, { hosted: !isLocal, adminExists });
if (passwordErrors.length > 0) {
  console.error(
    `Refusing to write to ${isLocal ? "the local stack" : `hosted project "${projectRef}"`}:\n` +
      passwordErrors.map((problem) => `  - ${problem}`).join("\n") +
      `\nOn a hosted project set SEED_PASSWORD (and PLATFORM_ADMIN_PASSWORD, if the\n` +
      `platform admin doesn't exist yet) to different random values of at least\n` +
      `${MIN_HOSTED_PASSWORD_LENGTH} characters, for example from \`openssl rand -base64 18\`.\n` +
      `Nothing was written.`,
  );
  process.exit(1);
}

const platformAdmin = await ensurePlatformAdmin(adminExists, adminPassword);
console.log(
  platformAdmin.created
    ? `  ok  platform admin ${PLATFORM_ADMIN_EMAIL} (no workspace)`
    : `  --  platform admin ${PLATFORM_ADMIN_EMAIL} already there, left as is`,
);

for (const spec of todo) {
  const slug = `${SLUG_PREFIX}${spec.key}`;
  try {
    const made = await seedTenant(
      spec,
      TENANTS.indexOf(spec),
      plans,
      timezones,
      password,
    );
    console.log(
      `  ok  ${slug} (${spec.plan}, ${spec.status}): ${made.staff} staff, ${made.tickets} tickets, ${made.invoices} invoices`,
    );
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
  console.log(
    usingDefault
      ? "Password for all of the above: the local default in scripts/seed-guard.mjs."
      : "Password for all of the above: the SEED_PASSWORD you set.",
  );
}
if (platformAdmin.password) {
  console.log(
    `\nPlatform admin ${PLATFORM_ADMIN_EMAIL} password (shown once, store it now): ${platformAdmin.password}`,
  );
}
