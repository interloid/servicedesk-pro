#!/usr/bin/env node
/**
 * PayPal SANDBOX catalog for a development project: one product, and a Pro and
 * a Business monthly plan under it. Run by bootstrap-development.yml.
 *
 *   node scripts/ci/bootstrap/paypal-sandbox.mjs plans    product + plans
 *   node scripts/ci/bootstrap/paypal-sandbox.mjs webhook  webhook endpoint
 *
 * plans
 *   Input: PLANS_JSON, the paid rows of public.plans
 *   ([{ name, code, price_month, paypal_product_id }]).
 *   - Already provisioned (every run after the first): both plans carry a real
 *     plan id and a product id. They are only READ from PayPal and checked, and
 *     nothing is created.
 *   - First run (PAYPAL-PENDING-* placeholders): the product and the plans are
 *     created. Anything a failed earlier run already created is found first and
 *     reused, so a retry never makes a second set.
 *   - A plan whose price, currency, interval or product differs from what the
 *     database expects is never reused or changed: the step fails.
 *   Output ($GITHUB_OUTPUT): product_id, pro_plan_id, business_plan_id, status.
 *
 *   Adopting existing plans: set PAYPAL_PRO_PLAN_ID and PAYPAL_BUSINESS_PLAN_ID
 *   to plans that already exist in the sandbox. They are checked the same way
 *   and written to public.plans; nothing is created in PayPal.
 *
 * webhook
 *   Registers https://<ref>.supabase.co/functions/v1/paypal-webhook with the
 *   events supabase/functions/paypal-webhook handles, if it isn't registered.
 *   Output: webhook_id, webhook_status.
 *
 * Sandbox only: the API host is fixed, and a live PAYPAL_BASE_URL is refused.
 * Credentials never reach the log.
 */
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const SANDBOX_URL = "https://api-m.sandbox.paypal.com";

/** The fixed catalog id is the product's dedupe key across runs. */
export const PRODUCT = {
  id: "SERVICEDESK-PRO",
  name: "ServiceDesk",
  description: "ServiceDesk help desk subscriptions",
  type: "SERVICE",
  category: "SOFTWARE",
};

/** Paid plans in public.plans (by name) and the PayPal plan each maps to. */
export const PAID_PLANS = [
  { key: "pro", name: "Pro", paypalName: "ServiceDesk Pro Monthly" },
  {
    key: "business",
    name: "Business",
    paypalName: "ServiceDesk Business Monthly",
  },
];

/** What supabase/functions/paypal-webhook/handlers.ts handles. */
export const WEBHOOK_EVENTS = [
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.SALE.DENIED",
  "PAYMENT.SALE.REFUNDED",
];

export const PLACEHOLDER_PREFIX = "PAYPAL-PENDING-";
const CURRENCY = "USD";

export function assertSandbox(baseUrl) {
  const value = (baseUrl ?? "").trim().replace(/\/+$/, "");
  if (value && value !== SANDBOX_URL) {
    throw new Error(
      `PAYPAL_BASE_URL is ${value}. The bootstrap only talks to the PayPal sandbox (${SANDBOX_URL}).`,
    );
  }
}

/**
 * Same key for the same resource on the same project, so a retried POST is
 * answered from PayPal's idempotency cache instead of creating a duplicate.
 */
export function requestId(projectRef, resource) {
  return `sd-bootstrap-${projectRef}-${resource}-v1`;
}

export function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`Invalid plan price: ${value}`);
  }
  return number.toFixed(2);
}

