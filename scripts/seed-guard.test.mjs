import { describe, expect, it } from "vitest";

import {
  DEFAULT_SEED_PASSWORD,
  hostedPasswordProblem,
  isHostedSupabaseUrl,
  resolveSeedPasswords,
} from "./seed-guard.mjs";

const STRONG = "k3V9-pQx7_Lm2zR8";
const OTHER_STRONG = "Zt4!wN8e@Hc6yU1o";

describe("isHostedSupabaseUrl", () => {
  it.each([
    "http://127.0.0.1:54321",
    "http://localhost:54321",
    "http://supabase.localhost",
    "http://[::1]:54321",
    "http://supabase.local:8000",
  ])("treats %s as local", (url) => {
    expect(isHostedSupabaseUrl(url)).toBe(false);
  });

  it.each([
    "https://abcdefghijklmnopqrst.supabase.co",
    "https://db.example.com",
    "https://localhost.example.com",
    "not a url",
    "",
    undefined,
  ])("treats %s as hosted", (url) => {
    expect(isHostedSupabaseUrl(url)).toBe(true);
  });
});

describe("hostedPasswordProblem", () => {
  it("accepts a long random password", () => {
    expect(hostedPasswordProblem(STRONG)).toBeNull();
  });

  it.each([
    [undefined, /not set/],
    ["", /not set/],
    ["   ", /not set/],
    [DEFAULT_SEED_PASSWORD, /default/],
    ["short-pass1", /shorter than 12/],
    ["aaaaaaaaaaaaaaaa", /distinct/],
  ])("rejects %j", (password, message) => {
    expect(hostedPasswordProblem(password)).toMatch(message);
  });

  it("never repeats the password in its message", () => {
    expect(hostedPasswordProblem("tiny-secret")).not.toContain("tiny-secret");
  });
});

describe("resolveSeedPasswords", () => {
  it("falls back to the default on a local stack", () => {
    const result = resolveSeedPasswords(
      { SEED_PASSWORD: "" },
      { hosted: false, adminExists: false },
    );
    expect(result).toEqual({
      seedPassword: DEFAULT_SEED_PASSWORD,
      adminPassword: undefined,
      usingDefault: true,
      errors: [],
    });
  });

  it("refuses a hosted project without SEED_PASSWORD", () => {
    const { errors } = resolveSeedPasswords(
      { PLATFORM_ADMIN_PASSWORD: OTHER_STRONG },
      { hosted: true, adminExists: false },
    );
    expect(errors).toEqual(["SEED_PASSWORD is not set."]);
  });

  it("refuses the committed default on a hosted project", () => {
    const { errors } = resolveSeedPasswords(
      { SEED_PASSWORD: DEFAULT_SEED_PASSWORD },
      { hosted: true, adminExists: true },
    );
    expect(errors.join()).toMatch(/default committed/);
  });

  it("needs an admin password on a hosted project when the admin is new", () => {
    const { errors } = resolveSeedPasswords(
      { SEED_PASSWORD: STRONG },
      { hosted: true, adminExists: false },
    );
    expect(errors).toEqual(["PLATFORM_ADMIN_PASSWORD is not set."]);
  });

  it("leaves an existing admin alone", () => {
    const { errors } = resolveSeedPasswords(
      { SEED_PASSWORD: STRONG },
      { hosted: true, adminExists: true },
    );
    expect(errors).toEqual([]);
  });

  it("accepts strong, different passwords on a hosted project", () => {
    const result = resolveSeedPasswords(
      { SEED_PASSWORD: STRONG, PLATFORM_ADMIN_PASSWORD: OTHER_STRONG },
      { hosted: true, adminExists: false },
    );
    expect(result.errors).toEqual([]);
    expect(result.seedPassword).toBe(STRONG);
    expect(result.adminPassword).toBe(OTHER_STRONG);
    expect(result.usingDefault).toBe(false);
  });

  it("never gives the platform admin the shared password", () => {
    for (const hosted of [true, false]) {
      const { errors } = resolveSeedPasswords(
        { SEED_PASSWORD: STRONG, PLATFORM_ADMIN_PASSWORD: STRONG },
        { hosted, adminExists: false },
      );
      expect(errors).toContain(
        "PLATFORM_ADMIN_PASSWORD must differ from SEED_PASSWORD.",
      );
    }
  });
});
