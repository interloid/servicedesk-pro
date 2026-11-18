/**
 * True only for a link that stays on this site: a path such as
 * "/acme/portal/requests/…". The assistant's replies may echo text from
 * tickets, so anything that could leave the site renders as plain text.
 *
 * A backslash counts as a slash in a browser, so "/\evil.example" would open
 * evil.example; resolving against a placeholder origin catches that and any
 * other spelling that lands on a different host.
 */
const PLACEHOLDER_ORIGIN = "https://portal.invalid";

export function isInternal(href: string | undefined): href is string {
  if (!href || !href.startsWith("/") || href.includes("\\")) return false;

  try {
    return new URL(href, PLACEHOLDER_ORIGIN).origin === PLACEHOLDER_ORIGIN;
  } catch {
    return false;
  }
}
