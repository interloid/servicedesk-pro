// The database side of email-to-ticket, over the service role: every port
// the shared pipeline declares (SyncStore, IngestStore, ThreadLookup,
// CredentialPersistence, AttachmentStorage), implemented with the RPCs in
// migration 20261127120000. Database errors surface as temporary failures,
// so a blip is retried rather than losing an email.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import type { CredentialPersistence } from "../_shared/email/credentials.ts";
import {
  PermanentIngestError,
  TemporaryEmailError,
} from "../_shared/email/errors.ts";
import type {
  AgentReplyInput,
  AttachmentRecord,
  AttachmentStorage,
  CommitInput,
  CommitResult,
  IngestStore,
} from "../_shared/email/processor.ts";
import type { ClaimedEvent, SyncStore } from "../_shared/email/sync.ts";
import type { ThreadLookup } from "../_shared/email/threading.ts";
import type {
  EmailIntegration,
  IntegrationStatus,
} from "../_shared/email/types.ts";

const ATTACHMENT_BUCKET = "ticket-attachments";
const LEASE = "5 minutes";

type PgError = { code?: string; message: string } | null;

function check(error: PgError, what: string): void {
  if (!error) return;
  if (error.code === "P0002") {
    throw new PermanentIngestError(
      `${what}: ${error.message}`,
      "invalid_email",
    );
  }
  throw new TemporaryEmailError(`${what}: ${error.message}`, "database");
}

function seconds(value: number): string {
  return `${Math.max(0, Math.round(value))} seconds`;
}

type IntegrationRow = {
  id: string;
  tenant_id: string;
  provider: string;
  connected_email: string;
  receiving_email: string;
  enabled: boolean;
  auto_create_customer: boolean;
  status: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  provider_history_id: string | null;
  watch_expiration: string | null;
};

function toIntegration(row: IntegrationRow): EmailIntegration {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    provider: row.provider as EmailIntegration["provider"],
    connectedEmail: row.connected_email,
    receivingEmail: row.receiving_email,
    enabled: row.enabled,
    autoCreateCustomer: row.auto_create_customer,
    status: row.status as IntegrationStatus,
    accessTokenEncrypted: row.access_token_encrypted,
    refreshTokenEncrypted: row.refresh_token_encrypted,
    tokenExpiresAt: row.token_expires_at
      ? new Date(row.token_expires_at)
      : null,
    providerHistoryId: row.provider_history_id,
    watchExpiration: row.watch_expiration
      ? new Date(row.watch_expiration)
      : null,
  };
}

/** email_ingest_commit / email_ingest_commit_agent_reply's jsonb result. */
function toCommitResult(data: unknown): CommitResult {
  const result = (data ?? {}) as Record<string, unknown>;

  if (result.status === "ignored") {
    return {
      status: "ignored",
      ignoreReason: String(result.ignore_reason ?? "ignored"),
      replayed: Boolean(result.replayed),
    };
  }

  if (result.status !== "committed" || typeof result.ticket_id !== "string") {
    throw new TemporaryEmailError(
      "email ingest commit returned an unexpected result",
      "database",
    );
  }

  const outcome =
    result.outcome === "reply_appended" ||
    result.outcome === "agent_reply_appended"
      ? result.outcome
      : "ticket_created";

  return {
    status: "committed",
    outcome,
    ticketId: result.ticket_id,
    ticketMessageId:
      typeof result.ticket_message_id === "string"
        ? result.ticket_message_id
        : null,
    customerId:
      typeof result.customer_id === "string" ? result.customer_id : null,
    authorId: typeof result.author_id === "string" ? result.author_id : null,
    replayed: Boolean(result.replayed),
  };
}

