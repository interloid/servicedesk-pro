import { describe, expect, it } from "vitest";

import {
  isRecipientAllowed,
  parseRecipientAllowList,
} from "./recipient-filter";

describe("parseRecipientAllowList", () => {
  it("means no restriction when unset or blank", () => {
    expect(parseRecipientAllowList(undefined)).toBeNull();
    expect(parseRecipientAllowList(null)).toBeNull();
    expect(parseRecipientAllowList("")).toBeNull();
    expect(parseRecipientAllowList("   ")).toBeNull();
  });

  it("splits addresses and @domains, trimmed and lowercased", () => {
    const list = parseRecipientAllowList(
      " Demo@Example.com, @Example.ORG;qa@test.dev\n@sub.example.net ",
    );
    expect(list).not.toBeNull();
    expect([...list!.addresses].sort()).toEqual([
      "demo@example.com",
      "qa@test.dev",
    ]);
    expect([...list!.domains].sort()).toEqual([
      "example.org",
      "sub.example.net",
    ]);
  });

  it("fails closed on a set value with no usable entries", () => {
    const list = parseRecipientAllowList(" , @ ; not-an-address ");
    expect(list).not.toBeNull();
    expect(isRecipientAllowed("anyone@example.com", list)).toBe(false);
  });
});

describe("isRecipientAllowed", () => {
  const list = parseRecipientAllowList("owner@example.com, @demo.example.org");

  it("allows anyone without a list", () => {
    expect(isRecipientAllowed("stranger@elsewhere.com", null)).toBe(true);
  });

  it("allows a listed address, ignoring case and spaces", () => {
    expect(isRecipientAllowed("owner@example.com", list)).toBe(true);
    expect(isRecipientAllowed("  OWNER@Example.COM ", list)).toBe(true);
  });

  it("refuses other addresses at a listed address's domain", () => {
    expect(isRecipientAllowed("someone@example.com", list)).toBe(false);
  });

  it("allows any address at a listed domain", () => {
    expect(isRecipientAllowed("a@demo.example.org", list)).toBe(true);
    expect(isRecipientAllowed("B@DEMO.EXAMPLE.ORG", list)).toBe(true);
  });

  it("matches domains exactly, not by suffix or prefix", () => {
    expect(isRecipientAllowed("a@evil-demo.example.org", list)).toBe(false);
    expect(isRecipientAllowed("a@x.demo.example.org", list)).toBe(false);
    expect(isRecipientAllowed("a@demo.example.org.evil.com", list)).toBe(false);
    expect(isRecipientAllowed("a@example.org", list)).toBe(false);
  });

  it("refuses malformed addresses", () => {
    expect(isRecipientAllowed("", list)).toBe(false);
    expect(isRecipientAllowed("demo.example.org", list)).toBe(false);
    expect(isRecipientAllowed("@demo.example.org", list)).toBe(false);
    expect(isRecipientAllowed("a@", list)).toBe(false);
    expect(isRecipientAllowed("x@evil.com@demo.example.org", list)).toBe(false);
  });
});
