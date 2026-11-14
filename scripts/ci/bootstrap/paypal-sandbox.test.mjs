import { describe, expect, it } from "vitest";

import {
  PAID_PLANS,
  PRODUCT,
  WEBHOOK_EVENTS,
  assertSandbox,
  ensureWebhook,
  isProvisioned,
  parseRows,
  pinnedPlans,
  planBody,
  planProblems,
  provisionPlans,
  requestId,
} from "./paypal-sandbox.mjs";

const REF = "abcdefghijklmnopqrst";
const noop = () => {};

function paypalPlan({
  id,
  name,
  price,
  product = PRODUCT.id,
  status = "ACTIVE",
}) {
  return {
    id,
    name,
    status,
    product_id: product,
    billing_cycles: [
      {
        tenure_type: "REGULAR",
        frequency: { interval_unit: "MONTH", interval_count: 1 },
        pricing_scheme: { fixed_price: { value: price, currency_code: "USD" } },
      },
    ],
  };
}

const PENDING_ROWS = [
  {
    name: "Pro",
    code: "PAYPAL-PENDING-PRO",
    price_month: 29,
    paypal_product_id: null,
  },
  {
    name: "Business",
    code: "PAYPAL-PENDING-BUSINESS",
    price_month: 59,
    paypal_product_id: null,
  },
];

/**
 * A fake PayPal: `state` holds products and plans, and every request is
 * recorded in `calls`.
 */
function fakeClient(state = { products: {}, plans: [], webhooks: [] }) {
  const calls = [];
  let next = 1;
  return {
    state,
    calls,
    async call(method, path, { body, requestKey, allow = [] } = {}) {
      calls.push({ method, path, body, requestKey });
      const notFound = () => {
        if (!allow.includes(404)) throw new Error(`404 ${path}`);
        return { status: 404, data: {} };
      };
      let m;
      if (
        method === "GET" &&
        (m = path.match(/^\/v1\/catalogs\/products\/(.+)$/))
      ) {
        const p = state.products[decodeURIComponent(m[1])];
        return p ? { status: 200, data: p } : notFound();
      }
      if (method === "POST" && path === "/v1/catalogs/products") {
        state.products[body.id] = body;
        return { status: 201, data: body };
      }
      if (method === "GET" && path.startsWith("/v1/billing/plans?")) {
        const product = new URL(`https://x${path}`).searchParams.get(
          "product_id",
        );
        const plans = state.plans
          .filter((p) => p.product_id === product)
          .map(({ id, name, status, product_id }) => ({
            id,
            name,
            status,
            product_id,
          }));
        return { status: 200, data: { plans, total_pages: 1 } };
      }
      if (
        method === "GET" &&
        (m = path.match(/^\/v1\/billing\/plans\/(.+)$/))
      ) {
        const p = state.plans.find((x) => x.id === decodeURIComponent(m[1]));
        return p ? { status: 200, data: p } : notFound();
      }
      if (method === "POST" && path === "/v1/billing/plans") {
        const plan = {
          ...paypalPlan({
            id: `P-NEW${next++}AAAAAAAAAAAA`,
            name: body.name,
            price: body.billing_cycles[0].pricing_scheme.fixed_price.value,
            product: body.product_id,
          }),
        };
        state.plans.push(plan);
        return { status: 201, data: plan };
      }
      if (method === "GET" && path === "/v1/notifications/webhooks") {
        return { status: 200, data: { webhooks: state.webhooks } };
      }
      if (method === "POST" && path === "/v1/notifications/webhooks") {
        const hook = { id: `WH-${next++}`, ...body };
        state.webhooks.push(hook);
        return { status: 201, data: hook };
      }
      if (
        method === "PATCH" &&
        path.startsWith("/v1/notifications/webhooks/")
      ) {
        state.webhooks[0].event_types = body[0].value;
        return { status: 200, data: state.webhooks[0] };
      }
      throw new Error(`unexpected ${method} ${path}`);
    },
  };
}

describe("assertSandbox", () => {
  it("accepts sandbox or unset, refuses live", () => {
    expect(() => assertSandbox("")).not.toThrow();
    expect(() =>
      assertSandbox("https://api-m.sandbox.paypal.com/"),
    ).not.toThrow();
    expect(() => assertSandbox("https://api-m.paypal.com")).toThrow(
      /only talks to the PayPal sandbox/,
    );
  });
});

describe("requestId", () => {
  it("is deterministic per project and resource", () => {
    expect(requestId(REF, "plan-pro")).toBe(`sd-bootstrap-${REF}-plan-pro-v1`);
    expect(requestId(REF, "plan-pro")).toBe(requestId(REF, "plan-pro"));
  });
});

