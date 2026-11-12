// The outbound-mail allow-list, EMAIL_ALLOWED_RECIPIENTS. Unset or blank:
// mail goes to anyone (production). Set: only the listed addresses and
// domains get mail, so a public demo can't be used to email strangers.
//
// Pure (no Deno or Node APIs): the Edge Functions enforce it where mail is
// sent, and the app reads the same value to tell an inviter up front.

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
