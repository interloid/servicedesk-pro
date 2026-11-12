// Who outbound mail may reach, and what happens to the rest.
//
// EMAIL_ALLOWED_RECIPIENTS: comma-separated addresses and @domains.
// EMAIL_DEMO_OUTBOX: when on, mail to anyone outside that list is stored in
// the workspace's Demo outbox (public.demo_outbox) instead of sent.
//
// Pure (no Deno or Node APIs, no imports): the Edge Functions decide with it
// where mail is sent, and the app reads the same answer to word its notices.

/** Parsed allow-list; `null` means no restriction. */
export type RecipientAllowList = {
  addresses: ReadonlySet<string>;
  /** Without the leading @, lowercased. Exact match only, no subdomains. */
  domains: ReadonlySet<string>;
};

/**
 * "a@example.com, @example.org" -> addresses and domains. Entries are split
 * on commas, semicolons and whitespace, trimmed and lowercased. Blank input
 * means no restriction; a set but unusable value (only separators, or junk
 * like "@") still restricts, to nobody -- failing closed.
 */
export function parseRecipientAllowList(
  raw: string | null | undefined,
): RecipientAllowList | null {
  if (!raw || raw.trim() === "") {
    return null;
  }

  const addresses = new Set<string>();
  const domains = new Set<string>();

  for (const entry of raw.toLowerCase().split(/[\s,;]+/)) {
    if (entry.startsWith("@")) {
      const domain = entry.slice(1);
      if (domain && !domain.includes("@")) domains.add(domain);
    } else if (/^[^@]+@[^@]+$/.test(entry)) {
      addresses.add(entry);
    }
  }

  return { addresses, domains };
}

/** True when `email` may be mailed under `list` (always, with no list). */
export function isRecipientAllowed(
  email: string,
  list: RecipientAllowList | null,
): boolean {
  if (!list) {
    return true;
  }

  const address = email.trim().toLowerCase();
  const parts = address.split("@");

  // Exactly one @, with something on both sides.
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }

  return list.addresses.has(address) || list.domains.has(parts[1]);
}

/** "true", "1", "yes" or "on" (any case) turn a flag setting on. */
export function parseFlag(raw: string | null | undefined): boolean {
  return /^(true|1|yes|on)$/i.test((raw ?? "").trim());
}

/**
 * send: deliver for real. capture: store it in the workspace's Demo outbox
 * instead. refuse: neither.
 */
export type EmailDelivery = "send" | "capture" | "refuse";

/**
 * Demo outbox on: listed recipients get real mail and everyone else is
 * captured -- with no list, everyone is captured. Off: unlisted recipients
 * are refused, and with no list everyone gets mail (production).
 */
export function deliveryFor(
  email: string,
  list: RecipientAllowList | null,
  demoOutbox: boolean,
): EmailDelivery {
  if (demoOutbox) {
    return list && isRecipientAllowed(email, list) ? "send" : "capture";
  }

  return isRecipientAllowed(email, list) ? "send" : "refuse";
}

/** deliveryFor, from the two settings' raw values. */
export function deliveryFromSettings(
  email: string,
  settings: { allowedRecipients?: string | null; demoOutbox?: string | null },
): EmailDelivery {
  return deliveryFor(
    email,
    parseRecipientAllowList(settings.allowedRecipients),
    parseFlag(settings.demoOutbox),
  );
}

/** Same comparison as the app's isPlatformAdminEmail. */
export function isListedEmail(
  email: string,
  rawList: string | null | undefined,
): boolean {
  const address = email.trim().toLowerCase();

  return (rawList ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .some((entry) => entry !== "" && entry === address);
}

export type SignInLinkFacts = {
  kind: "team_invitation" | "portal_sign_in" | "password_reset";
  /** The workspace whose Demo outbox would hold the email. */
  tenantId: string;
  /**
   * The address is on PLATFORM_ADMIN_EMAILS -- or that list couldn't be
   * read, which must count as yes.
   */
  isPlatformAdmin: boolean;
  /** Every membership of the address's account, any status. */
  memberships: { tenantId: string; role: string }[];
  /**
   * Every workspace with a customers row for the address. A sign-in link is
   * not tied to one workspace: any workspace's portal callback accepts it and
   * claims that workspace's customer record by email.
   */
  customerTenantIds: string[];
  /** The account was created for this very email. */
  createdNow: boolean;
  /** The account has confirmed its address (accepted an invite, signed in). */
  confirmed: boolean;
  /** The account has ever signed in. */
  signedInBefore: boolean;
};

/**
 * Whether a captured email may keep its working sign-in link. Whoever reads
 * the Demo outbox can use that link to sign in as the recipient, so it is kept
 * only for an account that is new and confined to this workspace:
 *
 * - never for a password reset, or a platform admin address;
 * - never when the address is a member or customer of any other workspace;
 * - team invite: only while the account has never confirmed (it was created
 *   by the invite and not yet accepted);
 * - portal sign-in: only for a customer of this workspace alone (no staff
 *   role anywhere), whose account is new, a customer here, or never used.
 *
 * Anything else is captured with the link replaced by a note.
 */
export function mayCaptureSignInLink(facts: SignInLinkFacts): boolean {
  if (facts.kind === "password_reset" || facts.isPlatformAdmin) {
    return false;
  }

  if (
    facts.memberships.some(
      (m) => m.tenantId !== facts.tenantId || m.role === "platform_admin",
    ) ||
    facts.customerTenantIds.some((id) => id !== facts.tenantId)
  ) {
    return false;
  }

  if (facts.kind === "team_invitation") {
    return !facts.confirmed;
  }

  if (facts.memberships.some((m) => m.role !== "customer")) {
    return false;
  }

  return (
    facts.createdNow ||
    facts.memberships.length > 0 ||
    facts.customerTenantIds.length > 0 ||
    !facts.signedInBefore
  );
}
