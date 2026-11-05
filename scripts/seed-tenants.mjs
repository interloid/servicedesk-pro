/**
 * Dev-only tenant seeder: 10-15 workspaces spread across every plan and
 * subscription state, each with 2 portal customers and:
 *
 *   Free      2 staff (Tenant Admin, Agent), the plan's full seat limit
 *   Pro       15 staff, the plan's full seat limit
 *   Business  4 staff (Tenant Admin, Manager, Agent, Billing Admin)
 *
 *   Tickets   10 per customer, covering every status, with their conversations
 *   Invoices  12 monthly invoices covering every status on paid plans. Free
 *             tenants get none, since nothing is ever charged.
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
 * inbox. Tenants that already exist are skipped, so re-running is safe, but they
 * keep what they had: run --clean first to rebuild them with this data.
 *
 * Ticket triggers queue real mail, which the email-jobs cron would try to send
 * to these .test addresses. Seeded staff get email alerts switched off before
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

const ROLE_LABELS = {
  tenant_admin: "Tenant Admin",
  manager: "Manager",
  agent: "Agent",
  billing_admin: "Billing Admin",
};

const OWNER = { local: "admin", role: "tenant_admin" };
const CORE_STAFF = [
  OWNER,
  { local: "manager", role: "manager" },
  { local: "agent", role: "agent" },
  { local: "billing", role: "billing_admin" },
];

// Pro fills all 15 seats: the core four, 2 more managers and 9 more agents.
const PRO_EXTRA_MANAGERS = [2, 3].map((n) => ({
  local: `manager${n}`,
  role: "manager",
}));
const PRO_EXTRA_AGENTS = Array.from({ length: 9 }, (_, i) => ({
  local: `agent${i + 2}`,
  role: "agent",
}));

const STAFF_BY_PLAN = {
  Free: [OWNER, { local: "agent", role: "agent" }],
  Pro: [...CORE_STAFF, ...PRO_EXTRA_MANAGERS, ...PRO_EXTRA_AGENTS],
  Business: CORE_STAFF,
};

// The plan really must have room: a roster over the limit would hit the seat
// trigger, and one that merely differs would no longer test the limit asked for.
const EXPECTED_SEAT_LIMITS = { Free: 2, Pro: 15 };

const CUSTOMER_LOCALS = ["customer1", "customer2"];

const HOUR_MS = 3_600_000;
const PRIORITIES = ["low", "normal", "high", "urgent"];

// One customer's 10 tickets: every status at least once. Ages are hours before
// the seed runs. resolved_at stays under the default 4-day auto-close, so
// sla_tick doesn't turn the resolved ones into closed the moment it next runs.
const TICKET_PLAN = [
  {
    subject: "Cannot log in after password reset",
    status: "new",
    age: 1,
  },
  {
    subject: "Question about exporting our data",
    status: "new",
    age: 3,
  },
  {
    subject: "Dashboard loads very slowly in the morning",
    status: "open",
    age: 5,
  },
  {
    subject: "Email notifications arrive twice",
    status: "open",
    age: 30,
    customerFollowUp: true,
  },
  {
    subject: "Need a copy of last quarter's report",
    status: "pending",
    age: 6,
  },
  {
    subject: "Attachment upload fails on large files",
    status: "pending",
    age: 50,
  },
  {
    subject: "Integration stopped syncing overnight",
    status: "on_hold",
    age: 8,
    internalNote: true,
  },
  {
    subject: "Wrong timezone on ticket timestamps",
    status: "resolved",
    age: 72,
    resolvedAgo: 20,
    customerFollowUp: true,
  },
  {
    subject: "Please add a teammate to our account",
    status: "resolved",
    age: 96,
    resolvedAgo: 30,
  },
  {
    subject: "Portal link in the welcome email is broken",
    status: "closed",
    age: 240,
    resolvedAgo: 216,
    closedAgo: 120,
    customerFollowUp: true,
  },
];

const AGENT_REPLIES = {
  open: "Thanks for reporting this. I'm looking into it and will update you here.",
  pending:
    "Could you send us a little more detail? We'll carry on as soon as we hear back.",
  on_hold:
    "We've passed this to our engineering team and will update you once they respond.",
  resolved: "This should be fixed now. Let us know if you still see the issue.",
  closed: "This is sorted on our side, so we're closing this ticket.",
};

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
  const roster = STAFF_BY_PLAN[spec.plan];

  return {
    staff: roster.map((staff, slot) => ({
      ...staff,
      label: ROLE_LABELS[staff.role],
      email: email(staff.local),
      fullName: person(slot),
    })),
    customers: CUSTOMER_LOCALS.map((local, i) => ({
      email: email(local),
      fullName: person(roster.length + i),
      company:
        CUSTOMER_COMPANIES[(tenantIndex * 2 + i) % CUSTOMER_COMPANIES.length],
      // 555-01xx numbers are reserved for fiction.
      phone: `+1-202-555-01${String(tenantIndex * 2 + i).padStart(2, "0")}`,
    })),
  };
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
  for (const customer of customers) {
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
    customerRows.push(row);
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

  const agentIds = staff
    .filter((member) => member.role === "agent")
    .map((member) => staffIds.get(member.local));
  const ticketCount = await seedTickets(tenantId, customerRows, agentIds, slug);
  const invoiceCount =
    Number(plan.price_month) > 0
      ? await seedInvoices(tenantId, spec, plan, owner.email, slug)
      : 0;

  return { staff: staff.length, tickets: ticketCount, invoices: invoiceCount };
}

/** Tickets go in as one statement per tenant; the number trigger handles that. */
async function seedTickets(tenantId, customerRows, agentIds, slug) {
  const planned = customerRows.flatMap((customer, c) =>
    TICKET_PLAN.map((item, i) => ({ item, customer, c, i })),
  );

  const tickets = await must(
    supabase
      .from("tickets")
      .insert(
        planned.map(({ item, customer, c, i }) => ({
          tenant_id: tenantId,
          subject: item.subject,
          description: `${item.subject}. Reported through the customer portal. Please take a look when you can.`,
          status: item.status,
          priority: PRIORITIES[(i + c) % PRIORITIES.length],
          requester_customer_id: customer.id,
          // New tickets are still in the queue, with nobody on them.
          assignee_user_id:
            item.status === "new"
              ? null
              : agentIds[(c * TICKET_PLAN.length + i) % agentIds.length],
          created_at: hoursAgo(item.age),
          resolved_at: item.resolvedAgo ? hoursAgo(item.resolvedAgo) : null,
          closed_at: item.closedAgo ? hoursAgo(item.closedAgo) : null,
        })),
      )
      .select("id, subject, status, assignee_user_id, requester_customer_id"),
    `tickets ${slug}`,
  );

  const messages = tickets.flatMap((ticket) => {
    if (ticket.status === "new") return [];

    const item = TICKET_PLAN.find((t) => t.subject === ticket.subject);
    // Every row carries every key: a bulk insert sends null for a missing one.
    const base = {
      tenant_id: tenantId,
      ticket_id: ticket.id,
      visibility: "public",
    };
    // Staged inside the ticket's life: first answer an hour in, the rest later.
    const repliedAt = hoursAgo(item.age - 1);
    const laterAt = hoursAgo(item.age - 2);
    const rows = [
      {
        ...base,
        author_type: "agent",
        author_id: ticket.assignee_user_id,
        body: AGENT_REPLIES[ticket.status],
        created_at: repliedAt,
      },
    ];
    if (item.customerFollowUp) {
      rows.push({
        ...base,
        author_type: "customer",
        author_id: ticket.requester_customer_id,
        body:
          ticket.status === "open"
            ? "Thanks. It happened again this morning, if that helps."
            : "Thanks, that worked for us.",
        created_at: laterAt,
      });
    }
    if (item.internalNote) {
      rows.push({
        ...base,
        author_type: "agent",
        author_id: ticket.assignee_user_id,
        body: "Waiting on engineering. Check in with them before replying again.",
        visibility: "internal",
        created_at: laterAt,
      });
    }
    return rows;
  });

  await must(
    supabase.from("ticket_messages").insert(messages),
    `ticket_messages ${slug}`,
  );

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
      staff: STAFF_BY_PLAN[spec.plan].length,
      customers: CUSTOMER_LOCALS.length,
      tickets: CUSTOMER_LOCALS.length * TICKET_PLAN.length,
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

const password = process.env.SEED_PASSWORD ?? DEFAULT_PASSWORD;

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
  console.log(`Password for all of the above: ${password}`);
}
