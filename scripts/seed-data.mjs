/**
 * Demo data for scripts/seed-tenants.mjs: workspaces, people and tickets.
 *
 * Everything here is FICTIONAL. Company names, people, addresses and phone
 * numbers are invented for the demo and are not real clients:
 *   - customer emails use the reserved .example domain, and staff emails use
 *     .seed.test, so no seeded address can ever receive mail;
 *   - phone numbers use 555-0100 to 555-0199, the range reserved for fiction.
 *
 * The e2e suite signs in with some of these accounts and looks for some of these
 * ticket subjects; scripts/seed-data.test.mjs checks the two stay in step.
 */

export const SLUG_PREFIX = "seed-";
export const STAFF_EMAIL_SUFFIX = ".seed.test";
export const CUSTOMER_EMAIL_TLD = ".example";
export const MIN_TENANTS = 10;
export const MAX_TENANTS = 15;

/** The platform console account: in no workspace, never tagged seed_tenant. */
export const PLATFORM_ADMIN_EMAIL = "platform-admin@servicedesk-pro.com";

// The first 10 alone cover every plan + subscription status pair.
// key -> slug "seed-<key>" and staff logins "<role>@<key>.seed.test".
export const TENANTS = [
  {
    key: "aurora",
    name: "Aurora Freight Logistics",
    industry: "Freight and logistics",
    city: "Denver, CO",
    areaCode: "303",
    plan: "Free",
    status: "trialing",
    tz: "America/Denver",
    customers: [
      {
        name: "Ryan Caldwell",
        company: "Summit Ridge Supply",
        domain: "summitridgesupply",
      },
      {
        name: "Megan Torres",
        company: "Front Range Building Materials",
        domain: "frontrangebuilding",
      },
    ],
  },
  {
    key: "bluepeak",
    name: "Bluepeak Software",
    industry: "Practice management software",
    city: "Austin, TX",
    areaCode: "512",
    plan: "Free",
    status: "active",
    tz: "America/Chicago",
    customers: [
      {
        name: "Jordan Ellis",
        company: "Lakeway Dental Partners",
        domain: "lakewaydental",
      },
      {
        name: "Priya Raman",
        company: "Hill Country Realty",
        domain: "hillcountryrealty",
      },
    ],
  },
  {
    key: "cedar",
    name: "Cedar Health Group",
    industry: "Clinic scheduling and billing services",
    city: "Boston, MA",
    areaCode: "617",
    plan: "Pro",
    status: "active",
    tz: "America/New_York",
    customers: [
      {
        name: "Dana Whitfield",
        company: "Northfield Family Clinic",
        domain: "northfieldclinic",
      },
      {
        name: "Marcus Bell",
        company: "Bayside Physical Therapy",
        domain: "baysidept",
      },
    ],
  },
  {
    key: "dunmore",
    name: "Dunmore Outfitters",
    industry: "Outdoor gear wholesale",
    city: "Minneapolis, MN",
    areaCode: "612",
    plan: "Business",
    status: "active",
    tz: "America/Chicago",
    customers: [
      {
        name: "Erik Lindqvist",
        company: "Lakeshore Ski & Board",
        domain: "lakeshoreski",
      },
      {
        name: "Hannah Brooks",
        company: "North Star Trail Supply",
        domain: "northstartrail",
      },
    ],
  },
  {
    key: "ember",
    name: "Ember Hospitality Group",
    industry: "Hotel and event venues",
    city: "Nashville, TN",
    areaCode: "615",
    plan: "Pro",
    status: "past_due",
    tz: "America/Chicago",
    customers: [
      {
        name: "Carlos Mendoza",
        company: "Riverfront Event Center",
        domain: "riverfrontevents",
      },
      {
        name: "Tessa Grant",
        company: "Music Row Catering",
        domain: "musicrowcatering",
      },
    ],
  },
  {
    key: "fernhill",
    name: "Fernhill Learning",
    industry: "K-12 learning platform",
    city: "Portland, OR",
    areaCode: "503",
    plan: "Business",
    status: "past_due",
    tz: "America/Los_Angeles",
    customers: [
      {
        name: "Grace Kim",
        company: "Willamette Valley School District",
        domain: "willamettevalleysd",
      },
      {
        name: "Daniel Ortiz",
        company: "Cascade Prep Academy",
        domain: "cascadeprep",
      },
    ],
  },
  {
    key: "granite",
    name: "Granite Ridge Financial",
    industry: "Small-business lending",
    city: "Charlotte, NC",
    areaCode: "704",
    plan: "Pro",
    status: "cancelled",
    tz: "America/New_York",
    customers: [
      {
        name: "Aaron Fletcher",
        company: "Piedmont Auto Group",
        domain: "piedmontauto",
      },
      {
        name: "Simone Carter",
        company: "Queen City Dental Care",
        domain: "queencitydental",
      },
    ],
  },
  {
    key: "harbor",
    name: "Harborline Shipping",
    industry: "Ocean freight forwarding",
    city: "Seattle, WA",
    areaCode: "206",
    plan: "Business",
    status: "expired",
    tz: "America/Los_Angeles",
    customers: [
      {
        name: "Kevin Nguyen",
        company: "Puget Sound Seafood Co.",
        domain: "pugetsoundseafood",
      },
      {
        name: "Laura Chen",
        company: "Elliott Bay Imports",
        domain: "elliottbayimports",
      },
    ],
  },
  {
    key: "ivory",
    name: "Ivory & Lane Legal",
    industry: "Legal services for property managers",
    city: "Chicago, IL",
    areaCode: "312",
    plan: "Pro",
    status: "active",
    tz: "America/Chicago",
    customers: [
      {
        name: "Brian Kowalski",
        company: "Wrigleyville Property Management",
        domain: "wrigleyvillepm",
      },
      {
        name: "Natalie Ruiz",
        company: "Lakeview Medical Billing",
        domain: "lakeviewbilling",
      },
    ],
  },
  {
    key: "juniper",
    name: "Juniper Ridge Energy",
    industry: "Commercial energy services",
    city: "Houston, TX",
    areaCode: "713",
    plan: "Business",
    status: "active",
    tz: "America/Chicago",
    customers: [
      {
        name: "Jasmine Patel",
        company: "Gulf Coast Fabrication",
        domain: "gulfcoastfab",
      },
      {
        name: "Robert Hayes",
        company: "Bayou City Electric",
        domain: "bayoucityelectric",
      },
    ],
  },
  {
    key: "kestrel",
    name: "Kestrel Media Group",
    industry: "Video production and post-production",
    city: "Los Angeles, CA",
    areaCode: "323",
    plan: "Free",
    status: "active",
    tz: "America/Los_Angeles",
    customers: [
      {
        name: "Olivia Park",
        company: "Sunset Lane Studios",
        domain: "sunsetlanestudios",
      },
      {
        name: "Andre Wallace",
        company: "Silver Lake Records",
        domain: "silverlakerecords",
      },
    ],
  },
  {
    key: "lumen",
    name: "Lumenfield Insurance",
    industry: "Commercial insurance brokerage",
    city: "Hartford, CT",
    areaCode: "860",
    plan: "Pro",
    status: "active",
    tz: "America/New_York",
    customers: [
      {
        name: "Michael Sullivan",
        company: "Connecticut River Builders",
        domain: "ctriverbuilders",
      },
      {
        name: "Rachel Goldberg",
        company: "Farmington Valley Pediatrics",
        domain: "farmingtonpeds",
      },
    ],
  },
  {
    key: "meridian",
    name: "Meridian Precision Manufacturing",
    industry: "Contract machining",
    city: "Cleveland, OH",
    areaCode: "216",
    plan: "Business",
    status: "active",
    tz: "America/New_York",
    customers: [
      {
        name: "Steven Novak",
        company: "Cuyahoga Tool & Die",
        domain: "cuyahogatool",
      },
      {
        name: "Angela Morris",
        company: "Lake Erie Plastics",
        domain: "lakeerieplastics",
      },
    ],
  },
  {
    key: "nimbus",
    name: "Nimbus Travel Co.",
    industry: "Corporate travel management",
    city: "San Diego, CA",
    areaCode: "619",
    plan: "Free",
    status: "trialing",
    tz: "America/Los_Angeles",
    customers: [
      {
        name: "Melissa Rivera",
        company: "Coronado Bay Resorts",
        domain: "coronadobayresorts",
      },
      {
        name: "Jason Wright",
        company: "Pacific Crest Tours",
        domain: "pacificcresttours",
      },
    ],
  },
  {
    key: "orchard",
    name: "Orchard Valley Foods",
    industry: "Fresh produce distribution",
    city: "Fresno, CA",
    areaCode: "559",
    plan: "Pro",
    status: "active",
    tz: "America/Los_Angeles",
    customers: [
      {
        name: "Linda Hernandez",
        company: "Central Valley Grocers",
        domain: "centralvalleygrocers",
      },
      {
        name: "Paul Anderson",
        company: "Sierra Fresh Markets",
        domain: "sierrafreshmarkets",
      },
    ],
  },
];

