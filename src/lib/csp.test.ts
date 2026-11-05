import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, createNonce } from "./csp";

function directive(policy: string, name: string): string {
  return policy.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";
}

describe("contentSecurityPolicy", () => {
  it("allows scripts by nonce, not by 'unsafe-inline'", () => {
    const scripts = directive(contentSecurityPolicy("abc"), "script-src");

    expect(scripts).toContain("'nonce-abc'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
  });
});

describe("createNonce", () => {
  it("is base64 and differs per call", () => {
    const first = createNonce();

    expect(first).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(first).not.toBe(createNonce());
  });
});
