/**
 * The chatbot's shared types and limits, used by the widget (client) and the
 * server alike. Nothing here may import server-only code.
 */

export type ChatRole = "user" | "assistant";

/** One line of the conversation as the widget keeps it: plain text only. */
export type ChatTurn = { role: ChatRole; text: string };

/** A request the assistant has drafted. Nothing is saved until Confirm. */
export type ChatDraft = { subject: string; description: string };

/** The customer's daily message allowance for the assistant. */
export type ChatUsage = {
  used: number;
  limit: number;
  /** ISO time the allowance refills; null when nothing has been used. */
  resetsAt: string | null;
};

/**
 * A file on a request the assistant looked up. Sent to the widget by the
 * server, never through the model, so the download link is the real one.
 */
export type ChatAttachment = {
  name: string;
  size: number;
  mime: string;
  /** Signed and short-lived; null when it could not be minted. */
  url: string | null;
  /** When `url` stops working (ISO). After that, open the request instead. */
  expiresAt: string;
  requestNumber: number | null;
  requestUrl: string;
};

/** The signed-in customer's own profile, shown as a card. From the server. */
export type ChatProfile = {
  name: string;
  email: string;
  company: string | null;
  initials: string;
  /** Public URL of their photo, or null for initials. */
  avatarUrl: string | null;
};

export type ChatReply = {
  /** Markdown. Links may only point inside the portal (see ChatMarkdown). */
  reply: string;
  draft: ChatDraft | null;
  /** Follow-up prompts to offer as one-tap chips. */
  suggestions: string[];
  /** Files on requests looked up this turn, shown as download cards. */
  attachments: ChatAttachment[];
  /** Set when the assistant read the customer's profile this turn. */
  profile: ChatProfile | null;
  usage: ChatUsage;
};

/** Messages per customer per day. Shown in the chat, enforced on the server. */
export const CHAT_DAILY_LIMIT = 100;

/** Offered before the customer has typed anything. */
export const STARTER_SUGGESTIONS = [
  "Show my open requests",
  "What's waiting on me?",
  "Report a new problem",
  "What can I do in this portal?",
];

/** Longest single message the widget accepts, and the server re-checks. */
export const CHAT_MESSAGE_MAX = 2_000;

/**
 * How much of each earlier assistant reply goes back to the model. Replies are
 * often longer than a customer's message (a table of requests, a how-to), so
 * they are not held to CHAT_MESSAGE_MAX: anything past this is cut, never
 * refused, so a long reply can't block the next message.
 */
export const CHAT_REPLY_MAX = 8_000;

/**
 * How much history goes to the model each turn. Older turns are dropped by
 * the widget before sending; the model can always look a request up again.
 */
export const CHAT_HISTORY_MAX = 20;

/**
 * Where the widget keeps a conversation in sessionStorage. Per customer, not
 * just per workspace: on a shared computer the next person to sign in on the
 * same tab must never see the previous customer's chat.
 */
const CHAT_STORAGE_PREFIX = "portal-chat:";

export function chatStorageKey(slug: string, customerId: string): string {
  return `${CHAT_STORAGE_PREFIX}v3:${slug}:${customerId}`;
}

/** Forgets every saved chat in this tab. Called on sign-out. */
export function clearStoredChats(): void {
  try {
    const keys: string[] = [];

    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(CHAT_STORAGE_PREFIX)) keys.push(key);
    }

    keys.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // No storage, so nothing was saved.
  }
}