// Staff names, drawn in turn so no two people in a workspace share a name.
const STAFF_FIRST_NAMES = [
  "Sarah",
  "Michael",
  "Jessica",
  "David",
  "Emily",
  "James",
  "Ashley",
  "Christopher",
  "Amanda",
  "Daniel",
  "Lauren",
  "Matthew",
  "Rachel",
  "Andrew",
  "Nicole",
  "Joshua",
  "Stephanie",
  "Ryan",
  "Megan",
  "Brandon",
  "Kayla",
  "Justin",
  "Samantha",
  "Tyler",
  "Brittany",
  "Kevin",
  "Danielle",
  "Eric",
  "Alicia",
  "Marcus",
];

const STAFF_LAST_NAMES = [
  "Mitchell",
  "Johnson",
  "Patel",
  "Nguyen",
  "Rodriguez",
  "Thompson",
  "Kim",
  "Washington",
  "Garcia",
  "Murphy",
  "Chen",
  "Robinson",
  "Walker",
  "Lopez",
  "Hughes",
  "Bennett",
  "Coleman",
  "Foster",
  "Price",
  "Sanders",
  "Ramirez",
  "Jenkins",
  "Perry",
  "Russell",
  "Okafor",
];

export const ROLE_LABELS = {
  tenant_admin: "Tenant Admin",
  manager: "Manager",
  agent: "Agent",
  billing_admin: "Billing Admin",
};

