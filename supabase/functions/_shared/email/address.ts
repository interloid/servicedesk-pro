// Email address parsing and comparison.

import type { EmailAddress } from "./types.ts";

/** Deliberately simple: one @, a dot in the domain, no whitespace or brackets. */
const ADDRESS =
  /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function isValidEmail(
  value: string | null | undefined,
): value is string {
  return (
    typeof value === "string" && value.length <= 320 && ADDRESS.test(value)
  );
}

/** Trimmed, lower-case, without angle brackets or a "mailto:". */
export function normalizeEmail(value: string): string {
  return value
    .trim()
    .replace(/^mailto:/i, "")
    .replace(/^<|>$/g, "")
    .trim()
    .toLowerCase();
}

/**
 * The mailbox an address delivers to, for comparing addresses.
 *
 * Gmail ignores dots in the local part and treats googlemail.com as
 * gmail.com, so for those addresses both are folded away. The +tag is KEPT:
 * admin+support@gmail.com and admin@gmail.com reach the same inbox, but only
 * one of them is the support address -- dropping the tag would file the
 * owner's personal mail as tickets. Other domains are compared as written
 * (lower-cased): plus addressing and dots mean different things on
 * different servers.
 */
export function canonicalAddress(value: string): string {
  const email = normalizeEmail(value);
  const at = email.lastIndexOf("@");

  if (at <= 0) return email;

  let local = email.slice(0, at);
  let domain = email.slice(at + 1);

  if (GMAIL_DOMAINS.has(domain)) {
    domain = "gmail.com";
    const plus = local.indexOf("+");
    const base = (plus === -1 ? local : local.slice(0, plus)).replace(
      /\./g,
      "",
    );
    local = plus === -1 ? base : `${base}${local.slice(plus)}`;
  }

  return `${local}@${domain}`;
}

export function sameAddress(a: string, b: string): boolean {
  return canonicalAddress(a) === canonicalAddress(b);
}

/** The mailbox without its +tag: the inbox mail to the address lands in. */
export function addressBase(value: string): string {
  const canonical = canonicalAddress(value);
  const at = canonical.lastIndexOf("@");
  if (at <= 0) return canonical;
  const local = canonical.slice(0, at);
  const plus = local.indexOf("+");
  return `${plus === -1 ? local : local.slice(0, plus)}${canonical.slice(at)}`;
}

/**
 * Split an address-list header on commas outside quotes, angle brackets and
 * comments: `"Doe, Jane" <jane@x.com>, bob@y.com`.
 */
function splitAddressList(header: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  let angle = 0;
  let comment = 0;

  for (let i = 0; i < header.length; i += 1) {
    const char = header[i];

    if (char === "\\" && quoted && i + 1 < header.length) {
      current += char + header[i + 1];
      i += 1;
      continue;
    }

    if (char === '"' && comment === 0) quoted = !quoted;
    else if (!quoted && char === "(") comment += 1;
    else if (!quoted && char === ")" && comment > 0) comment -= 1;
    else if (!quoted && comment === 0 && char === "<") angle += 1;
    else if (!quoted && comment === 0 && char === ">" && angle > 0) angle -= 1;

    if (char === "," && !quoted && angle === 0 && comment === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function cleanName(value: string): string | undefined {
  const name = value
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .replace(/\\(.)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return name || undefined;
}

/** One address: `Name <a@b.com>`, `<a@b.com>`, `a@b.com (Name)`, `a@b.com`. */
export function parseAddress(value: string): EmailAddress | null {
  const text = value.trim();
  if (!text) return null;

  const angle = /<([^<>]*)>/.exec(text);

  if (angle) {
    const email = normalizeEmail(angle[1]);
    if (!isValidEmail(email)) return null;
    return {
      email,
      name: cleanName(
        text.slice(0, angle.index) + text.slice(angle.index + angle[0].length),
      ),
    };
  }

  const comment = /\(([^()]*)\)/.exec(text);
  const bare = normalizeEmail(comment ? text.replace(comment[0], "") : text);

  if (!isValidEmail(bare)) return null;

  return { email: bare, name: comment ? cleanName(comment[1]) : undefined };
}

/**
 * Every address in an address-list header. RFC 5322 groups
 * (`Team: a@x.com, b@x.com;`) are flattened; anything unparseable is dropped.
 */
export function parseAddressList(
  header: string | null | undefined,
): EmailAddress[] {
  if (!header) return [];

  const flattened = header.replace(/[^,:;"<>]*:([^;]*);/g, "$1");
  const seen = new Set<string>();
  const result: EmailAddress[] = [];

  for (const part of splitAddressList(flattened)) {
    const address = parseAddress(part);
    if (address && !seen.has(address.email)) {
      seen.add(address.email);
      result.push(address);
    }
  }

  return result;
}