describe("planBody", () => {
  it("is a seat-ready monthly USD plan", () => {
    const body = planBody("PROD", PAID_PLANS[0], 29);
    expect(body.quantity_supported).toBe(true);
    expect(body.billing_cycles).toHaveLength(1);
    expect(body.billing_cycles[0].pricing_scheme.fixed_price).toEqual({
      value: "29.00",
      currency_code: "USD",
    });
    expect(body.billing_cycles[0].frequency).toEqual({
      interval_unit: "MONTH",
      interval_count: 1,
    });
  });
});

describe("planProblems", () => {
  it("flags price, product and status mismatches", () => {
    const plan = paypalPlan({
      id: "P-1",
      name: "x",
      price: "30.00",
      status: "INACTIVE",
    });
    const problems = planProblems(plan, { price: 29, productId: "OTHER" });
    expect(problems.join(" ")).toMatch(/INACTIVE/);
    expect(problems.join(" ")).toMatch(/OTHER/);
    expect(problems.join(" ")).toMatch(/costs 30.00/);
  });

  it("accepts a matching plan", () => {
    expect(
      planProblems(paypalPlan({ id: "P-1", name: "x", price: "29.00" }), {
        price: "29.00",
        productId: PRODUCT.id,
      }),
    ).toEqual([]);
  });
});

describe("parseRows / isProvisioned", () => {
  it("needs both paid plans", () => {
    expect(() => parseRows(JSON.stringify([PENDING_ROWS[0]]))).toThrow(
      /Business/,
    );
    expect(() => parseRows("nope")).toThrow(/JSON/);
  });

  it("treats placeholders as not provisioned", () => {
    expect(isProvisioned(PENDING_ROWS)).toBe(false);
    expect(
      isProvisioned(
        PENDING_ROWS.map((r, i) => ({
          ...r,
          code: `P-${i}`,
          paypal_product_id: "X",
        })),
      ),
    ).toBe(true);
  });
});