export const OWNER = { local: "admin", role: "tenant_admin" };
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

export const STAFF_BY_PLAN = {
  Free: [OWNER, { local: "agent", role: "agent" }],
  Pro: [...CORE_STAFF, ...PRO_EXTRA_MANAGERS, ...PRO_EXTRA_AGENTS],
  Business: CORE_STAFF,
};

/** Lowercase dotted address, e.g. "dana.whitfield@northfieldclinic.example". */
function customerEmail(name, domain) {
  const local = name
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim()
    .split(/\s+/)
    .join(".");
  return `${local}@${domain}${CUSTOMER_EMAIL_TLD}`;
}

/** The staff and customers of one workspace, deterministic for a given index. */
export function peopleFor(spec, tenantIndex) {
  const roster = STAFF_BY_PLAN[spec.plan];
  const staffName = (slot) => {
    const n = tenantIndex * 7 + slot;
    const first = STAFF_FIRST_NAMES[n % STAFF_FIRST_NAMES.length];
    const last =
      STAFF_LAST_NAMES[(n * 3 + tenantIndex) % STAFF_LAST_NAMES.length];
    return `${first} ${last}`;
  };

  return {
    staff: roster.map((member, slot) => ({
      ...member,
      label: ROLE_LABELS[member.role],
      email: `${member.local}@${spec.key}${STAFF_EMAIL_SUFFIX}`,
      fullName: staffName(slot),
    })),
    customers: spec.customers.map((customer, i) => ({
      email: customerEmail(customer.name, customer.domain),
      fullName: customer.name,
      company: customer.company,
      phone: `+1-${spec.areaCode}-555-01${String(tenantIndex * 2 + i).padStart(2, "0")}`,
    })),
  };
}

