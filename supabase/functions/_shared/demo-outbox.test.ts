import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Edge Function modules read Deno.env when they load, so each test sets
// the environment, stubs Deno, and imports them afresh.
async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.stubGlobal("Deno", { env: { get: (name: string) => env[name] } });

  return {
    outbox: await import("./demo-outbox"),
    gmail: await import("./gmail"),
  };
}

type Result = { data?: unknown; error?: { message: string } | null };

/** A Supabase client stand-in: answers per table, records inserts. */
function fakeAdmin(answers: Record<string, Result>) {
  const inserts: { table: string; row: Record<string, unknown> }[] = [];

  const client = {
    from(table: string) {
      const answer = answers[table] ?? { data: [], error: null };
      const query = {
        select: () => query,
        eq: () => query,
        then: (resolve: (value: Result) => unknown) =>
          Promise.resolve(answer).then(resolve),
        insert: (row: Record<string, unknown>) => {
          inserts.push({ table, row });
          return Promise.resolve({ error: answer.error ?? null });
        },
      };
      return query;
    },
  };

  return { admin: client as unknown as Admin, inserts };
}

type Admin = Parameters<
  Awaited<ReturnType<typeof load>>["outbox"]["deliverEmail"]
>[0];

const message = {
  to: "x@jysnk.com",
  subject: "You've been invited",
  html: "<p>Accept: https://example.test/a</p>",
  text: "Accept: https://example.test/a",
};

const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("deliverEmail", () => {
  it("captures an unlisted recipient into the Demo outbox", async () => {
    const { outbox } = await load({
      EMAIL_DEMO_OUTBOX: "true",
      EMAIL_ALLOWED_RECIPIENTS: "@example.org",
    });
    const { admin, inserts } = fakeAdmin({});

    await outbox.deliverEmail(
      admin,
      { tenantId: "t1", kind: "team_invitation" },
      message,
    );

    expect(inserts).toEqual([
      {
        table: "demo_outbox",
        row: expect.objectContaining({
          tenant_id: "t1",
          kind: "team_invitation",
          recipient: "x@jysnk.com",
          link_withheld: false,
        }),
      },
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses an unlisted recipient with the outbox off", async () => {
    const { outbox, gmail } = await load({
      EMAIL_ALLOWED_RECIPIENTS: "@example.org",
    });
    const { admin, inserts } = fakeAdmin({});

    await expect(
      outbox.deliverEmail(
        admin,
        { tenantId: "t1", kind: "notification" },
        message,
      ),
    ).rejects.toBeInstanceOf(gmail.PermanentEmailError);
    expect(inserts).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("can't capture without a workspace", async () => {
    const { outbox } = await load({ EMAIL_DEMO_OUTBOX: "true" });
    const { admin } = fakeAdmin({});

    await expect(
      outbox.deliverEmail(admin, { tenantId: null, kind: "invoice" }, message),
    ).rejects.toThrow(/no workspace/);
  });
});

describe("sendEmail", () => {
  it("refuses a captured recipient before reaching Gmail", async () => {
    const { gmail } = await load({ EMAIL_DEMO_OUTBOX: "true" });

    await expect(gmail.sendEmail(message)).rejects.toBeInstanceOf(
      gmail.PermanentEmailError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("signInLinkFacts", () => {
  const user = {
    id: "u1",
    email_confirmed_at: null,
    last_sign_in_at: null,
  };

  it("treats everyone as a platform admin while the list is unset", async () => {
    const { outbox } = await load({ EMAIL_DEMO_OUTBOX: "true" });
    const { admin } = fakeAdmin({});

    const facts = await outbox.signInLinkFacts(admin, {
      kind: "team_invitation",
      tenantId: "t1",
      email: "x@jysnk.com",
      user,
      createdNow: false,
    });

    expect(facts.isPlatformAdmin).toBe(true);
  });

  it("reads the admin list, memberships and customer records", async () => {
    const { outbox } = await load({
      EMAIL_DEMO_OUTBOX: "true",
      PLATFORM_ADMIN_EMAILS: "Boss@Example.org",
    });
    const { admin } = fakeAdmin({
      memberships: { data: [{ tenant_id: "t1", role: "agent" }], error: null },
      customers: { data: [{ tenant_id: "t2" }], error: null },
    });

    const facts = await outbox.signInLinkFacts(admin, {
      kind: "team_invitation",
      tenantId: "t1",
      email: "x@jysnk.com",
      user,
      createdNow: false,
    });

    expect(facts).toMatchObject({
      isPlatformAdmin: false,
      memberships: [{ tenantId: "t1", role: "agent" }],
      customerTenantIds: ["t2"],
      confirmed: false,
      signedInBefore: false,
    });

    const admins = await outbox.signInLinkFacts(admin, {
      kind: "team_invitation",
      tenantId: "t1",
      email: "boss@example.org",
      user,
      createdNow: false,
    });
    expect(admins.isPlatformAdmin).toBe(true);
  });

  it("fails rather than deciding on a lookup that errored", async () => {
    const { outbox } = await load({
      EMAIL_DEMO_OUTBOX: "true",
      PLATFORM_ADMIN_EMAILS: "boss@example.org",
    });

    for (const table of ["memberships", "customers"]) {
      const { admin } = fakeAdmin({
        [table]: { data: null, error: { message: "boom" } },
      });

      await expect(
        outbox.signInLinkFacts(admin, {
          kind: "portal_sign_in",
          tenantId: "t1",
          email: "x@jysnk.com",
          user,
          createdNow: false,
        }),
      ).rejects.toThrow(/lookup failed/);
    }
  });
});
