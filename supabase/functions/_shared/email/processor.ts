// processIncomingEmail: one email, from normalized message to ticket.
//
//   1. validate             a sender, and the message is the event's
//   2. idempotency          the event was claimed (one worker); the commit
//                           locks it and replays a committed event as-is
//   3. recipient filter     only mail to the receiving address
//   4. system/spam filter   bounces, auto-replies, our own mail, loops
//   5. thread match         In-Reply-To, References, [#n] subject token
//   6-8. commit             customer match/creation and ticket-or-reply in
//                           ONE transaction (email_ingest_commit); the
//                           ticket triggers do number, SLA, notifications,
//                           audit -- the "domain events" of this codebase
//   9. attachments          deterministic paths, so a retry overwrites
//  10. complete             event processed
//
// Each step is a function of its own module; this file only orders them.
// Dependencies are injected, so the whole pipeline runs in tests with fakes.

import { addressBase } from "./address.ts";
import { planAttachments, rejectionNote } from "./attachments.ts";
import {
  capBody,
  cleanSubject,
  extractBodyText,
  stripQuotedReply,
} from "./body.ts";
import { PermanentIngestError } from "./errors.ts";
import {
  effectiveSender,
  matchedSupportAddress,
  screenEmail,
  type IgnoreReason,
} from "./filtering.ts";
import type { Logger } from "./logger.ts";
import type { EmailThreadMatcher, ThreadMatch } from "./threading.ts";
import type {
  EmailIntegration,
  EmailProvider,
  IncomingEmail,
} from "./types.ts";

export interface CommitInput {
  sender_email: string;
  sender_name: string | null;
  recipient_email: string | null;
  subject: string;
  body: string;
  message_id: string | null;
  in_reply_to: string | null;
  references: string | null;
  received_at: string;
  match_ticket_id: string | null;
  match_source: ThreadMatch["source"] | null;
}

export type CommitResult =
  | {
      status: "committed";
      outcome: "ticket_created" | "reply_appended" | "agent_reply_appended";
      ticketId: string;
      ticketMessageId: string | null;
      customerId: string | null;
      /** Agent replies: the staff member the message is credited to. */
      authorId?: string | null;
      replayed: boolean;
    }
  | { status: "ignored"; ignoreReason: string; replayed: boolean };

export interface AttachmentRecord {
  tenantId: string;
  ticketId: string;
  messageId: string | null;
  storagePath: string;
  filename: string;
  originalFilename: string;
  mime: string;
  extension: string;
  size: number;
  /** Staff uploader (agent replies); null for a customer's files. */
  uploadedBy?: string | null;
}

/** An agent's reply sent from the connected mailbox (email_ingest_commit_agent_reply). */
export interface AgentReplyInput {
  sender_email: string;
  /** To + Cc, for the requester check on a subject match. */
  recipients: string[];
  subject: string;
  body: string;
  message_id: string | null;
  in_reply_to: string | null;
  references: string | null;
  match_ticket_id: string | null;
  match_source: ThreadMatch["source"] | null;
}

/** The database side of the pipeline (service role). */
export interface IngestStore {
  commit(eventId: string, input: CommitInput): Promise<CommitResult>;
  commitAgentReply(
    eventId: string,
    input: AgentReplyInput,
  ): Promise<CommitResult>;
  ignore(eventId: string, reason: string): Promise<void>;
  complete(eventId: string): Promise<void>;
  /** Insert, skipping any storage_path already recorded. */
  recordAttachments(rows: AttachmentRecord[]): Promise<void>;
}

/** Private ticket storage. upload must treat "already exists" at the same path as done: retries are safe. */
export interface AttachmentStorage {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
}

export interface ProcessorDeps {
  store: IngestStore;
  threads: EmailThreadMatcher;
  storage: AttachmentStorage;
  provider: Pick<EmailProvider, "getAttachmentContent">;
  logger: Logger;
  config: {
    /** Platform sending addresses (FROM_EMAIL): never customers. */
    systemSenders: string[];
    maxAttachmentBytes: number;
    maxAttachments?: number;
  };
}

