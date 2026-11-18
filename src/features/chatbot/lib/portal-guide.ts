import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  PORTAL_STATE_LABEL,
} from "@/features/portal/portal";

/**
 * What the assistant knows about the portal itself, for questions such as
 * "what can I do here?" or "how do I change my password?".
 *
 * Written for customers and limited to what they can already see or do in the
 * portal. Nothing about how the system is built or run, the team's internal
 * tools, other customers, or configuration belongs here -- the assistant
 * repeats this text, so whatever is written here is effectively published.
 * Keep it in step with the portal when features change.
 */

export const GUIDE_TOPICS = [
  "overview",
  "requests",
  "account",
  "support",
  "assistant",
] as const;

export type GuideTopic = (typeof GUIDE_TOPICS)[number];

const MB = Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024));

const GUIDE: Record<GuideTopic, string> = {
  overview: `This is the customer support portal. Signed-in customers can:
- Raise a support request (New request), with attachments.
- See all their requests on the Requests page: search them, filter by status (${Object.values(PORTAL_STATE_LABEL).join(", ")}) and sort them.
- Open a request to read the conversation with the support team, reply, and add files.
- Reopen a resolved request if the problem comes back, and rate how a resolved request was handled.
- Browse the Help centre topics.
- Manage their profile (name, company, photo) and password from the menu in the top-right corner.
- Use this assistant to check requests or draft a new one.
Email updates arrive when a request is raised, when the team replies, and when it is resolved.`,

  requests: `Raising a request: New request (or ask this assistant). Give a short subject and describe the problem: what happens, where, since when, any error message. Up to ${MAX_ATTACHMENTS_PER_MESSAGE} files per message, ${MB} MB each.
Priority: set by the support team after reading the request; customers don't choose it.
Statuses:
- Open: the team is working on it.
- Waiting on you: the team needs a reply or information from the customer. Reply on the request page.
- Resolved: the team considers it done. If it isn't, open the request and reopen it.
Replying: open the request from the Requests page and write in the reply box at the bottom; files can be attached.
Finding requests: the Requests page has search, a status filter and sorting (last updated, newest, oldest).
Rating: after a request is resolved, its page asks for a 1-5 rating and an optional comment.`,

  account: `Signing in: with a one-time link sent by email, or with a password if one has been set.
Password: set or change it from the menu in the top-right corner. If it's forgotten, sign in with an email link instead, then set a new one.
Profile: name, company and profile photo can be changed from the same menu. The email address can't be changed there; ask the support team in a request.
Signing out: from the same menu.`,

  support: `Requests are answered by the support team during their working hours; outside them, requests are still accepted and answered when the team is back.
The current support hours and response target are given below when available; they also appear at the bottom of every portal page.
For anything this assistant can't do -- changing a request's priority, billing, refunds, account changes -- raise a request and the team will help.`,

  assistant: `The assistant can: list the customer's requests, look up one by number, explain how the portal works, and draft a new request for the customer to confirm.
It can't: create a request without the customer pressing Confirm, change or close requests, change priority, or see anything outside this customer's own requests.
Requests the customer confirms are created exactly as from the New request form. The conversation is kept in this browser tab only.
Answers come from an AI model and can be wrong; the request pages are the source of truth.`,
};

export type GuideFacts = {
  workspace: string;
  supportHours: string | null;
  firstResponse: string | null;
};

/** The guide text for a topic, with the live facts the customer can see. */
export function portalGuide(topic: GuideTopic, facts: GuideFacts) {
  const withFacts = topic === "overview" || topic === "support";

  return {
    topic,
    portal: `${facts.workspace} support portal`,
    guide: GUIDE[topic],
    ...(withFacts
      ? {
          supportHours: facts.supportHours ?? "not published",
          typicalFirstResponse: facts.firstResponse ?? "not published",
        }
      : {}),
  };
}
