import { describe, expect, it } from "vitest";

import {
  DEFAULT_GRACE_HOURS,
  checkTarget,
  chunk,
  isKept,
  isSeedAccount,
  parseGraceHours,
  parseKeepList,
  planSeedRelease,
  planUsers,
  planWorkspaces,
  seedCountToRebuild,
  summaryMarkdown,
} from "./demo-reset-plan.mjs";
import { MAX_TENANTS, MIN_TENANTS, TENANTS } from "./seed-data.mjs";

const REF = "abcdefghijklmnopqrst";
const HOSTED_URL = `https://${REF}.supabase.co`;
const NOW = Date.parse("2026-11-13T02:00:00Z");
const hoursAgo = (h) => new Date(NOW - h * 3_600_000).toISOString();

const allowed = { DEMO_RESET_ALLOWED: "true", SUPABASE_PROJECT_REF: REF };

describe("checkTarget", () => {
  it("accepts the development project when everything agrees", () => {
    const result = checkTarget(HOSTED_URL, allowed, {
      apply: true,
      projectFlag: REF,
    });
    expect(result).toEqual({ hosted: true, projectRef: REF, errors: [] });
  });

  it("needs DEMO_RESET_ALLOWED=true, even for a dry run", () => {
    for (const value of [undefined, "", "TRUE", "1", "yes"]) {
      const env = { ...allowed, DEMO_RESET_ALLOWED: value };
      expect(checkTarget(HOSTED_URL, env).errors.join()).toMatch(
        /DEMO_RESET_ALLOWED/,
      );
    }
  });

  it("refuses a URL for another project", () => {
    const url = "https://zzzzzzzzzzzzzzzzzzzz.supabase.co";
    expect(checkTarget(url, allowed).errors.join()).toMatch(
      /but SUPABASE_PROJECT_REF is/,
    );
  });

  it("refuses a hosted project without SUPABASE_PROJECT_REF", () => {
    const env = { DEMO_RESET_ALLOWED: "true" };
    expect(checkTarget(HOSTED_URL, env).errors.join()).toMatch(
      /SUPABASE_PROJECT_REF is not set/,
    );
  });

  it("refuses a custom domain, which can't be verified", () => {
    expect(
      checkTarget("https://db.example.com", allowed).errors.join(),
    ).toMatch(/can't be verified/);
  });

  it("refuses the production project", () => {
    const env = { ...allowed, PRODUCTION_PROJECT_REF: REF };
    expect(checkTarget(HOSTED_URL, env).errors.join()).toMatch(
      /PRODUCTION_PROJECT_REF/,
    );
  });

  it("needs --project-ref to apply to a hosted project", () => {
    expect(
      checkTarget(HOSTED_URL, allowed, { apply: true }).errors.join(),
    ).toMatch(/--project-ref/);
    expect(
      checkTarget(HOSTED_URL, allowed, { apply: true, projectFlag: "other" })
        .errors,
    ).toHaveLength(1);
    expect(checkTarget(HOSTED_URL, allowed).errors).toEqual([]);
  });

  it("allows a local stack with only DEMO_RESET_ALLOWED", () => {
    const result = checkTarget(
      "http://127.0.0.1:54321",
      { DEMO_RESET_ALLOWED: "true" },
      { apply: true },
    );
    expect(result.errors).toEqual([]);
    expect(result.hosted).toBe(false);
  });

  it("refuses a missing or broken URL", () => {
    expect(checkTarget(undefined, allowed).errors.join()).toMatch(/not a URL/);
    expect(checkTarget("not a url", allowed).errors.join()).toMatch(
      /not a URL/,
    );
  });
});

describe("parseGraceHours", () => {
  it("defaults when unset or blank", () => {
    expect(parseGraceHours(undefined).hours).toBe(DEFAULT_GRACE_HOURS);
    expect(parseGraceHours("  ").hours).toBe(DEFAULT_GRACE_HOURS);
  });

  it("reads whole and fractional hours, including zero", () => {
    expect(parseGraceHours("6").hours).toBe(6);
    expect(parseGraceHours("0.5").hours).toBe(0.5);
    expect(parseGraceHours("0").hours).toBe(0);
  });

  it.each(["-1", "two", "2h", "1e3", "NaN"])("refuses %s", (value) => {
    expect(parseGraceHours(value).error).toMatch(/not a number/);
  });
});

describe("keep-list", () => {
  const keep = parseKeepList("Ops@Example.com, @team.example.org ,, @", "");

  it("matches addresses and whole domains, ignoring case", () => {
    expect(isKept("ops@example.com", keep)).toBe(true);
    expect(isKept("Anyone@TEAM.example.org", keep)).toBe(true);
  });

  it("doesn't match other addresses or subdomains", () => {
    expect(isKept("other@example.com", keep)).toBe(false);
    expect(isKept("x@sub.team.example.org", keep)).toBe(false);
    expect(isKept("x@evilteam.example.org", keep)).toBe(false);
    expect(isKept(undefined, keep)).toBe(false);
  });

  it("ignores a bare @", () => {
    expect(keep.domains.has("")).toBe(false);
  });
});

describe("isSeedAccount", () => {
  it("uses the seed-tenants --clean rule", () => {
    expect(isSeedAccount({ user_metadata: { seed_tenant: "juniper" } })).toBe(
      true,
    );
    expect(isSeedAccount({ email: "admin@juniper.seed.test" })).toBe(true);
    expect(isSeedAccount({ email: "dana@northfield.example" })).toBe(false);
  });
});

describe("planWorkspaces", () => {
  const tenants = [
    { id: "t1", slug: "acme", created_at: hoursAgo(30) },
    { id: "t2", slug: "fresh", created_at: hoursAgo(1) },
    { id: "t3", slug: "seed-juniper", created_at: hoursAgo(500) },
    { id: "t4", slug: "seed-new", created_at: hoursAgo(0.1) },
    { id: "t5", slug: "edge", created_at: hoursAgo(2) },
    { id: "t6", slug: "odd", created_at: "not a date" },
  ];

  it("deletes old visitor workspaces and keeps recent ones", () => {
    const plan = planWorkspaces(tenants, { now: NOW, graceHours: 2 });
    expect(plan.deleted.map((t) => t.id)).toEqual(["t1", "t5"]);
    expect(plan.recent.map((t) => t.id)).toEqual(["t2", "t6"]);
    expect(plan.seeded.map((t) => t.id)).toEqual(["t3", "t4"]);
  });

  it("deletes every visitor workspace with a zero grace period", () => {
    const plan = planWorkspaces(tenants, { now: NOW, graceHours: 0 });
    expect(plan.deleted.map((t) => t.id)).toEqual(["t1", "t2", "t5"]);
  });
});

describe("planUsers", () => {
  const user = (id, email, age, meta = {}) => ({
    id,
    email,
    created_at: hoursAgo(age),
    user_metadata: meta,
  });

  const users = [
    user("visitor", "visitor@mail.example", 30),
    user("member", "member@mail.example", 30),
    user("in-seeded", "invitee@mail.example", 30),
    user("new", "new@mail.example", 0.5),
    user("seeded", "admin@juniper.seed.test", 300),
    user("customer", "pat@north.example", 300, { seed_tenant: "north" }),
    user("console", "platform-admin@servicedesk-pro.com", 300),
    user("ops", "Ops@Real.example", 300),
    user("team", "sam@team.example.org", 300),
    user("kept", "boss@corp.example", 300),
  ];
  const links = [
    { user_id: "member", tenant_id: "recent" },
    // Seeded workspaces are rebuilt, so a visitor invited into one is orphaned.
    { user_id: "in-seeded", tenant_id: "seed-tenant" },
    { user_id: "visitor", tenant_id: "old" },
  ];

  const plan = planUsers({
    users,
    links,
    survivors: ["recent"],
    protectedEmails: new Set([
      "platform-admin@servicedesk-pro.com",
      " ops@real.example",
    ]),
    keep: parseKeepList("boss@corp.example,@team.example.org"),
    now: NOW,
    graceHours: 2,
  });

  it("deletes accounts left without a workspace", () => {
    expect(plan.remove.map((u) => u.id)).toEqual(["visitor", "in-seeded"]);
  });

  it("keeps seeded, admin, keep-list, new and member accounts", () => {
    expect(plan.kept).toEqual({
      seeded: 2,
      platformAdmin: 2,
      keepList: 2,
      recent: 1,
      member: 1,
    });
  });

  it("keeps a user whose sign-up date can't be read", () => {
    const odd = { ...user("odd", "odd@mail.example", 0), created_at: "" };
    const result = planUsers({
      users: [odd],
      links: [],
      survivors: [],
      protectedEmails: new Set(),
      keep: parseKeepList(""),
      now: NOW,
      graceHours: 2,
    });
    expect(result.remove).toEqual([]);
  });
});

describe("planSeedRelease", () => {
  const users = [
    { id: "seed-agent", email: "agent@juniper.seed.test" },
    {
      id: "seed-customer",
      email: "pat@north.example",
      user_metadata: { seed_tenant: "north" },
    },
    { id: "visitor", email: "visitor@mail.example" },
  ];

  // A seeded agent joined (and owns one of) the visitor workspaces still
  // inside the grace period, and was assigned tickets there.
  const links = [
    {
      membership_id: "m1",
      user_id: "seed-agent",
      tenant_id: "recent",
      is_primary: false,
    },
    {
      membership_id: "m2",
      user_id: "seed-agent",
      tenant_id: "recent-owned",
      is_primary: true,
    },
    {
      membership_id: "m3",
      user_id: "seed-customer",
      tenant_id: "recent",
      is_primary: false,
    },
    {
      membership_id: "m4",
      user_id: "visitor",
      tenant_id: "recent",
      is_primary: false,
    },
    {
      membership_id: "m5",
      user_id: "seed-agent",
      tenant_id: "seed-tenant",
      is_primary: false,
    },
    // A portal-customer link: no membership row to remove.
    { user_id: "seed-customer", tenant_id: "recent" },
  ];

  const plan = planSeedRelease({
    users,
    links,
    survivors: ["recent", "recent-owned"],
  });

  it("releases every seeded account before --clean deletes it", () => {
    expect(plan.userIds).toEqual(["seed-agent", "seed-customer"]);
  });

  it("removes seeded memberships in surviving workspaces only", () => {
    // m2 is the owner row, which only cascades with the account; m4 is a
    // visitor; m5 is in a seeded workspace that --clean deletes anyway.
    expect(plan.memberships).toEqual(["m1", "m3"]);
  });

  it("does nothing without surviving workspaces", () => {
    expect(
      planSeedRelease({ users, links, survivors: [] }).memberships,
    ).toEqual([]);
  });
});

describe("seedCountToRebuild", () => {
  const slug = (i) => `seed-${TENANTS[i].key}`;

  it("rebuilds as many as were seeded", () => {
    const ten = Array.from({ length: 10 }, (_, i) => slug(i));
    expect(seedCountToRebuild(ten)).toBe(10);
    expect(seedCountToRebuild([...ten, slug(11)])).toBe(12);
  });

  it("ignores seed-* slugs the seeder doesn't know", () => {
    const ten = Array.from({ length: 10 }, (_, i) => slug(i));
    expect(seedCountToRebuild([...ten, "seed-visitor", "seed-x"])).toBe(10);
  });

  it("stays within the seeder's limits", () => {
    expect(seedCountToRebuild([slug(0)])).toBe(MIN_TENANTS);
    expect(seedCountToRebuild([])).toBe(MAX_TENANTS);
  });
});

describe("chunk", () => {
  it("splits into batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});

describe("summaryMarkdown", () => {
  it("shows counts and never an address", () => {
    const text = summaryMarkdown({
      apply: false,
      projectRef: REF,
      counts: { workspacesDeleted: 3, usersDeleted: 2 },
    });
    expect(text).toContain("(dry run)");
    expect(text).toContain("| Visitor workspaces deleted | 3 |");
    expect(text).toContain("| Failures | 0 |");
    expect(text).not.toMatch(/@/);
  });
});
