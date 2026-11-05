/**
 * Read traffic against the throwaway E2E stack. Run it with scripts/load-test.sh,
 * which starts the app and refuses anything but a local database.
 *
 * Writes (new tickets, replies) and sign-in are not covered yet. Open-model
 * arrival rates are used so a slow server shows up as latency and dropped
 * iterations, rather than quietly receiving fewer requests.
 */
import { check } from "k6";
import http from "k6/http";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3100";
const PROFILE = __ENV.PROFILE || "smoke";

if (
  !["localhost", "127.0.0.1"].includes(BASE_URL.split("/")[2].split(":")[0])
) {
  throw new Error(`Refusing to load test non-local ${BASE_URL}.`);
}

// Without this k6 treats a 3xx as success, and an overloaded Auth reads as signed
// out: a fast redirect to sign-in would look like a healthy response.
http.setResponseCallback(http.expectedStatuses(200));

const PRO = "seed-cedar";
const BUSINESS = "seed-juniper";

// Requests per second across all traffic, per stage.
const PROFILES = {
  smoke: [{ target: 3, duration: "30s" }],
  load: [
    { target: 10, duration: "1m" },
    { target: 10, duration: "3m" },
    { target: 0, duration: "30s" },
  ],
  stress: [
    { target: 20, duration: "1m" },
    { target: 40, duration: "1m" },
    { target: 80, duration: "1m" },
    { target: 160, duration: "1m" },
    { target: 320, duration: "1m" },
    { target: 0, duration: "30s" },
  ],
  spike: [
    { target: 5, duration: "30s" },
    { target: 50, duration: "10s" },
    { target: 50, duration: "1m" },
    { target: 5, duration: "10s" },
    { target: 5, duration: "1m" },
  ],
};

if (!PROFILES[PROFILE]) {
  throw new Error(`Unknown profile ${PROFILE}: ${Object.keys(PROFILES)}`);
}

// The traffic mix is an assumption: mostly staff working in the app.
function scenario(exec, share) {
  return {
    executor: "ramping-arrival-rate",
    exec,
    // Stage targets must be whole numbers, so count per 10 seconds.
    timeUnit: "10s",
    startRate: 0,
    preAllocatedVUs: 20,
    maxVUs: 200,
    stages: PROFILES[PROFILE].map(({ duration, target }) => ({
      duration,
      target: Math.round(target * share * 10),
    })),
  };
}

export const options = {
  scenarios: {
    staff: scenario("staff", 0.6),
    portal: scenario("portal", 0.2),
    anonymous: scenario("anonymous", 0.2),
  },
  // Starting targets, not agreed SLOs. Stress and spike are expected to cross them.
  thresholds: {
    checks: ["rate>0.99"],
    http_req_failed: ["rate<0.01"],
    "http_req_duration{traffic:staff}": ["p(95)<1500"],
    "http_req_duration{traffic:portal}": ["p(95)<1500"],
    "http_req_duration{traffic:anonymous}": ["p(95)<800"],
    dropped_iterations: ["count<1"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
  // A sign of trouble here is a redirect to sign-in, so redirects are never followed.
  maxRedirects: 0,
};

// Saved by the Playwright setup project; load-test.sh refreshes them first.
function cookieHeader(account) {
  const { cookies } = JSON.parse(open(`../.e2e/auth/${account}.json`));

  return cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
}

const SESSIONS = {
  proAdmin: cookieHeader("proAdmin"),
  proAgent: cookieHeader("proAgent"),
  businessAdmin: cookieHeader("businessAdmin"),
  businessAgent: cookieHeader("businessAgent"),
  proCustomer: cookieHeader("proCustomer"),
  businessCustomer: cookieHeader("businessCustomer"),
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function idsFrom(html, pattern) {
  return [...new Set([...html.matchAll(pattern)].map((match) => match[1]))];
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function setup() {
  const tickets = (slug, session) =>
    idsFrom(
      http.get(`${BASE_URL}/${slug}/tickets`, {
        headers: { cookie: SESSIONS[session] },
      }).body,
      new RegExp(`/${slug}/tickets/(${UUID})`, "g"),
    );
  const requests = idsFrom(
    http.get(`${BASE_URL}/${PRO}/portal/requests`, {
      headers: { cookie: SESSIONS.proCustomer },
    }).body,
    new RegExp(`/${PRO}/portal/requests/(${UUID})`, "g"),
  );
  const data = {
    proTickets: tickets(PRO, "proAdmin"),
    businessTickets: tickets(BUSINESS, "businessAdmin"),
    requests,
  };

  if (!data.proTickets.length || !data.businessTickets.length) {
    throw new Error("No tickets found: are the saved sessions still valid?");
  }

  return data;
}

function visit(traffic, page, url, session, extraHeaders = {}) {
  const response = http.get(`${BASE_URL}${url}`, {
    headers: { ...(session ? { cookie: session } : {}), ...extraHeaders },
    tags: { traffic, page },
  });

  if (__ENV.LOAD_DEBUG && response.status !== 200) {
    console.log(`${response.status} ${url} -> ${response.headers.Location}`);
  }

  check(
    response,
    {
      "answered 200": (r) => r.status === 200,
      "not an error screen": (r) =>
        !/something went wrong/i.test(String(r.body)),
      "not a sign-in screen": (r) =>
        traffic === "anonymous" ||
        !/sign in to your workspace/i.test(String(r.body)),
    },
    { traffic, page },
  );

  return response;
}

export function staff(data) {
  const onPro = Math.random() < 0.5;
  const slug = onPro ? PRO : BUSINESS;
  const session = onPro
    ? SESSIONS[pick(["proAdmin", "proAgent"])]
    : SESSIONS[pick(["businessAdmin", "businessAgent"])];
  const ticket = pick(onPro ? data.proTickets : data.businessTickets);
  const [page, path] = pick([
    ["tickets", "tickets"],
    ["tickets", "tickets"],
    ["tickets", "tickets"],
    ["ticket detail", `tickets/${ticket}`],
    ["ticket detail", `tickets/${ticket}`],
    ["ticket detail", `tickets/${ticket}`],
    ["customers", "customers"],
    ["sla", "sla"],
    ["views", "views"],
  ]);

  // Inside the app most navigation is a client-side RSC fetch, not a full page.
  if (Math.random() < 0.7) {
    // Next.js redirects an RSC request with no _rsc parameter. Sending no router
    // state renders the whole tree, so this is heavier than a real navigation.
    visit("staff", `${page} (rsc)`, `/${slug}/${path}?_rsc`, session, {
      rsc: "1",
    });
  } else {
    visit("staff", page, `/${slug}/${path}`, session);
  }
}

export function portal(data) {
  const session = SESSIONS.proCustomer;
  const [page, path] = pick([
    ["portal requests", "portal/requests"],
    ["portal requests", "portal/requests"],
    ["portal help", "portal/help"],
    ...(data.requests.length
      ? [["portal request", `portal/requests/${pick(data.requests)}`]]
      : []),
  ]);

  visit("portal", page, `/${PRO}/${path}`, session);
}

export function anonymous() {
  const [page, path] = pick([
    ["home", "/"],
    ["home", "/"],
    ["login", "/login"],
    ["setup", "/setup"],
    ["tenant login", `/${PRO}/login`],
    ["workspace status", `/api/workspace-status?slug=${PRO}`],
  ]);

  visit("anonymous", page, path);
}
