// The text that goes on the ticket.

import { htmlToText } from "./html-to-text.ts";
import type { IncomingEmail } from "./types.ts";

/** Longest body stored on a ticket or message; the rest is cut with a note. */
export const MAX_BODY_CHARS = 50_000;

/** Control characters other than tab and newline: never useful, sometimes hostile. */
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

/** Plain text when the email has it, else the HTML part as text. */
export function extractBodyText(
  email: Pick<IncomingEmail, "textBody" | "htmlBody">,
): string {
  const text = email.textBody?.trim()
    ? email.textBody
    : email.htmlBody
      ? htmlToText(email.htmlBody)
      : "";

  return normalizeText(text);
}

/**
 * Where the quoted history of a reply starts, by the markers mail clients
 * write: "On <date>, <name> wrote:", Outlook's "-----Original Message-----"
 * and "From: ... Sent: ..." block, the underscore rule, or a run of ">"
 * lines. Returns the index of the first quoted line, or -1.
 */
function quoteStart(lines: string[]): number {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const next = (lines[i + 1] ?? "").trim();

    if (/^-{2,}\s*original message\s*-{2,}$/i.test(line)) return i;
    if (/^_{10,}$/.test(line) && /^from:/i.test(next)) return i;
    if (/^from:\s.+/i.test(line) && /^(sent|date):\s/i.test(next)) return i;

    // "On Tue, 3 Nov 2026 at 10:00, Jane <jane@x.com> wrote:" -- often wrapped
    // over two lines by the client.
    if (/^on\s.{4,}\swrote:$/i.test(line)) return i;
    if (
      /^on\s.{4,}/i.test(line) &&
      /^.{0,200}wrote:$/i.test(next) &&
      !/^>/.test(next)
    )
      return i;
    if (
      /^(le|am|el|il|op)\s.{4,}(a écrit|schrieb|escribió|ha scritto|schreef)\s?:$/i.test(
        line,
      )
    )
      return i;

    if (/^>/.test(line)) {
      let j = i;
      while (
        j < lines.length &&
        (/^>/.test(lines[j].trim()) || !lines[j].trim())
      )
        j += 1;
      if (j === lines.length) return i;
    }
  }

  return -1;
}

/**
 * A reply without the conversation it quotes. Only for replies appended to
 * an existing ticket, whose thread already has the quoted messages; a new
 * ticket keeps everything (a forward's quoted part IS the request). Falls
 * back to the full text when stripping would leave nothing.
 */
export function stripQuotedReply(text: string): string {
  const lines = text.split("\n");
  const start = quoteStart(lines);

  if (start <= 0) return text;

  const kept = lines.slice(0, start).join("\n").trim();
  return kept ? kept : text;
}

/** Cut to MAX_BODY_CHARS with a visible note, never mid-surrogate. */
export function capBody(text: string, max = MAX_BODY_CHARS): string {
  if (text.length <= max) return text;

  let cut = text.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);

  return `${cut}\n\n[Message truncated: the full email was longer than ${max.toLocaleString("en-US")} characters.]`;
}

/** Subject for a new ticket: one line, no reply/forward prefixes. */
export function cleanSubject(subject: string): string {
  const flat = subject
    .replace(/[\r\n\t]+/g, " ")
    .replace(CONTROL, "")
    .trim();
  const stripped = flat
    .replace(/^((re|fwd?|aw|sv|vs|wg|tr)\s*(\[\d+\])?\s*:\s*)+/i, "")
    .trim();
  return (stripped || flat).slice(0, 300);
}