export class SupabaseEmailStore
  implements
    SyncStore,
    IngestStore,
    ThreadLookup,
    CredentialPersistence,
    AttachmentStorage
{
  constructor(private readonly db: SupabaseClient) {}

  // --- SyncStore -----------------------------------------------------------

  async loadIntegration(
    integrationId: string,
  ): Promise<EmailIntegration | null> {
    const { data, error } = await this.db
      .from("tenant_email_integrations")
      .select(
        "id, tenant_id, provider, connected_email, receiving_email, enabled, auto_create_customer, status, access_token_encrypted, refresh_token_encrypted, token_expires_at, provider_history_id, watch_expiration",
      )
      .eq("id", integrationId)
      .maybeSingle();

    check(error, "load integration");
    return data ? toIntegration(data as IntegrationRow) : null;
  }

  async acquireLease(integrationId: string, owner: string): Promise<boolean> {
    const { data, error } = await this.db.rpc(
      "email_acquire_integration_lease",
      {
        p_integration_id: integrationId,
        p_owner: owner,
        p_lease: LEASE,
      },
    );
    check(error, "acquire lease");
    return data === true;
  }

  async releaseLease(integrationId: string, owner: string): Promise<void> {
    const { error } = await this.db.rpc("email_release_integration_lease", {
      p_integration_id: integrationId,
      p_owner: owner,
    });
    // A lease that cannot be released expires on its own.
    if (error)
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "lease_release_failed",
          integration_id: integrationId,
        }),
      );
  }

  async recordEvents(
    integration: EmailIntegration,
    messageIds: string[],
  ): Promise<number> {
    let inserted = 0;

    for (let i = 0; i < messageIds.length; i += 200) {
      const rows = messageIds.slice(i, i + 200).map((id) => ({
        tenant_id: integration.tenantId,
        integration_id: integration.id,
        provider: integration.provider,
        provider_message_id: id,
        status: "pending",
      }));

      const { data, error } = await this.db
        .from("email_inbound_events")
        .upsert(rows, {
          onConflict: "integration_id,provider_message_id",
          ignoreDuplicates: true,
        })
        .select("id");

      check(error, "record events");
      inserted += data?.length ?? 0;
    }

    return inserted;
  }

  async advanceHistory(
    integrationId: string,
    historyId: string,
  ): Promise<void> {
    const { error } = await this.db.rpc("email_advance_history", {
      p_integration_id: integrationId,
      p_history_id: historyId,
    });
    check(error, "advance history");
  }

  async claimEvents(
    integrationId: string,
    limit: number,
  ): Promise<ClaimedEvent[]> {
    const { data, error } = await this.db.rpc("claim_email_inbound_events", {
      p_integration_id: integrationId,
      p_limit: limit,
      p_lease: LEASE,
    });
    check(error, "claim events");

    return (
      (data ?? []) as {
        id: string;
        provider_message_id: string;
        retry_count: number;
        ticket_id: string | null;
      }[]
    ).map((row) => ({
      id: row.id,
      providerMessageId: row.provider_message_id,
      retryCount: row.retry_count,
      committed: row.ticket_id !== null,
    }));
  }

  async failEvent(
    eventId: string,
    message: string,
    category: "temporary" | "permanent",
    retryInSeconds: number | null,
  ): Promise<string> {
    const { data, error } = await this.db.rpc("email_ingest_fail", {
      p_event_id: eventId,
      p_error: message,
      p_category: category,
      p_retry_in: retryInSeconds === null ? null : seconds(retryInSeconds),
    });
    check(error, "fail event");
    return typeof data === "string" ? data : "failed";
  }

  async releaseEvent(eventId: string, delaySeconds: number): Promise<void> {
    const { error } = await this.db
      .from("email_inbound_events")
      .update({
        status: "pending",
        locked_at: null,
        next_attempt_at: new Date(
          Date.now() + delaySeconds * 1000,
        ).toISOString(),
      })
      .eq("id", eventId)
      .eq("status", "processing");
    check(error, "release event");
  }

  async ignoreEvent(eventId: string, reason: string): Promise<void> {
    await this.ignore(eventId, reason);
  }

  async saveWatch(
    integrationId: string,
    watch: { expiration: Date; historyId: string | null },
  ): Promise<void> {
    const { error } = await this.db
      .from("tenant_email_integrations")
      .update({ watch_expiration: watch.expiration.toISOString() })
      .eq("id", integrationId)
      .neq("status", "disconnected");
    check(error, "save watch");

    if (watch.historyId)
      await this.advanceHistory(integrationId, watch.historyId);
    await this.markHealthy(integrationId);
  }

  async markHealthy(integrationId: string): Promise<void> {
    const { error } = await this.db
      .from("tenant_email_integrations")
      .update({ status: "connected", last_error: null, last_error_at: null })
      .eq("id", integrationId)
      .in("status", ["connecting", "error"]);
    check(error, "mark healthy");
  }

  async markProblem(
    integrationId: string,
    status: "error" | "expired",
    message: string,
  ): Promise<void> {
    const { error } = await this.db
      .from("tenant_email_integrations")
      .update({
        status,
        last_error: message,
        last_error_at: new Date().toISOString(),
      })
      .eq("id", integrationId)
      .neq("status", "disconnected");
    check(error, "mark problem");
  }

  // --- IngestStore ---------------------------------------------------------

  async commit(eventId: string, input: CommitInput): Promise<CommitResult> {
    const { data, error } = await this.db.rpc("email_ingest_commit", {
      p_event_id: eventId,
      p_input: input,
    });
    check(error, "commit email");
    return toCommitResult(data);
  }

  async commitAgentReply(
    eventId: string,
    input: AgentReplyInput,
  ): Promise<CommitResult> {
    const { data, error } = await this.db.rpc(
      "email_ingest_commit_agent_reply",
      { p_event_id: eventId, p_input: input },
    );
    check(error, "commit agent reply");
    return toCommitResult(data);
  }

  async ignore(eventId: string, reason: string): Promise<void> {
    const { error } = await this.db.rpc("email_ingest_ignore", {
      p_event_id: eventId,
      p_reason: reason,
    });
    check(error, "ignore event");
  }

  async complete(eventId: string): Promise<void> {
    const { error } = await this.db.rpc("email_ingest_complete", {
      p_event_id: eventId,
    });
    check(error, "complete event");
  }

  async recordAttachments(rows: AttachmentRecord[]): Promise<void> {
    const { error } = await this.db.from("attachments").upsert(
      rows.map((row) => ({
        tenant_id: row.tenantId,
        ticket_id: row.ticketId,
        message_id: row.messageId,
        storage_path: row.storagePath,
        filename: row.filename,
        original_filename: row.originalFilename,
        mime: row.mime,
        extension: row.extension || null,
        size: row.size,
        // Null for a customer's files, as for a portal customer's: nobody
        // on staff uploaded them, which is what lets the customer see them
        // in the portal. An agent reply's files name the agent.
        uploaded_by: row.uploadedBy ?? null,
        checksum: null,
      })),
      { onConflict: "storage_path", ignoreDuplicates: true },
    );
    check(error, "record attachments");
  }

  // --- AttachmentStorage ---------------------------------------------------

  async upload(
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<void> {
    // Not `upsert: true`: Storage runs that as ON CONFLICT (name, bucket_id),
    // which fails (42P10) on a storage schema with object versioning, where
    // that pair has no plain unique index. The path is a function of the
    // event and the attachment's position, so an object already there is this
    // same file from an earlier attempt: "already exists" is success.
    const { error } = await this.db.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, bytes, { contentType, upsert: false });

    const status = String(
      (error as { statusCode?: string | number } | null)?.statusCode ?? "",
    );
    if (
      error &&
      (status === "409" || /already exists|duplicate/i.test(error.message))
    ) {
      return;
    }

    if (error) {
      throw new TemporaryEmailError(
        `attachment upload: ${error.message}`,
        "database",
      );
    }
  }

  // --- ThreadLookup --------------------------------------------------------

  async findTicketIdByMessageIds(
    tenantId: string,
    messageIds: string[],
  ): Promise<string | null> {
    const { data, error } = await this.db.rpc("email_find_thread_ticket", {
      p_tenant_id: tenantId,
      p_message_ids: messageIds,
    });
    check(error, "thread lookup");
    return typeof data === "string" ? data : null;
  }

  async findTicketIdByNumber(
    tenantId: string,
    ticketNumber: number,
  ): Promise<string | null> {
    const { data, error } = await this.db
      .from("tickets")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("number", ticketNumber)
      .maybeSingle();
    check(error, "ticket lookup");
    return (data as { id: string } | null)?.id ?? null;
  }

  // --- CredentialPersistence -----------------------------------------------

  async saveTokens(
    integrationId: string,
    tokens: {
      accessTokenEncrypted: string;
      tokenExpiresAt: Date;
      refreshTokenEncrypted?: string;
    },
  ): Promise<void> {
    const update: Record<string, string> = {
      access_token_encrypted: tokens.accessTokenEncrypted,
      token_expires_at: tokens.tokenExpiresAt.toISOString(),
    };
    if (tokens.refreshTokenEncrypted)
      update.refresh_token_encrypted = tokens.refreshTokenEncrypted;

    const { error } = await this.db
      .from("tenant_email_integrations")
      .update(update)
      .eq("id", integrationId)
      .neq("status", "disconnected");
    check(error, "save tokens");
  }
}