/** Request body for a new monthly plan. Seat-ready: quantity is supported. */
export function planBody(productId, plan, price) {
  return {
    product_id: productId,
    name: plan.paypalName,
    description: `ServiceDesk ${plan.name}, billed monthly per agent`,
    status: "ACTIVE",
    billing_cycles: [
      {
        frequency: { interval_unit: "MONTH", interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: {
          fixed_price: { value: money(price), currency_code: CURRENCY },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee_failure_action: "CONTINUE",
      payment_failure_threshold: 3,
    },
    quantity_supported: true,
  };
}

/**
 * Problems that stop a PayPal plan being used for `plan`. Empty means usable.
 * `productId` may be null when any product is acceptable (the caller checks
 * that both plans share one).
 */
export function planProblems(paypalPlan, { price, productId }) {
  const problems = [];
  if (paypalPlan.status !== "ACTIVE") {
    problems.push(`status is ${paypalPlan.status}, not ACTIVE`);
  }
  if (productId && paypalPlan.product_id !== productId) {
    problems.push(
      `belongs to product ${paypalPlan.product_id}, not ${productId}`,
    );
  }
  const regular = (paypalPlan.billing_cycles ?? []).filter(
    (cycle) => cycle.tenure_type === "REGULAR",
  );
  if (regular.length !== 1) {
    problems.push(`has ${regular.length} regular billing cycles, expected 1`);
  } else {
    const [cycle] = regular;
    const frequency = cycle.frequency ?? {};
    if (frequency.interval_unit !== "MONTH" || frequency.interval_count !== 1) {
      problems.push(
        `bills every ${frequency.interval_count} ${frequency.interval_unit}, not monthly`,
      );
    }
    const fixed = cycle.pricing_scheme?.fixed_price ?? {};
    if (fixed.currency_code !== CURRENCY) {
      problems.push(`is priced in ${fixed.currency_code}, not ${CURRENCY}`);
    }
    if (money(fixed.value ?? 0) !== money(price)) {
      problems.push(`costs ${fixed.value}, the database says ${money(price)}`);
    }
  }
  if (
    (paypalPlan.billing_cycles ?? []).some(
      (cycle) => cycle.tenure_type === "TRIAL",
    )
  ) {
    problems.push("has a PayPal trial cycle (trials are app-level)");
  }
  return problems;
}

/** True when both paid plans already carry a real PayPal plan id and product. */
export function isProvisioned(rows) {
  return PAID_PLANS.every((plan) => {
    const row = rows.find((r) => r.name === plan.name);
    return (
      row &&
      row.paypal_product_id &&
      row.code &&
      !row.code.startsWith(PLACEHOLDER_PREFIX)
    );
  });
}

export function parseRows(json) {
  let rows;
  try {
    rows = JSON.parse(json ?? "");
  } catch {
    throw new Error("PLANS_JSON is not valid JSON.");
  }
  if (!Array.isArray(rows)) throw new Error("PLANS_JSON must be an array.");
  for (const plan of PAID_PLANS) {
    if (!rows.some((row) => row.name === plan.name)) {
      throw new Error(
        `public.plans has no '${plan.name}' row. Run the plans seed first.`,
      );
    }
  }
  return rows;
}

/** A small PayPal REST client. `fetchImpl` is injectable for tests. */
export function createClient({
  clientId,
  clientSecret,
  fetchImpl = fetch,
  baseUrl = SANDBOX_URL,
}) {
  let token = null;

  async function accessToken() {
    if (token) return token;
    const response = await fetchImpl(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
      throw new Error(
        `PayPal sandbox rejected the credentials (HTTP ${response.status}${data.error ? `, ${data.error}` : ""}). PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be a sandbox REST app's.`,
      );
    }
    token = data.access_token;
    return token;
  }

  async function call(method, path, { body, requestKey, allow = [] } = {}) {
    const headers = {
      Authorization: `Bearer ${await accessToken()}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (requestKey) headers["PayPal-Request-Id"] = requestKey;
    if (method === "POST") headers.Prefer = "return=representation";
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && !allow.includes(response.status)) {
      const detail = [
        data.name,
        data.message,
        data.debug_id && `debug_id ${data.debug_id}`,
      ]
        .filter(Boolean)
        .join(", ");
      throw new Error(
        `PayPal ${method} ${path.split("?")[0]} failed: HTTP ${response.status}${detail ? ` (${detail})` : ""}`,
      );
    }
    return { status: response.status, data };
  }

  return { call };
}

async function listPlans(client, productId) {
  const plans = [];
  for (let page = 1; page <= 20; page++) {
    const { data } = await client.call(
      "GET",
      `/v1/billing/plans?product_id=${encodeURIComponent(productId)}&page_size=20&page=${page}&total_required=true`,
    );
    plans.push(...(data.plans ?? []));
    const totalPages = data.total_pages ?? 1;
    if (page >= totalPages || (data.plans ?? []).length === 0) break;
  }
  return plans;
}

async function getPlan(client, id) {
  const { status, data } = await client.call(
    "GET",
    `/v1/billing/plans/${encodeURIComponent(id)}`,
    { allow: [404] },
  );
  return status === 404 ? null : data;
}

/**
 * The product to put the plans under: the one already recorded, else the
 * fixed-id product (created if missing).
 */
async function ensureProduct(client, rows, projectRef, log) {
  const recorded = [
    ...new Set(rows.map((r) => r.paypal_product_id).filter(Boolean)),
  ];
  if (recorded.length > 1) {
    throw new Error(
      `public.plans names more than one PayPal product (${recorded.join(", ")}). Every paid plan must share one product; fix the rows by hand.`,
    );
  }
  const id = recorded[0] ?? PRODUCT.id;
  const existing = await client.call(
    "GET",
    `/v1/catalogs/products/${encodeURIComponent(id)}`,
    { allow: [404] },
  );
  if (existing.status !== 404) {
    log(`  reuse   product ${id}`);
    return { id, created: false };
  }
  if (recorded[0]) {
    throw new Error(
      `public.plans records PayPal product ${id}, which this sandbox account doesn't have. Are these the right sandbox credentials?`,
    );
  }
  await client.call("POST", "/v1/catalogs/products", {
    body: PRODUCT,
    requestKey: requestId(projectRef, "product"),
  });
  log(`  create  product ${id}`);
  return { id, created: true };
}

/**
 * Makes sure the sandbox has the product and both plans, and returns their
 * ids. Never changes an existing PayPal plan.
 */
/**
 * Adopts plans that already exist in the sandbox, named by id
 * (PAYPAL_PRO_PLAN_ID / PAYPAL_BUSINESS_PLAN_ID). They are checked like any
 * reused plan -- active, monthly, USD, the database's price, one shared
 * product -- and never changed. Nothing is created.
 */
export async function adoptPlans({ client, rows, pinned, log }) {
  const ids = {};
  let productId = null;
  for (const plan of PAID_PLANS) {
    const id = pinned[plan.key];
    const row = rows.find((r) => r.name === plan.name);
    const paypalPlan = await getPlan(client, id);
    if (!paypalPlan) {
      throw new Error(
        `PayPal plan ${id} (${plan.name}) doesn't exist in this sandbox account.`,
      );
    }
    productId ??= paypalPlan.product_id;
    const problems = planProblems(paypalPlan, {
      price: row.price_month,
      productId,
    });
    if (problems.length) {
      throw new Error(
        `PayPal plan ${id} (${plan.name}) ${problems.join("; ")}. Nothing was changed.`,
      );
    }
    ids[plan.key] = id;
    log(`  adopt   ${plan.name} plan ${id} (${paypalPlan.name})`);
  }
  log(`  adopt   product ${productId}`);
  const unchanged = PAID_PLANS.every((plan) => {
    const row = rows.find((r) => r.name === plan.name);
    return row.code === ids[plan.key] && row.paypal_product_id === productId;
  });
  return { productId, ids, status: unchanged ? "unchanged" : "adopted" };
}

/** Both pinned ids, or neither. */
export function pinnedPlans(env) {
  const pro = (env.PAYPAL_PRO_PLAN_ID ?? "").trim();
  const business = (env.PAYPAL_BUSINESS_PLAN_ID ?? "").trim();
  if (!pro && !business) return null;
  if (!pro || !business) {
    throw new Error(
      "Set both PAYPAL_PRO_PLAN_ID and PAYPAL_BUSINESS_PLAN_ID to adopt existing plans, or neither to let the bootstrap create them.",
    );
  }
  if (pro === business) {
    throw new Error(
      "PAYPAL_PRO_PLAN_ID and PAYPAL_BUSINESS_PLAN_ID are the same plan.",
    );
  }
  return { pro, business };
}

export async function provisionPlans({
  client,
  rows,
  projectRef,
  log,
  pinned,
}) {
  // Existing plans named in GitHub: adopt them.
  if (pinned) return adoptPlans({ client, rows, pinned, log });

  // Every run after the first: read and check only.
  if (isProvisioned(rows)) {
    const productId = rows.find(
      (r) => r.name === PAID_PLANS[0].name,
    ).paypal_product_id;
    const ids = {};
    for (const plan of PAID_PLANS) {
      const row = rows.find((r) => r.name === plan.name);
      if (row.paypal_product_id !== productId) {
        throw new Error(
          "Pro and Business are recorded under different PayPal products. Upgrades between them would fail; fix the rows by hand.",
        );
      }
      const paypalPlan = await getPlan(client, row.code);
      if (!paypalPlan) {
        throw new Error(
          `${plan.name}'s plan ${row.code} doesn't exist in this sandbox account. Are these the right sandbox credentials?`,
        );
      }
      const problems = planProblems(paypalPlan, {
        price: row.price_month,
        productId,
      });
      if (problems.length) {
        throw new Error(
          `${plan.name}'s PayPal plan ${row.code} ${problems.join("; ")}. Nothing was changed.`,
        );
      }
      ids[plan.key] = row.code;
      log(`  ok      ${plan.name} plan ${row.code}`);
    }
    log("PayPal plans already provisioned; nothing created.");
    return { productId, ids, status: "unchanged" };
  }

  // First run, or a retry of one that stopped part way.
  const product = await ensureProduct(client, rows, projectRef, log);
  const existing = await listPlans(client, product.id);
  const ids = {};
  let created = product.created;

  for (const plan of PAID_PLANS) {
    const row = rows.find((r) => r.name === plan.name);
    const price = row.price_month;
    const matches = existing.filter(
      (p) => p.name === plan.paypalName && p.status === "ACTIVE",
    );
    if (matches.length > 1) {
      throw new Error(
        `The sandbox has ${matches.length} active '${plan.paypalName}' plans under ${product.id}. Deactivate the extras in PayPal, then re-run.`,
      );
    }
    if (matches.length === 1) {
      // The list endpoint omits billing cycles; read the plan in full.
      const full = await getPlan(client, matches[0].id);
      const problems = planProblems(full ?? {}, {
        price,
        productId: product.id,
      });
      if (problems.length) {
        throw new Error(
          `Existing PayPal plan ${matches[0].id} ('${plan.paypalName}') ${problems.join("; ")}. It is not reused or changed. Deactivate it in PayPal, or fix public.plans, then re-run.`,
        );
      }
      ids[plan.key] = matches[0].id;
      log(`  reuse   ${plan.name} plan ${matches[0].id}`);
      continue;
    }
    const { data } = await client.call("POST", "/v1/billing/plans", {
      body: planBody(product.id, plan, price),
      requestKey: requestId(projectRef, `plan-${plan.key}`),
    });
    if (!data.id) throw new Error(`PayPal returned no id for ${plan.name}.`);
    ids[plan.key] = data.id;
    created = true;
    log(
      `  create  ${plan.name} plan ${data.id} (${money(price)} ${CURRENCY}/month per agent)`,
    );
  }

  return { productId: product.id, ids, status: created ? "created" : "reused" };
}

export function webhookUrl(projectRef) {
  return `https://${projectRef}.supabase.co/functions/v1/paypal-webhook`;
}

export async function ensureWebhook({ client, projectRef, log }) {
  const url = webhookUrl(projectRef);
  const { data } = await client.call("GET", "/v1/notifications/webhooks");
  const found = (data.webhooks ?? []).find((w) => w.url === url);

  if (!found) {
    const { data: createdHook } = await client.call(
      "POST",
      "/v1/notifications/webhooks",
      {
        body: {
          url,
          event_types: WEBHOOK_EVENTS.map((name) => ({ name })),
        },
        requestKey: requestId(projectRef, "webhook"),
      },
    );
    log(`  create  webhook ${createdHook.id} -> ${url}`);
    return { id: createdHook.id, status: "created" };
  }

  const subscribed = new Set((found.event_types ?? []).map((e) => e.name));
  const missing = subscribed.has("*")
    ? []
    : WEBHOOK_EVENTS.filter((name) => !subscribed.has(name));
  if (missing.length === 0) {
    log(`  ok      webhook ${found.id} -> ${url}`);
    return { id: found.id, status: "unchanged" };
  }

  // Add what's missing; events already subscribed stay subscribed.
  await client.call(
    "PATCH",
    `/v1/notifications/webhooks/${encodeURIComponent(found.id)}`,
    {
      body: [
        {
          op: "replace",
          path: "/event_types",
          value: [...subscribed, ...missing].map((name) => ({ name })),
        },
      ],
    },
  );
  log(`  update  webhook ${found.id}: added ${missing.join(", ")}`);
  return { id: found.id, status: "updated" };
}

function output(values) {
  const file = process.env.GITHUB_OUTPUT;
  const lines = Object.entries(values).map(([k, v]) => `${k}=${v}`);
  if (file) appendFileSync(file, `${lines.join("\n")}\n`);
  else console.log(lines.join("\n"));
}

async function main() {
  const command = process.argv[2];
  assertSandbox(process.env.PAYPAL_BASE_URL);
  const projectRef = process.env.SUPABASE_PROJECT_REF ?? "";
  const clientId = process.env.PAYPAL_CLIENT_ID ?? "";
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET ?? "";
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error("SUPABASE_PROJECT_REF is missing or malformed.");
  }
  if (!clientId || !clientSecret) {
    throw new Error(
      "Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (sandbox) in the development environment.",
    );
  }
  const client = createClient({ clientId, clientSecret });
  const log = (line) => console.log(line);

  if (command === "plans") {
    const rows = parseRows(process.env.PLANS_JSON);
    const pinned = pinnedPlans(process.env);
    const result = await provisionPlans({
      client,
      rows,
      projectRef,
      log,
      pinned,
    });
    output({
      product_id: result.productId,
      pro_plan_id: result.ids.pro,
      business_plan_id: result.ids.business,
      status: result.status,
    });
  } else if (command === "webhook") {
    const result = await ensureWebhook({ client, projectRef, log });
    output({ webhook_id: result.id, webhook_status: result.status });
  } else {
    throw new Error("Usage: paypal-sandbox.mjs plans|webhook");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.log(`::error::${error.message}`);
    process.exit(1);
  });
}