/**
 * Two ticket sets of 10, one per customer, each covering every status.
 *
 * age:         hours before the seed runs that the ticket was opened.
 * resolvedAgo, closedAgo: hours ago. Resolved stays under the default 4-day
 *              auto-close, so sla_tick doesn't close them on its next run.
 * thread:      messages after the description. `at` is hours after the ticket
 *              was opened; `by` is agent (the assignee), customer (the
 *              requester) or note (internal, staff only).
 * Placeholders: {customer} and {agent} are first names, {company} is the
 *              customer's company, {tenant} the workspace.
 *
 * The e2e suite looks for "Cannot log in after password reset", "Dashboard
 * loads very slowly in the morning" and "Integration stopped syncing overnight"
 * in the first set.
 */
export const TICKET_PLANS = [
  [
    {
      subject: "Cannot log in after password reset",
      status: "new",
      priority: "high",
      age: 1,
      description:
        "I reset my password this morning with the link in the email, but the sign-in page keeps saying my credentials are invalid. I've tried twice and cleared my browser cache. I have approvals due by 3 PM today, so this is fairly urgent.",
      thread: [],
    },
    {
      subject: "Question about exporting our data",
      status: "new",
      priority: "low",
      age: 3,
      description:
        "Our finance team needs last year's activity in Excel for an audit. Is there a way to export everything as a CSV ourselves, or do we need to request it from you?",
      thread: [],
    },
    {
      subject: "Dashboard loads very slowly in the morning",
      status: "open",
      priority: "normal",
      age: 5,
      description:
        "Between about 8:00 and 9:30 AM the main dashboard takes 20 to 30 seconds to load for everyone in our office. Later in the day it's fine. About 25 of us use it, mostly in Chrome.",
      thread: [
        {
          by: "agent",
          at: 1,
          body: "Hi {customer}, thanks for the detail on timing, that helps a lot. I've asked our infrastructure team to look at morning load on your account, and I'll update you here by end of day.",
        },
        {
          by: "customer",
          at: 3,
          body: "Thanks {agent}. It happened again at 8:15 today, if that helps narrow it down.",
        },
      ],
    },
    {
      subject: "Invoice shows our old billing address",
      status: "open",
      priority: "normal",
      age: 30,
      description:
        "Our latest invoice still lists our old office address. We moved in August and updated it in our account settings. Could you reissue it with the new address? Our accounts payable team can't process it as is.",
      thread: [
        {
          by: "agent",
          at: 2,
          body: "Hi {customer}, sorry about that. I can see the new address on your account, so the invoice didn't pick up the change. I've asked our billing team to reissue it today.",
        },
        {
          by: "customer",
          at: 20,
          body: "Great, thank you. Could you also send the corrected copy to our AP inbox?",
        },
      ],
    },
    {
      subject: "Need a copy of last quarter's usage report",
      status: "pending",
      priority: "low",
      age: 6,
      description:
        "Our operations director needs the Q3 usage summary for a board meeting next Thursday.",
      thread: [
        {
          by: "agent",
          at: 1,
          body: "Happy to help, {customer}. Do you need the summary for all of {company}'s locations, or only the main site? Once you confirm, I'll have it to you within one business day.",
        },
      ],
    },
    {
      subject: "Attachment upload fails on large files",
      status: "pending",
      priority: "normal",
      age: 50,
      description:
        "When we attach scanned contracts over about 20 MB, the upload spins and then fails with no error message. Smaller files work fine.",
      thread: [
        {
          by: "agent",
          at: 2,
          body: "Thanks, {customer}. Uploads are limited to 20 MB per ticket. Could you tell us the file type and roughly how large the scans are? If they're PDFs, compressing them usually brings them well under the limit, and I can share the steps.",
        },
      ],
    },
    {
      subject: "Integration stopped syncing overnight",
      status: "on_hold",
      priority: "urgent",
      age: 8,
      description:
        "The nightly sync with our accounting system didn't run last night. The last successful sync was just before midnight two days ago, and today's orders aren't showing up. We close our books on Friday.",
      thread: [
        {
          by: "agent",
          at: 1,
          body: "Hi {customer}, I've confirmed the sync failed at 2:00 AM with an authorization error from the accounting connector. I've escalated it to our integrations team and will update you as soon as I hear back.",
        },
        {
          by: "note",
          at: 2,
          body: "Escalated to Integrations (INT-4471). Looks like the connector's access token expired after their admin changed passwords. Don't ask the customer to reconnect until Integrations confirms the fix.",
        },
      ],
    },
    {
      subject: "Wrong time zone on ticket timestamps",
      status: "resolved",
      priority: "low",
      age: 72,
      resolvedAgo: 20,
      description:
        "Times on our tickets show in UTC instead of our local time, which is confusing the team.",
      thread: [
        {
          by: "agent",
          at: 2,
          body: "Thanks for flagging this, {customer}. Your workspace was set to UTC when it was created. I've changed it to your local time zone, so timestamps should now show correctly. Could you refresh and confirm?",
        },
        {
          by: "customer",
          at: 30,
          body: "Confirmed, everything shows our local time now. Thanks!",
        },
      ],
    },
    {
      subject: "Please add a teammate to our account",
      status: "resolved",
      priority: "normal",
      age: 96,
      resolvedAgo: 30,
      description:
        "We've hired a new office manager, Alex Morgan, who needs access to submit and track requests. Can you add them?",
      thread: [
        {
          by: "agent",
          at: 3,
          body: "Done, {customer}. Alex has been invited and will get an email with a sign-in link. Let us know if it doesn't arrive within the hour.",
        },
        {
          by: "customer",
          at: 40,
          body: "Alex is in. Thanks for the quick turnaround.",
        },
      ],
    },
    {
      subject: "Portal link in the welcome email is broken",
      status: "closed",
      priority: "low",
      age: 240,
      resolvedAgo: 216,
      closedAgo: 120,
      description:
        "The 'Open your portal' button in the welcome email goes to a page-not-found error.",
      thread: [
        {
          by: "agent",
          at: 4,
          body: "Thanks for catching that, {customer}. The button pointed at an old address. It's fixed for all new welcome emails, and you can use the portal link on our website in the meantime.",
        },
        {
          by: "customer",
          at: 10,
          body: "Works now, thank you.",
        },
      ],
    },
  ],
  [
    {
      subject: "Can't find the purchase order we submitted Monday",
      status: "new",
      priority: "normal",
      age: 2,
      description:
        "We submitted a purchase order on Monday afternoon and got the confirmation screen, but it doesn't appear in our order history. Can you check whether it came through?",
      thread: [],
    },
    {
      subject: "Update our primary contact",
      status: "new",
      priority: "low",
      age: 4,
      description:
        "Our office manager is retiring at the end of the month. Please make me the primary contact on {company}'s account from now on.",
      thread: [],
    },
    {
      subject: "Order confirmation emails going to spam",
      status: "open",
      priority: "high",
      age: 10,
      description:
        "For the last week, order confirmations from you have landed in our spam folder. Our receiving team has missed two deliveries because of it.",
      thread: [
        {
          by: "agent",
          at: 1,
          body: "Hi {customer}, sorry for the trouble this caused your receiving team. We updated our email sending setup last week, and I'm checking whether your mail filter flagged the change. Could you forward one of the messages from your spam folder as an attachment?",
        },
        {
          by: "customer",
          at: 6,
          body: "Just forwarded one from this morning. Our IT person says the sender looked unverified.",
        },
      ],
    },
    {
      subject: "Charged twice for this month's renewal",
      status: "open",
      priority: "urgent",
      age: 26,
      description:
        "Our card was charged twice for this month's renewal, on the 1st and again on the 2nd. Please refund the duplicate charge.",
      thread: [
        {
          by: "agent",
          at: 1,
          body: "Hi {customer}, I can see both charges and I'm sorry about this. I've started a refund for the second one; it usually takes 5 to 7 business days to appear. I'll confirm here once it's processed on our side.",
        },
        {
          by: "customer",
          at: 4,
          body: "Thanks {agent}. Can you send a receipt for the refund for our records?",
        },
      ],
    },
    {
      subject: "Need a W-9 and certificate of insurance for vendor setup",
      status: "pending",
      priority: "low",
      age: 20,
      description:
        "Our accounting team needs a current W-9 and a certificate of insurance before they can renew you as a vendor.",
      thread: [
        {
          by: "agent",
          at: 2,
          body: "Of course, {customer}. Which legal entity name should appear as the certificate holder? Once you confirm, we'll send both documents the same day.",
        },
      ],
    },
    {
      subject: "Mobile app crashes when opening reports",
      status: "pending",
      priority: "normal",
      age: 40,
      description:
        "Since yesterday's update, the mobile app closes as soon as I open the Reports tab. The rest of the app works.",
      thread: [
        {
          by: "agent",
          at: 3,
          body: "Thanks for reporting this, {customer}. Could you tell us your phone model and operating system version, and whether reinstalling the app helps? That will tell us whether it's the issue our developers are already fixing.",
        },
      ],
    },
    {
      subject: "Scheduled delivery window was missed",
      status: "on_hold",
      priority: "high",
      age: 12,
      description:
        "Our delivery was scheduled for 7 to 9 AM today and never arrived. We had staff waiting on site. When can we expect it?",
      thread: [
        {
          by: "agent",
          at: 1,
          body: "Hi {customer}, I'm sorry about the missed window. The carrier reported a vehicle issue on the route this morning. I've asked them for a new delivery time and will update you as soon as they confirm.",
        },
        {
          by: "note",
          at: 3,
          body: "Carrier dispatch says the earliest slot is tomorrow 10 AM. Waiting on written confirmation before we promise it to the customer.",
        },
      ],
    },
    {
      subject: "How do I set up permissions for our new location?",
      status: "resolved",
      priority: "normal",
      age: 60,
      resolvedAgo: 24,
      description:
        "We're opening a second location next month. How do we give the new manager access to only their location's requests?",
      thread: [
        {
          by: "agent",
          at: 3,
          body: "Congratulations on the new location, {customer}! I've added a second location to {company}'s account and sent you a step-by-step guide for giving the new manager access to it only.",
        },
        {
          by: "customer",
          at: 20,
          body: "That worked perfectly. Thanks for the guide.",
        },
      ],
    },
    {
      subject: "Report totals don't match our spreadsheet",
      status: "resolved",
      priority: "normal",
      age: 120,
      resolvedAgo: 48,
      description:
        "The monthly summary report shows 412 orders for October, but our own spreadsheet has 418. Which number is right?",
      thread: [
        {
          by: "agent",
          at: 5,
          body: "Good question, {customer}. The report counts orders by the date they were confirmed, not the date they were placed. Six of your orders were placed on October 31 and confirmed on November 1, which explains the difference.",
        },
        {
          by: "customer",
          at: 30,
          body: "That explains it. We'll switch our spreadsheet to confirmation dates. Thanks!",
        },
      ],
    },
    {
      subject: "Cancel the duplicate account we opened by mistake",
      status: "closed",
      priority: "low",
      age: 300,
      resolvedAgo: 270,
      closedAgo: 150,
      description:
        "A colleague opened a second account for {company} by mistake. Please close it; nothing has been ordered on it.",
      thread: [
        {
          by: "agent",
          at: 6,
          body: "All done, {customer}. The duplicate account is closed and nothing was charged. Your main account isn't affected.",
        },
        {
          by: "customer",
          at: 12,
          body: "Perfect, thank you.",
        },
      ],
    },
  ],
];

/** Fills {customer}, {agent}, {company} and {tenant}. */
export function fillTemplate(text, values) {
  return text.replace(
    /\{(customer|agent|company|tenant)\}/g,
    (_, key) => values[key] ?? "",
  );
}

export const firstName = (fullName) => fullName.split(" ")[0];