describe("provisionPlans", () => {
  it("creates the product and both plans on the first run, with idempotency keys", async () => {
    const client = fakeClient();
    const result = await provisionPlans({
      client,
      rows: PENDING_ROWS,
      projectRef: REF,
      log: noop,
    });
    expect(result.status).toBe("created");
    expect(result.productId).toBe(PRODUCT.id);
    expect(client.state.plans).toHaveLength(2);
    const posts = client.calls.filter((c) => c.method === "POST");
    expect(posts.map((c) => c.requestKey)).toEqual([
      requestId(REF, "product"),
      requestId(REF, "plan-pro"),
      requestId(REF, "plan-business"),
    ]);
  });

  it("reuses what a failed earlier run created instead of making a second set", async () => {
    const client = fakeClient();
    await provisionPlans({
      client,
      rows: PENDING_ROWS,
      projectRef: REF,
      log: noop,
    });
    // The database write never happened, so the rows still have placeholders.
    const again = await provisionPlans({
      client,
      rows: PENDING_ROWS,
      projectRef: REF,
      log: noop,
    });
    expect(again.status).toBe("reused");
    expect(client.state.plans).toHaveLength(2);
    expect(Object.keys(client.state.products)).toHaveLength(1);
  });

  it("only reads PayPal once the plans are provisioned", async () => {
    const client = fakeClient();
    const first = await provisionPlans({
      client,
      rows: PENDING_ROWS,
      projectRef: REF,
      log: noop,
    });
    const rows = PENDING_ROWS.map((r) => ({
      ...r,
      code: r.name === "Pro" ? first.ids.pro : first.ids.business,
      paypal_product_id: first.productId,
    }));
    client.calls.length = 0;
    const result = await provisionPlans({
      client,
      rows,
      projectRef: REF,
      log: noop,
    });
    expect(result.status).toBe("unchanged");
    expect(client.calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("refuses an existing plan whose price differs, and changes nothing", async () => {
    const client = fakeClient({
      products: { [PRODUCT.id]: PRODUCT },
      plans: [
        paypalPlan({
          id: "P-OLD",
          name: "ServiceDesk Pro Monthly",
          price: "25.00",
        }),
      ],
      webhooks: [],
    });
    await expect(
      provisionPlans({
        client,
        rows: PENDING_ROWS,
        projectRef: REF,
        log: noop,
      }),
    ).rejects.toThrow(/costs 25.00.*not reused or changed/);
    expect(client.calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("fails when a provisioned plan's price no longer matches the database", async () => {
    const client = fakeClient({
      products: { [PRODUCT.id]: PRODUCT },
      plans: [
        paypalPlan({
          id: "P-PRO",
          name: "ServiceDesk Pro Monthly",
          price: "29.00",
        }),
        paypalPlan({
          id: "P-BIZ",
          name: "ServiceDesk Business Monthly",
          price: "59.00",
        }),
      ],
      webhooks: [],
    });
    const rows = [
      {
        name: "Pro",
        code: "P-PRO",
        price_month: 29,
        paypal_product_id: PRODUCT.id,
      },
      {
        name: "Business",
        code: "P-BIZ",
        price_month: 79,
        paypal_product_id: PRODUCT.id,
      },
    ];
    await expect(
      provisionPlans({ client, rows, projectRef: REF, log: noop }),
    ).rejects.toThrow(/Business.*costs 59.00/);
  });
});

describe("ensureWebhook", () => {
  it("creates the webhook once, then leaves it alone", async () => {
    const client = fakeClient();
    const first = await ensureWebhook({ client, projectRef: REF, log: noop });
    expect(first.status).toBe("created");
    expect(client.state.webhooks[0].url).toBe(
      `https://${REF}.supabase.co/functions/v1/paypal-webhook`,
    );
    expect(client.state.webhooks[0].event_types.map((e) => e.name)).toEqual(
      WEBHOOK_EVENTS,
    );
    const second = await ensureWebhook({ client, projectRef: REF, log: noop });
    expect(second).toEqual({ id: first.id, status: "unchanged" });
  });

  it("adds missing events without dropping existing ones", async () => {
    const client = fakeClient({
      products: {},
      plans: [],
      webhooks: [
        {
          id: "WH-1",
          url: `https://${REF}.supabase.co/functions/v1/paypal-webhook`,
          event_types: [
            { name: "BILLING.SUBSCRIPTION.ACTIVATED" },
            { name: "CUSTOM.EVENT" },
          ],
        },
      ],
    });
    const result = await ensureWebhook({ client, projectRef: REF, log: noop });
    expect(result.status).toBe("updated");
    const names = client.state.webhooks[0].event_types.map((e) => e.name);
    expect(names).toContain("CUSTOM.EVENT");
    for (const event of WEBHOOK_EVENTS) expect(names).toContain(event);
  });
});

describe("adopting existing plans", () => {
  const existing = () =>
    fakeClient({
      products: { "PROD-1": { id: "PROD-1" } },
      plans: [
        paypalPlan({
          id: "P-PRO",
          name: "servicedesk-pro",
          price: "29.0",
          product: "PROD-1",
        }),
        paypalPlan({
          id: "P-BIZ",
          name: "servicedesk-business",
          price: "59.0",
          product: "PROD-1",
        }),
        paypalPlan({
          id: "P-ELSE",
          name: "other",
          price: "59.0",
          product: "PROD-2",
        }),
      ],
      webhooks: [],
    });

  it("needs both ids or neither", () => {
    expect(pinnedPlans({})).toBeNull();
    expect(() => pinnedPlans({ PAYPAL_PRO_PLAN_ID: "P-PRO" })).toThrow(/both/);
    expect(
      pinnedPlans({
        PAYPAL_PRO_PLAN_ID: "P-PRO",
        PAYPAL_BUSINESS_PLAN_ID: "P-BIZ",
      }),
    ).toEqual({
      pro: "P-PRO",
      business: "P-BIZ",
    });
  });

  it("adopts them and their product without creating anything", async () => {
    const client = existing();
    const result = await provisionPlans({
      client,
      rows: PENDING_ROWS,
      projectRef: REF,
      log: noop,
      pinned: { pro: "P-PRO", business: "P-BIZ" },
    });
    expect(result).toEqual({
      productId: "PROD-1",
      ids: { pro: "P-PRO", business: "P-BIZ" },
      status: "adopted",
    });
    expect(client.calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("refuses plans under different products", async () => {
    await expect(
      provisionPlans({
        client: existing(),
        rows: PENDING_ROWS,
        projectRef: REF,
        log: noop,
        pinned: { pro: "P-PRO", business: "P-ELSE" },
      }),
    ).rejects.toThrow(/belongs to product PROD-2/);
  });

  it("refuses a plan whose price differs from the database", async () => {
    const rows = PENDING_ROWS.map((r) =>
      r.name === "Pro" ? { ...r, price_month: 39 } : r,
    );
    await expect(
      provisionPlans({
        client: existing(),
        rows,
        projectRef: REF,
        log: noop,
        pinned: { pro: "P-PRO", business: "P-BIZ" },
      }),
    ).rejects.toThrow(/costs 29.0, the database says 39.00/);
  });
});
