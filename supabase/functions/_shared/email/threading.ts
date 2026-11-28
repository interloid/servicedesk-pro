// Which existing ticket, if any, an email continues.
//
// Matching priority:
//   1. In-Reply-To   the Message-ID it answers is one we filed
//   2. References    any Message-ID in its thread is one we filed
//   3. Subject       a "[#1001]" (or "[SD-1001]") ticket token
//   4. A dedicated per-ticket reply address -- not implemented yet
//
// Headers carry ids nobody outside the thread has seen; a ticket number in a
// subject is guessable. So a subject match is only a candidate:
// email_ingest_commit accepts it only when the sender is the ticket's
// requester, and re-checks every candidate belongs to the tenant.

import type { IncomingEmail } from "./types.ts";

export type ThreadMatchSource = "in_reply_to" | "references" | "subject";

export interface ThreadMatch {
  ticketId: string;
  source: ThreadMatchSource;
}

/** Tenant-scoped lookups. Implementations must filter by tenantId. */
export interface ThreadLookup {
  /** The ticket an email with one of these Message-IDs was filed on, newest first. */
  findTicketIdByMessageIds(
    tenantId: string,
    messageIds: string[],
  ): Promise<string | null>;
  findTicketIdByNumber(
    tenantId: string,
    ticketNumber: number,
  ): Promise<string | null>;
}

export interface EmailThreadMatcher {
  findTicketForEmail(
    email: Pick<IncomingEmail, "inReplyTo" | "references" | "subject">,
    tenantId: string,
  ): Promise<ThreadMatch | null>;
}

const MAX_REFERENCES = 50;

/** Every `<id>` in a Message-ID-list header, in order, without duplicates. */
export function extractMessageIds(header: string | null | undefined): string[] {
  if (!header) return [];

  const ids: string[] = [];
  const seen = new Set<string>();

  for (const match of header.matchAll(/<([^<>\s]{1,998})>/g)) {
    const id = `<${match[1]}>`;
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
}

/**
 * The ticket number in a subject's token: "Re: [#1001] Login problem",
 * "[SD-1001]", "Fwd: RE: [#1001]". Bracketed only -- a bare "#1001" is too
 * likely to be an order or invoice number.
 */
export function parseTicketNumberFromSubject(
  subject: string | null | undefined,
): number | null {
  if (!subject) return null;

  const match = /\[\s*(?:#|SD-?)\s*(\d{1,12})\s*\]/i.exec(subject);
  if (!match) return null;

  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function createThreadMatcher(lookup: ThreadLookup): EmailThreadMatcher {
  return {
    async findTicketForEmail(email, tenantId) {
      const inReplyTo = extractMessageIds(email.inReplyTo);

      if (inReplyTo.length > 0) {
        const ticketId = await lookup.findTicketIdByMessageIds(
          tenantId,
          inReplyTo,
        );
        if (ticketId) return { ticketId, source: "in_reply_to" };
      }

      // Newest first: the end of References is the most recent message.
      const references = extractMessageIds(email.references)
        .filter((id) => !inReplyTo.includes(id))
        .reverse()
        .slice(0, MAX_REFERENCES);

      if (references.length > 0) {
        const ticketId = await lookup.findTicketIdByMessageIds(
          tenantId,
          references,
        );
        if (ticketId) return { ticketId, source: "references" };
      }

      const number = parseTicketNumberFromSubject(email.subject);

      if (number !== null) {
        const ticketId = await lookup.findTicketIdByNumber(tenantId, number);
        if (ticketId) return { ticketId, source: "subject" };
      }

      return null;
    },
  };
}
