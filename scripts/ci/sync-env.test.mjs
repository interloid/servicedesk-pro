import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MANIFEST,
  mergeDotenv,
  planVercel,
  resolveValues,
} from "./sync-env.mjs";

const REF = "abcdefghijklmnopqrst";

/** A complete, valid development configuration. */
function complete() {
  const secrets = {};
  const vars = { SUPABASE_PROJECT_REF: REF };
  for (const entry of MANIFEST.filter((e) => e.required)) {
    (entry.secret ? secrets : vars)[entry.name] = `value-${entry.name}`;
  }
  vars.NEXT_PUBLIC_SUPABASE_URL = `https://${REF}.supabase.co`;
  vars.PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com";
  return { secrets, vars, deployEnv: "development", appOnly: false };
}

describe("resolveValues", () => {
  it("accepts a complete configuration", () => {
    const { values, errors } = resolveValues(complete());
    expect(errors).toEqual([]);
    expect(values.get("SUPABASE_SERVICE_ROLE_KEY")).toBe(
      "value-SUPABASE_SERVICE_ROLE_KEY",
    );
    // The ref the workflow already holds reaches the app too.
    expect(values.get("SUPABASE_PROJECT_REF")).toBe(REF);
  });

  it("lists every missing required value in one error", () => {
    const input = complete();
    delete input.vars.NEXT_PUBLIC_SITE_URL;
    delete input.secrets.PAYPAL_CLIENT_SECRET;
    const { errors } = resolveValues(input);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("NEXT_PUBLIC_SITE_URL, PAYPAL_CLIENT_SECRET");
  });

  it("treats a blank value as missing", () => {
    const input = complete();
    input.vars.NEXT_PUBLIC_SITE_NAME = "   ";
    expect(resolveValues(input).errors[0]).toContain("NEXT_PUBLIC_SITE_NAME");
  });

  it("refuses a secret stored as a visible variable", () => {
    const input = complete();
    input.vars.SUPABASE_SERVICE_ROLE_KEY = "leaked";
    const { errors } = resolveValues(input);
    expect(errors.join()).toMatch(
      /SUPABASE_SERVICE_ROLE_KEY is a GitHub variable/,
    );
  });

  it("accepts a public value stored as a secret", () => {
    const input = complete();
    input.secrets.PLATFORM_ADMIN_EMAILS = "admin@example.com";
    expect(resolveValues(input).values.get("PLATFORM_ADMIN_EMAILS")).toBe(
      "admin@example.com",
    );
  });

  it("refuses an app pointed at another Supabase project", () => {
    const input = complete();
    input.vars.NEXT_PUBLIC_SUPABASE_URL =
      "https://zzzzzzzzzzzzzzzzzzzz.supabase.co";
    expect(resolveValues(input).errors.join()).toMatch(
      /but this environment deploys/,
    );
  });

  it("allows a custom Supabase domain", () => {
    const input = complete();
    input.vars.NEXT_PUBLIC_SUPABASE_URL = "https://db.example.com";
    expect(resolveValues(input).errors).toEqual([]);
  });

  it("refuses live PayPal in development but not in production", () => {
    const input = complete();
    input.vars.PAYPAL_BASE_URL = "https://api-m.paypal.com";
    expect(resolveValues(input).errors.join()).toMatch(/live PayPal/);
    expect(resolveValues({ ...input, deployEnv: "production" }).errors).toEqual(
      [],
    );
  });

  it("needs only app values for an app-only deploy", () => {
    const input = complete();
    for (const entry of MANIFEST.filter((e) => e.to === "functions")) {
      delete input.vars[entry.name];
      delete input.secrets[entry.name];
    }
    const { values, errors } = resolveValues({ ...input, appOnly: true });
    expect(errors).toEqual([]);
    expect(values.has("PAYPAL_BASE_URL")).toBe(false);
  });
});

describe("planVercel", () => {
  const desired = new Map([
    ["NEXT_PUBLIC_SITE_URL", "https://dev.example.com"],
  ]);

  it("creates a branch-scoped Preview variable for development", () => {
    expect(planVercel([], desired, "development")).toEqual([
      {
        op: "create",
        key: "NEXT_PUBLIC_SITE_URL",
        value: "https://dev.example.com",
        target: ["preview"],
        gitBranch: "main",
      },
    ]);
  });

  it("updates the existing variable for the same scope", () => {
    const existing = [
      { id: "a", key: "NEXT_PUBLIC_SITE_URL", target: ["production"] },
      { id: "b", key: "NEXT_PUBLIC_SITE_URL", target: ["preview"] },
      {
        id: "c",
        key: "NEXT_PUBLIC_SITE_URL",
        target: ["preview"],
        gitBranch: "main",
      },
    ];
    expect(planVercel(existing, desired, "development")).toEqual([
      {
        op: "update",
        key: "NEXT_PUBLIC_SITE_URL",
        id: "c",
        value: "https://dev.example.com",
      },
    ]);
    expect(planVercel(existing, desired, "production")[0]).toMatchObject({
      op: "update",
      id: "a",
    });
  });

  it("splits a variable shared across environments instead of overwriting it", () => {
    const existing = [
      {
        id: "all",
        key: "NEXT_PUBLIC_SITE_URL",
        target: ["production", "preview", "development"],
      },
    ];
    expect(planVercel(existing, desired, "production")).toEqual([
      {
        op: "untarget",
        key: "NEXT_PUBLIC_SITE_URL",
        id: "all",
        target: ["preview", "development"],
        original: ["production", "preview", "development"],
      },
      {
        op: "create",
        key: "NEXT_PUBLIC_SITE_URL",
        value: "https://dev.example.com",
        target: ["production"],
        gitBranch: undefined,
      },
    ]);
  });

  it("leaves unscoped Preview variables (pull-request previews) alone", () => {
    const existing = [
      { id: "pr", key: "NEXT_PUBLIC_SITE_URL", target: ["preview"] },
    ];
    const ops = planVercel(existing, desired, "development");
    expect(ops.map((op) => op.op)).toEqual(["create"]);
  });
});

describe("mergeDotenv", () => {
  it("replaces pulled values and keeps the rest", () => {
    const pulled = 'VERCEL="1"\nSUPABASE_SERVICE_ROLE_KEY=""\nOTHER="x"\n';
    const out = mergeDotenv(
      pulled,
      new Map([
        ["SUPABASE_SERVICE_ROLE_KEY", "key"],
        ["NEXT_PUBLIC_SITE_NAME", 'The "Desk"'],
      ]),
    );
    expect(out).toBe(
      'VERCEL="1"\nOTHER="x"\nSUPABASE_SERVICE_ROLE_KEY="key"\nNEXT_PUBLIC_SITE_NAME=\'The "Desk"\'\n',
    );
  });

  it("refuses a value it can't write safely", () => {
    expect(() => mergeDotenv("", new Map([["A", "two\nlines"]]))).toThrow();
  });
});

describe("manifest", () => {
  it("covers every deployed setting in .env.example", () => {
    const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    // Group 1 (runtime) and group 8 (local scripts) are never deployed.
    const deployed = example
      .split(/^# ── /m)
      .filter((section) => /^[2-7]\./.test(section))
      .flatMap((section) => [...section.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)])
      .map((m) => m[1]);
    expect(new Set(MANIFEST.map((e) => e.name))).toEqual(new Set(deployed));
  });

  it("never marks a browser-visible value as secret", () => {
    for (const entry of MANIFEST) {
      if (entry.name.startsWith("NEXT_PUBLIC_")) {
        expect(entry.secret, entry.name).toBeFalsy();
      }
    }
  });
});
