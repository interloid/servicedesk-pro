// Shared (client + server) types for Settings -> Channels -> Email.
// Nothing here ever carries a token: the page's data is read through the
// API role, which is not granted the token columns at all.

export type EmailChannelStatus =
  "connecting" | "connected" | "expired" | "error" | "disconnected";

/** What the page shows: the stored status, plus "syncing" while a sync runs. */
export type EmailChannelDisplayStatus =
  "connected" | "syncing" | "expired" | "error" | "disconnected";

export interface EmailChannel {
  id: string;
  provider: "gmail";
  connectedEmail: string;
  receivingEmail: string;
  enabled: boolean;
  autoCreateCustomer: boolean;
  status: EmailChannelStatus;
  lastSyncAt: string | null;
  watchExpiration: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  createdAt: string;
}

export type InboundEmailStatus =
  "pending" | "processing" | "processed" | "ignored" | "failed";

export interface InboundEmail {
  id: string;
  status: InboundEmailStatus;
  senderEmail: string | null;
  subject: string | null;
  outcome: "ticket_created" | "reply_appended" | "agent_reply_appended" | null;
  ignoreReason: string | null;
  ticketId: string | null;
  retryCount: number;
  errorMessage: string | null;
  errorCategory: "temporary" | "permanent" | null;
  receivedAt: string | null;
  createdAt: string;
}

export interface EmailChannelStats {
  received: number;
  ticketsCreated: number;
  repliesAppended: number;
  ignored: number;
  failed: number;
  queued: number;
  avgLatencySeconds: number | null;
  syncInProgress: boolean;
}

export interface EmailChannelPageData {
  /** False when the deployment has no Google credentials or encryption key. */
  configured: boolean;
  channel: EmailChannel | null;
  recent: InboundEmail[];
  stats: EmailChannelStats | null;
}

export type EmailChannelActionResult =
  { ok: true } | { ok: false; message: string; field?: "receivingEmail" };

/** ?gmail=<code> after the OAuth round trip, mapped to fixed copy on the page. */
export const CONNECT_RESULT_MESSAGES: Record<
  string,
  { ok: boolean; message: string }
> = {
  connected: {
    ok: true,
    message:
      "Gmail is connected. New emails to your support address will become tickets.",
  },
  connected_no_watch: {
    ok: true,
    message:
      "Gmail is connected, but push notifications couldn't be registered yet. We'll keep retrying and check the inbox every few minutes meanwhile.",
  },
  denied: {
    ok: false,
    message: "Google access wasn't granted, so nothing was connected.",
  },
  missing_scope: {
    ok: false,
    message:
      "Gmail read access is required. Connect again and leave the Gmail permission ticked.",
  },
  mailbox_in_use: {
    ok: false,
    message: "That Gmail account is already connected to another workspace.",
  },
  state_invalid: {
    ok: false,
    message:
      "The connection link expired or was opened in another browser. Try again.",
  },
  not_allowed: {
    ok: false,
    message: "Only a Tenant Admin can connect an email channel.",
  },
  not_configured: {
    ok: false,
    message: "Email channels aren't set up on this deployment yet.",
  },
  failed: {
    ok: false,
    message: "We couldn't connect Gmail. Try again in a moment.",
  },
};

export function displayStatus(
  channel: Pick<EmailChannel, "status"> | null,
  syncing: boolean,
): EmailChannelDisplayStatus {
  if (!channel || channel.status === "disconnected") return "disconnected";
  if (channel.status === "expired") return "expired";
  if (channel.status === "error") return "error";
  if (syncing || channel.status === "connecting") return "syncing";
  return "connected";
}

/** Fixed copy for each ignore reason the pipeline records. */
export const IGNORE_REASON_LABELS: Record<string, string> = {
  not_support_address: "Not sent to the support address",
  auto_generated: "Automatic reply or bulk mail",
  system_sender: "Sent by a system address",
  sender_is_mailbox: "Sent by the connected mailbox",
  sender_is_team: "Sent by a team member",
  invalid_sender: "No valid sender",
  spam_or_trash: "Spam or trash",
  draft_or_sent: "Draft or sent mail",
  unknown_sender: "Unknown sender (auto-create is off)",
  customer_disabled: "Customer's access is turned off",
  duplicate_message: "Duplicate of an email already filed",
  integration_inactive: "Channel was turned off",
  tenant_inactive: "Workspace inactive",
  message_unavailable: "Deleted before it was read",
  sent_not_ticket_reply: "Sent mail that isn't a ticket reply",
  no_staff_author: "No active team member to credit the reply to",
};

/** Settings -> Channels -> Gmail: the channel's manage page. */
export const GMAIL_CHANNEL_PATH = "/settings/channels/gmail";