export interface InboundEventRef {
  id: string;
  providerMessageId: string;
  /**
   * An earlier attempt already created the ticket or reply; this one only
   * finishes the attachments. Such an email is never re-filtered: the
   * filters decide whether a ticket is created, and it was. (Re-filtering
   * would wrongly try to ignore it if the support address changed since.)
   */
  committed?: boolean;
}

export type ProcessOutcome =
  | { status: "ignored"; reason: IgnoreReason | string }
  | {
      status: "processed";
      outcome: CommitOutcome;
      ticketId: string;
      replayed: boolean;
      attachmentsStored: number;
      attachmentsRejected: number;
    };

type CommitOutcome = Extract<CommitResult, { status: "committed" }>["outcome"];

/**
 * Sent from the connected mailbox itself (Gmail's SENT label, From = the
 * mailbox): a team member replying from Gmail, not a customer writing in.
 */
export function isAgentReplyCandidate(
  email: Pick<IncomingEmail, "labels" | "from">,
  integration: Pick<EmailIntegration, "connectedEmail">,
): boolean {
  return (
    email.labels.includes("SENT") &&
    addressBase(email.from.email) === addressBase(integration.connectedEmail)
  );
}

export async function processIncomingEmail(
  email: IncomingEmail,
  integration: EmailIntegration,
  event: InboundEventRef,
  deps: ProcessorDeps,
): Promise<ProcessOutcome> {
  const log = deps.logger.child({
    event_id: event.id,
    integration_id: integration.id,
    tenant_id: integration.tenantId,
    provider: integration.provider,
    provider_message_id: email.providerMessageId,
  });

  // 1. Validate.
  if (email.providerMessageId !== event.providerMessageId) {
    throw new PermanentIngestError(
      "Fetched message does not match the event",
      "invalid_email",
    );
  }

  const ignore = async (
    reason: string,
    replayed = false,
  ): Promise<ProcessOutcome> => {
    log.info("email_ignored", { reason, replayed });
    deps.logger.metric("emails_ignored", 1, {
      reason,
      tenant_id: integration.tenantId,
    });
    return { status: "ignored", reason };
  };

  const plan = planAttachments(email.attachments, {
    eventId: event.id,
    maxBytes: deps.config.maxAttachmentBytes,
    maxFiles: deps.config.maxAttachments,
  });

  // Attachments are planned before the commit so the message can say which
  // files were left out.
  const bodyFor = (isReply: boolean): string => {
    let body = extractBodyText(email);
    if (isReply) body = stripQuotedReply(body);
    const note = rejectionNote(plan.rejected);
    if (note) body = body ? `${body}\n\n${note}` : note;
    if (!body && plan.accepted.length > 0) {
      body = `Attached ${plan.accepted.length} file${plan.accepted.length === 1 ? "" : "s"}.`;
    }
    return capBody(body);
  };

  let match: ThreadMatch | null;
  let result: CommitResult;

  if (isAgentReplyCandidate(email, integration)) {
    // The team answering from Gmail: sent FROM the connected mailbox. Added
    // to the ticket it continues, or ignored -- never a new ticket.
    if (!event.committed && email.autoGenerated) {
      await deps.store.ignore(event.id, "auto_generated");
      return ignore("auto_generated");
    }

    match = await deps.threads.findTicketForEmail(email, integration.tenantId);

    if (!match && !event.committed) {
      await deps.store.ignore(event.id, "sent_not_ticket_reply");
      return ignore("sent_not_ticket_reply");
    }

    result = await deps.store.commitAgentReply(event.id, {
      sender_email: email.from.email,
      recipients: [...email.to, ...email.cc],
      subject: email.subject,
      body: bodyFor(true),
      message_id: email.messageId ?? null,
      in_reply_to: email.inReplyTo ?? null,
      references: email.references ?? null,
      match_ticket_id: match?.ticketId ?? null,
      match_source: match?.source ?? null,
    });
  } else {
    // 3-4. Filter. Nothing about a filtered email is stored but the reason.
    // An email whose ticket already exists is resuming, not re-filtered.
    const ignoreReason = event.committed
      ? null
      : screenEmail(email, integration, {
          systemSenders: deps.config.systemSenders,
        });

    if (ignoreReason) {
      await deps.store.ignore(event.id, ignoreReason);
      return ignore(ignoreReason);
    }

    const sender = effectiveSender(email, integration);

    // 5. Thread.
    match = await deps.threads.findTicketForEmail(email, integration.tenantId);

    // 6-8. Customer + ticket or reply, atomically.
    result = await deps.store.commit(event.id, {
      sender_email: sender.email,
      sender_name: sender.name ?? null,
      recipient_email: matchedSupportAddress(email, integration),
      subject: cleanSubject(email.subject),
      body: bodyFor(Boolean(match)),
      message_id: email.messageId ?? null,
      in_reply_to: email.inReplyTo ?? null,
      references: email.references ?? null,
      received_at: email.receivedAt.toISOString(),
      match_ticket_id: match?.ticketId ?? null,
      match_source: match?.source ?? null,
    });
  }

  if (result.status === "ignored") {
    return ignore(result.ignoreReason, result.replayed);
  }

  // 9. Attachments. Under the ticket, as the app stores them; the path is a
  // function of the event and position, so a retry after a crash overwrites
  // the same object and the row insert skips the existing path.
  let stored = 0;
  const rows: AttachmentRecord[] = [];

  for (const planned of plan.accepted) {
    const bytes = await deps.provider.getAttachmentContent(
      integration,
      email.providerMessageId,
      planned.attachment,
    );

    if (bytes.length === 0) continue;

    if (bytes.length > deps.config.maxAttachmentBytes) {
      log.warn("attachment_too_large_after_download", { size: bytes.length });
      continue;
    }

    const storagePath = `${integration.tenantId}/${result.ticketId}/${planned.storedName}`;
    await deps.storage.upload(storagePath, bytes, planned.contentType);

    rows.push({
      tenantId: integration.tenantId,
      ticketId: result.ticketId,
      messageId: result.ticketMessageId,
      storagePath,
      filename: planned.storedName,
      originalFilename: planned.originalFilename,
      mime: planned.contentType,
      extension: planned.extension,
      size: bytes.length,
      uploadedBy: result.authorId ?? null,
    });
    stored += 1;
  }

  if (rows.length > 0) {
    await deps.store.recordAttachments(rows);
  }

  // 10. Done.
  await deps.store.complete(event.id);

  const latencyMs = Date.now() - email.receivedAt.getTime();
  log.info("email_processed", {
    outcome: result.outcome,
    ticket_id: result.ticketId,
    replayed: result.replayed,
    match_source: match?.source ?? null,
    attachments_stored: stored,
    attachments_rejected: plan.rejected.length,
    latency_ms: latencyMs,
  });
  deps.logger.metric("emails_processed", 1, {
    tenant_id: integration.tenantId,
  });
  deps.logger.metric(
    result.outcome === "ticket_created"
      ? "tickets_created_from_email"
      : result.outcome === "agent_reply_appended"
        ? "agent_replies_from_email"
        : "replies_appended_from_email",
    1,
    { tenant_id: integration.tenantId },
  );
  deps.logger.metric("email_processing_latency_ms", latencyMs, {
    tenant_id: integration.tenantId,
  });

  return {
    status: "processed",
    outcome: result.outcome,
    ticketId: result.ticketId,
    replayed: result.replayed,
    attachmentsStored: stored,
    attachmentsRejected: plan.rejected.length,
  };
}
