import { describe, expect, it } from "vitest";

import {
  deliveryFor,
  deliveryFromSettings,
  isListedEmail,
  isRecipientAllowed,
  mayCaptureSignInLink,
  parseFlag,
  parseRecipientAllowList,
  type SignInLinkFacts,
} from "./email-policy";

const HERE = "tenant-here";
const ELSEWHERE = "tenant-elsewhere";

describe("parseFlag", () => {
  it("is on only for an explicit yes", () => {
    for (const on of ["true", "TRUE", " 1 ", "yes", "on"]) {
      expect(parseFlag(on), on).toBe(true);
    }
    for (const off of [undefined, null, "", "false", "0", "no", "maybe"]) {
      expect(parseFlag(off), String(off)).toBe(false);
    }
  });
});

describe("deliveryFor", () => {
  const list = parseRecipientAllowList("team@example.com, @example.org");

  it("sends to everyone with no list and no outbox (production)", () => {
    expect(deliveryFor("x@jysnk.com", null, false)).toBe("send");
  });

  it("refuses unlisted recipients with a list and no outbox", () => {
    expect(deliveryFor("team@example.com", list, false)).toBe("send");
    expect(deliveryFor("x@jysnk.com", list, false)).toBe("refuse");
  });

  it("captures unlisted recipients when the outbox is on", () => {
    expect(deliveryFor("a@example.org", list, true)).toBe("send");
    expect(deliveryFor("x@jysnk.com", list, true)).toBe("capture");
  });

  it("captures everyone when the outbox is on and there is no list", () => {
    expect(deliveryFor("team@example.com", null, true)).toBe("capture");
    expect(deliveryFor("x@jysnk.com", null, true)).toBe("capture");
  });

  it("reads the raw settings", () => {
    expect(
      deliveryFromSettings("x@jysnk.com", {
        allowedRecipients: "@example.org",
        demoOutbox: "true",
      }),
    ).toBe("capture");
    expect(deliveryFromSettings("x@jysnk.com", {})).toBe("send");
  });
});

describe("isListedEmail", () => {
  it("matches whole addresses, ignoring case and spaces", () => {
    expect(
      isListedEmail("Admin@Example.com", " admin@example.com ,b@c.d"),
    ).toBe(true);
    expect(isListedEmail("min@example.com", "admin@example.com")).toBe(false);
    expect(isListedEmail("a@example.com", "")).toBe(false);
    expect(isListedEmail("a@example.com", undefined)).toBe(false);
  });
});

describe("mayCaptureSignInLink", () => {
  const newInvitee: SignInLinkFacts = {
    kind: "team_invitation",
    tenantId: HERE,
    isPlatformAdmin: false,
    memberships: [{ tenantId: HERE, role: "agent" }],
    customerTenantIds: [],
    createdNow: false,
    confirmed: false,
    signedInBefore: false,
  };

  const newCustomer: SignInLinkFacts = {
    kind: "portal_sign_in",
    tenantId: HERE,
    isPlatformAdmin: false,
    memberships: [],
    customerTenantIds: [],
    createdNow: true,
    confirmed: true,
    signedInBefore: false,
  };

  it("keeps the link for a new invitee of this workspace only", () => {
    expect(mayCaptureSignInLink(newInvitee)).toBe(true);
  });

  it("keeps the link for a new or local-only customer", () => {
    expect(mayCaptureSignInLink(newCustomer)).toBe(true);
    expect(
      mayCaptureSignInLink({
        ...newCustomer,
        createdNow: false,
        signedInBefore: true,
        memberships: [{ tenantId: HERE, role: "customer" }],
        customerTenantIds: [HERE],
      }),
    ).toBe(true);
  });

  it("never keeps a password reset link", () => {
    expect(
      mayCaptureSignInLink({ ...newInvitee, kind: "password_reset" }),
    ).toBe(false);
    expect(
      mayCaptureSignInLink({ ...newCustomer, kind: "password_reset" }),
    ).toBe(false);
  });

  it("never keeps the link for a platform admin address", () => {
    expect(mayCaptureSignInLink({ ...newInvitee, isPlatformAdmin: true })).toBe(
      false,
    );
    expect(
      mayCaptureSignInLink({ ...newCustomer, isPlatformAdmin: true }),
    ).toBe(false);
    expect(
      mayCaptureSignInLink({
        ...newCustomer,
        memberships: [{ tenantId: HERE, role: "platform_admin" }],
      }),
    ).toBe(false);
  });

  it("withholds the link when the address belongs to another workspace", () => {
    const elsewhere = [{ tenantId: ELSEWHERE, role: "customer" }];
    expect(
      mayCaptureSignInLink({
        ...newInvitee,
        memberships: [...newInvitee.memberships, ...elsewhere],
      }),
    ).toBe(false);
    expect(
      mayCaptureSignInLink({ ...newCustomer, memberships: elsewhere }),
    ).toBe(false);
  });

  it("withholds the link when another workspace has them as a customer", () => {
    expect(
      mayCaptureSignInLink({ ...newInvitee, customerTenantIds: [ELSEWHERE] }),
    ).toBe(false);
    expect(
      mayCaptureSignInLink({
        ...newCustomer,
        createdNow: false,
        customerTenantIds: [HERE, ELSEWHERE],
      }),
    ).toBe(false);
  });

  it("withholds a team invite link once the account is confirmed", () => {
    expect(mayCaptureSignInLink({ ...newInvitee, confirmed: true })).toBe(
      false,
    );
  });

  it("withholds a portal link for staff of this workspace", () => {
    expect(
      mayCaptureSignInLink({
        ...newCustomer,
        createdNow: false,
        memberships: [{ tenantId: HERE, role: "tenant_admin" }],
      }),
    ).toBe(false);
  });

  it("withholds a portal link for a used account with no tie to this workspace", () => {
    expect(
      mayCaptureSignInLink({
        ...newCustomer,
        createdNow: false,
        signedInBefore: true,
      }),
    ).toBe(false);
    expect(
      mayCaptureSignInLink({
        ...newCustomer,
        createdNow: false,
        signedInBefore: false,
      }),
    ).toBe(true);
  });
});

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
