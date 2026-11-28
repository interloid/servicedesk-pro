import "server-only";

// Settings -> Channels -> Email: the Tenant Admin's side of email-to-ticket.
//
// Reads go through the signed-in user's own client: RLS limits them to the
// workspace's Tenant Admin and the API role is not granted the token columns,
// so nothing on this page can carry a token. Writes are checked here (live
// Tenant Admin membership, not just the JWT) and then made with the service
// role, as every channel change must be -- the table has no client write
// policy at all.
//
// The provider calls (code exchange, profile, watch, revoke) are the shared
// Gmail adapter the worker uses, imported from supabase/functions/_shared.

import { serverEnv } from "@/config/server-env";
import {
  createAuditedAdminClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActorOrNull } from "@/features/team/services/team.service";

import {
  addressBase,
  isValidEmail,
  normalizeEmail,
} from "../../../../supabase/functions/_shared/email/address.ts";
import {
  GmailApi,
  exchangeAuthorizationCode,
  refreshAccessToken,
  revokeToken,
} from "../../../../supabase/functions/_shared/email/providers/gmail/gmail-api.ts";
import {
  buildGoogleAuthUrl,
  createPkcePair,
  hasRequiredScopes,
} from "../../../../supabase/functions/_shared/email/providers/gmail/oauth.ts";
import {
  decryptToken,
  encryptToken,
  importEncryptionKey,
  tokenAad,
} from "../../../../supabase/functions/_shared/email/token-crypto.ts";

import type {
  EmailChannel,
  EmailChannelPageData,
  EmailChannelStats,
  InboundEmail,
} from "../email-channels";
import {
  OAUTH_TTL_SECONDS,
  decodeOAuthCookie,
  encodeOAuthCookie,
  newNonce,
  sameNonce,
  signState,
  verifyState,
} from "./oauth-state";

export class EmailChannelError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly field?: "receivingEmail",
  ) {
    super(message);
    this.name = "EmailChannelError";
  }
}

const PROVIDER = "gmail" as const;

/** The columns the API role may read (see the migration's column grants). */
const CHANNEL_COLUMNS =
  "id, provider, connected_email, receiving_email, enabled, auto_create_customer, status, last_sync_at, watch_expiration, last_error, last_error_at, created_at";

const EVENT_COLUMNS =
  "id, status, sender_email, subject, outcome, ignore_reason, ticket_id, retry_count, error_message, error_category, received_at, created_at";

const RECENT_EVENTS = 25;

type GmailConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  topic: string;
  encryptionKey: string;
};

export function emailChannelsConfigured(): boolean {
  return gmailConfig() !== null;
}

function gmailConfig(): GmailConfig | null {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    GOOGLE_PUBSUB_TOPIC,
    EMAIL_ENCRYPTION_KEY,
  } = serverEnv;

  if (
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    !GOOGLE_REDIRECT_URI ||
    !GOOGLE_PUBSUB_TOPIC ||
    !EMAIL_ENCRYPTION_KEY
  ) {
    return null;
  }

  return {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: GOOGLE_REDIRECT_URI,
    topic: GOOGLE_PUBSUB_TOPIC,
    encryptionKey: EMAIL_ENCRYPTION_KEY,
  };
}

function requireConfig(): GmailConfig {
  const config = gmailConfig();
  if (!config) {
    throw new EmailChannelError(
      "Email channels aren't set up on this deployment yet.",
      "not_configured",
    );
  }
  return config;
}

type ChannelAdmin = {
  userId: string;
  tenantId: string;
  tenantSlug: string | null;
};

/**
 * The caller is an active Tenant Admin of the workspace in their session.
 * getActorOrNull re-reads the membership with the service role, so a demoted
 * or removed admin with a still-valid JWT is refused.
 */
export async function getChannelAdmin(): Promise<ChannelAdmin | null> {
  const actor = await getActorOrNull();
  if (!actor || actor.role !== "Tenant Admin") return null;
  return {
    userId: actor.userId,
    tenantId: actor.tenantId,
    tenantSlug: actor.tenantSlug,
  };
}

async function requireChannelAdmin(): Promise<ChannelAdmin> {
  const admin = await getChannelAdmin();
  if (!admin) {
    throw new EmailChannelError(
      "Only a Tenant Admin can change email channels.",
      "not_allowed",
    );
  }
  return admin;
}

async function audit(
  admin: ChannelAdmin,
  entityId: string,
  summary: string,
  meta: Record<string, string | boolean | null> = {},
): Promise<void> {
  const db = await createAuditedAdminClient(admin.userId);
  const { error } = await db.from("audit_logs").insert({
    tenant_id: admin.tenantId,
    actor_id: admin.userId,
    action: "update",
    entity: "email_channel",
    entity_id: entityId,
    meta_json: { summary, ...meta },
  });

  // The change has happened; a missing audit row must still be noticed.
  if (error)
    console.error("[email-channels] audit entry failed:", error.message);
}

// ---------------------------------------------------------------------------
// Page data
// ---------------------------------------------------------------------------

type ChannelRow = {
  id: string;
  provider: string;
  connected_email: string;
  receiving_email: string;
  enabled: boolean;
  auto_create_customer: boolean;
  status: EmailChannel["status"];
  last_sync_at: string | null;
  watch_expiration: string | null;
  last_error: string | null;
  last_error_at: string | null;
  created_at: string;
};

type EventRow = {
  id: string;
  status: InboundEmail["status"];
  sender_email: string | null;
  subject: string | null;
  outcome: InboundEmail["outcome"];
  ignore_reason: string | null;
  ticket_id: string | null;
  retry_count: number;
  error_message: string | null;
  error_category: InboundEmail["errorCategory"];
  received_at: string | null;
  created_at: string;
};

function toChannel(row: ChannelRow): EmailChannel {
  return {
    id: row.id,
    provider: PROVIDER,
    connectedEmail: row.connected_email,
    receivingEmail: row.receiving_email,
    enabled: row.enabled,
    autoCreateCustomer: row.auto_create_customer,
    status: row.status,
    lastSyncAt: row.last_sync_at,
    watchExpiration: row.watch_expiration,
    lastError: row.last_error,
    lastErrorAt: row.last_error_at,
    createdAt: row.created_at,
  };
}

function toInboundEmail(row: EventRow): InboundEmail {
  return {
    id: row.id,
    status: row.status,
    senderEmail: row.sender_email,
    subject: row.subject,
    outcome: row.outcome,
    ignoreReason: row.ignore_reason,
    ticketId: row.ticket_id,
    retryCount: row.retry_count,
    errorMessage: row.error_message,
    errorCategory: row.error_category,
    receivedAt: row.received_at,
    createdAt: row.created_at,
  };
}

function toStats(raw: unknown): EmailChannelStats | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const num = (key: string) => Number(value[key] ?? 0) || 0;

  return {
    received: num("received"),
    ticketsCreated: num("tickets_created"),
    repliesAppended: num("replies_appended"),
    ignored: num("ignored"),
    failed: num("failed"),
    queued: num("queued"),
    avgLatencySeconds:
      value.avg_latency_seconds == null
        ? null
        : Number(value.avg_latency_seconds),
    syncInProgress: value.sync_in_progress === true,
  };
}

export async function getEmailChannelPage(): Promise<EmailChannelPageData> {
  const supabase = await createSupabaseServerClient();
  const configured = emailChannelsConfigured();

  const { data: row, error } = await supabase
    .from("tenant_email_integrations")
    .select(CHANNEL_COLUMNS)
    .eq("provider", PROVIDER)
    .neq("status", "disconnected")
    .maybeSingle();

  if (error) {
    console.error("[email-channels] channel read failed:", error.message);
    throw new EmailChannelError(
      "We couldn't load your email channel.",
      "load_failed",
    );
  }

  if (!row) {
    return { configured, channel: null, recent: [], stats: null };
  }

  const channel = toChannel(row as ChannelRow);

  const [
    { data: events, error: eventsError },
    { data: stats, error: statsError },
  ] = await Promise.all([
    supabase
      .from("email_inbound_events")
      .select(EVENT_COLUMNS)
      .eq("integration_id", channel.id)
      // Mail that was never for the support address, and the owner's own sent
      // mail that answered no ticket, stay out of the list:
      // on a personal inbox it is somebody's private mail.
      .or(
        "ignore_reason.is.null,ignore_reason.not.in.(not_support_address,sent_not_ticket_reply,draft_or_sent)",
      )
      .order("created_at", { ascending: false })
      .limit(RECENT_EVENTS),
    supabase.rpc("email_channel_stats"),
  ]);

  if (eventsError)
    console.error("[email-channels] events read failed:", eventsError.message);
  if (statsError)
    console.error("[email-channels] stats read failed:", statsError.message);

  return {
    configured,
    channel,
    recent: ((events ?? []) as EventRow[]).map(toInboundEmail),
    stats: toStats(stats),
  };
}

// ---------------------------------------------------------------------------
// Connect (OAuth)
// ---------------------------------------------------------------------------

/** Step one: the Google URL to send the admin to, and the cookie to set. */
export async function startGmailConnect(): Promise<{
  url: string;
  cookie: string;
}> {
  const config = requireConfig();
  const admin = await requireChannelAdmin();

  if (!admin.tenantSlug) {
    throw new EmailChannelError(
      "Your session has no workspace. Sign in again.",
      "not_allowed",
    );
  }

  const nonce = newNonce();
  const pkce = await createPkcePair();
  const state = await signState(
    {
      t: admin.tenantId,
      u: admin.userId,
      s: admin.tenantSlug,
      n: nonce,
      e: Date.now() + OAUTH_TTL_SECONDS * 1000,
    },
    config.encryptionKey,
  );

  return {
    url: buildGoogleAuthUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state,
      codeChallenge: pkce.challenge,
    }),
    cookie: encodeOAuthCookie({ n: nonce, v: pkce.verifier }),
  };
}

export type ConnectResult = {
  /** Where to send the browser back to (tenant slug), when known. */
  slug: string | null;
  code:
    | "connected"
    | "connected_no_watch"
    | "denied"
    | "missing_scope"
    | "mailbox_in_use"
    | "state_invalid"
    | "not_allowed"
    | "not_configured"
    | "failed";
};

/**
 * Step two, the callback. Every check that can fail without Google is done
 * before the code is exchanged, so a forged callback costs nothing.
 */
export async function completeGmailConnect(params: {
  code: string | null;
  state: string | null;
  providerError: string | null;
  cookie: string | undefined;
}): Promise<ConnectResult> {
  const config = gmailConfig();
  if (!config) return { slug: null, code: "not_configured" };

  const state = await verifyState(params.state, config.encryptionKey);
  const cookie = decodeOAuthCookie(params.cookie);

  if (!state || !cookie || !sameNonce(state.n, cookie.n)) {
    return { slug: state?.s ?? null, code: "state_invalid" };
  }

  if (params.providerError || !params.code) {
    return { slug: state.s, code: "denied" };
  }

  const admin = await getChannelAdmin();
  if (!admin || admin.userId !== state.u || admin.tenantId !== state.t) {
    return { slug: state.s, code: "not_allowed" };
  }

  const tokens = await exchangeAuthorizationCode({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    code: params.code,
    codeVerifier: cookie.v,
  });

  if (!hasRequiredScopes(tokens.scope)) {
    await revokeToken(tokens.refreshToken ?? tokens.accessToken);
    return { slug: state.s, code: "missing_scope" };
  }

  if (!tokens.refreshToken) {
    // prompt=consent always returns one; without it the worker could not read mail later.
    return { slug: state.s, code: "failed" };
  }

  const gmail = new GmailApi();
  const profile = await gmail.getProfile(tokens.accessToken);
  const mailbox = normalizeEmail(profile.emailAddress);

  const db = createSupabaseAdminClient();

  const { data: taken } = await db
    .from("tenant_email_integrations")
    .select("id")
    .eq("provider", PROVIDER)
    .eq("connected_email", mailbox)
    .neq("status", "disconnected")
    .neq("tenant_id", admin.tenantId)
    .limit(1)
    .maybeSingle();

  if (taken) {
    await revokeToken(tokens.refreshToken);
    return { slug: state.s, code: "mailbox_in_use" };
  }

  const key = await importEncryptionKey(config.encryptionKey);
  const aad = tokenAad(admin.tenantId, PROVIDER);
  const encrypted = {
    access_token_encrypted: await encryptToken(tokens.accessToken, key, aad),
    refresh_token_encrypted: await encryptToken(tokens.refreshToken, key, aad),
    token_expires_at: tokens.expiresAt.toISOString(),
    granted_scopes: tokens.scope ?? null,
  };

  const { data: existing } = await db
    .from("tenant_email_integrations")
    .select("id, connected_email, refresh_token_encrypted")
    .eq("tenant_id", admin.tenantId)
    .eq("provider", PROVIDER)
    .neq("status", "disconnected")
    .maybeSingle();

  let integrationId: string;
  let reconnect = false;

  if (existing && normalizeEmail(existing.connected_email) === mailbox) {
    // Reconnecting the same mailbox (an expired grant): keep its settings,
    // cursor and history; only the credentials change.
    const { error } = await db
      .from("tenant_email_integrations")
      .update({
        ...encrypted,
        status: "connecting",
        last_error: null,
        last_error_at: null,
        connected_by: admin.userId,
      })
      .eq("id", existing.id);

    if (error) throw new Error(`reconnect failed: ${error.message}`);
    integrationId = existing.id;
    reconnect = true;
  } else {
    if (existing) {
      // A different mailbox replaces the old one: retire the old row (its
      // history stays) before the new one takes the workspace's slot.
      await retireIntegration(
        existing.id,
        admin.tenantId,
        existing.refresh_token_encrypted,
        config,
      );
    }

    const { data: inserted, error } = await db
      .from("tenant_email_integrations")
      .insert({
        tenant_id: admin.tenantId,
        provider: PROVIDER,
        connected_email: mailbox,
        receiving_email: mailbox,
        ...encrypted,
        status: "connecting",
        connected_by: admin.userId,
      })
      .select("id")
      .single();

    if (error?.code === "23505") {
      await revokeToken(tokens.refreshToken);
      return { slug: state.s, code: "mailbox_in_use" };
    }
    if (error || !inserted)
      throw new Error(`connect insert failed: ${error?.message}`);
    integrationId = inserted.id;
  }

  // Register the push subscription now, so mail arriving from this moment is
  // announced. On failure the channel still works: the scheduler retries the
  // watch and reconciliation polls the inbox meanwhile.
  let watched = true;
  try {
    // INBOX for customers' mail, SENT for the team replying from Gmail.
    const watch = await gmail.watch(tokens.accessToken, config.topic, [
      "INBOX",
      "SENT",
    ]);
    // A new mailbox starts from now. A reconnected one keeps its old cursor,
    // so the mail that arrived while the grant was expired is still read
    // (the sync falls back to recent inbox mail if that cursor aged out).
    if (!reconnect) {
      await db.rpc("email_advance_history", {
        p_integration_id: integrationId,
        p_history_id: String(watch.historyId),
      });
    }
    const { error } = await db
      .from("tenant_email_integrations")
      .update({
        watch_expiration: new Date(Number(watch.expiration)).toISOString(),
        status: "connected",
        last_error: null,
        last_error_at: null,
      })
      .eq("id", integrationId);
    if (error) throw new Error(error.message);
  } catch (error) {
    watched = false;
    console.error(
      "[email-channels] watch registration failed:",
      error instanceof Error ? error.message : error,
    );
    await db
      .from("tenant_email_integrations")
      .update({
        status: "error",
        last_error:
          "Push notifications couldn't be registered yet; retrying automatically.",
        last_error_at: new Date().toISOString(),
      })
      .eq("id", integrationId);
    await db.rpc("email_enqueue_sync", {
      p_integration_id: integrationId,
      p_reason: "connect",
      p_kind: "watch",
    });
  }

  await audit(
    admin,
    integrationId,
    reconnect ? `Reconnected Gmail ${mailbox}` : `Connected Gmail ${mailbox}`,
    {
      provider: PROVIDER,
      mailbox,
    },
  );

  return { slug: state.s, code: watched ? "connected" : "connected_no_watch" };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function updateEmailChannelSettings(values: {
  receivingEmail: string;
  enabled: boolean;
  autoCreateCustomer: boolean;
}): Promise<void> {
  const admin = await requireChannelAdmin();
  const db = createSupabaseAdminClient();

  const { data: current, error } = await db
    .from("tenant_email_integrations")
    .select(
      "id, connected_email, receiving_email, enabled, auto_create_customer",
    )
    .eq("tenant_id", admin.tenantId)
    .eq("provider", PROVIDER)
    .neq("status", "disconnected")
    .maybeSingle();

  if (error) throw new Error(`settings read failed: ${error.message}`);
  if (!current)
    throw new EmailChannelError("Connect Gmail first.", "not_found");

  const receiving = normalizeEmail(values.receivingEmail);

  if (!isValidEmail(receiving)) {
    throw new EmailChannelError(
      "Enter a valid email address.",
      "validation",
      "receivingEmail",
    );
  }

  const { error: updateError } = await db
    .from("tenant_email_integrations")
    .update({
      receiving_email: receiving,
      enabled: values.enabled,
      auto_create_customer: values.autoCreateCustomer,
    })
    .eq("id", current.id)
    .eq("tenant_id", admin.tenantId);

  if (updateError)
    throw new Error(`settings update failed: ${updateError.message}`);

  const changes: string[] = [];
  if (receiving !== normalizeEmail(current.receiving_email))
    changes.push(`support address ${receiving}`);
  if (values.enabled !== current.enabled)
    changes.push(values.enabled ? "turned on" : "turned off");
  if (values.autoCreateCustomer !== current.auto_create_customer) {
    changes.push(
      values.autoCreateCustomer
        ? "auto-create customers on"
        : "auto-create customers off",
    );
  }

  if (changes.length > 0) {
    await audit(
      admin,
      current.id,
      `Updated the email channel: ${changes.join(", ")}`,
      {
        receiving_email: receiving,
        enabled: values.enabled,
        auto_create_customer: values.autoCreateCustomer,
      },
    );
  }
}

/** True when the address lands in the connected inbox without forwarding. */
export function isMailboxAlias(receiving: string, connected: string): boolean {
  return addressBase(receiving) === addressBase(connected);
}

// ---------------------------------------------------------------------------
// Disconnect
// ---------------------------------------------------------------------------

/**
 * Stop the watch and revoke the grant at Google (best effort: the row is
 * cleared whatever Google answers), then drop the credentials and any queued
 * work. The emails already filed, and the event history, stay.
 */
async function retireIntegration(
  integrationId: string,
  tenantId: string,
  refreshTokenEncrypted: string | null,
  config: GmailConfig,
): Promise<void> {
  if (refreshTokenEncrypted) {
    try {
      const key = await importEncryptionKey(config.encryptionKey);
      const refreshToken = await decryptToken(
        refreshTokenEncrypted,
        key,
        tokenAad(tenantId, PROVIDER),
      );

      try {
        const access = await refreshAccessToken({
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          refreshToken,
        });
        await new GmailApi().stop(access.accessToken).catch(() => undefined);
      } catch {
        // Already revoked or expired: nothing left to stop.
      }

      await revokeToken(refreshToken);
    } catch (error) {
      console.error(
        "[email-channels] revoke failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const db = createSupabaseAdminClient();

  const { error } = await db
    .from("tenant_email_integrations")
    .update({
      status: "disconnected",
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      token_expires_at: null,
      watch_expiration: null,
      sync_lease_owner: null,
      sync_lease_until: null,
      disconnected_at: new Date().toISOString(),
    })
    .eq("id", integrationId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(`disconnect failed: ${error.message}`);

  await db
    .from("email_sync_jobs")
    .delete()
    .eq("integration_id", integrationId)
    .eq("status", "pending");
}

export async function disconnectEmailChannel(): Promise<void> {
  const admin = await requireChannelAdmin();
  const config = requireConfig();
  const db = createSupabaseAdminClient();

  const { data: current, error } = await db
    .from("tenant_email_integrations")
    .select("id, connected_email, refresh_token_encrypted")
    .eq("tenant_id", admin.tenantId)
    .eq("provider", PROVIDER)
    .neq("status", "disconnected")
    .maybeSingle();

  if (error) throw new Error(`disconnect read failed: ${error.message}`);
  if (!current) return;

  await retireIntegration(
    current.id,
    admin.tenantId,
    current.refresh_token_encrypted,
    config,
  );
  await audit(
    admin,
    current.id,
    `Disconnected Gmail ${current.connected_email}`,
    {
      provider: PROVIDER,
      mailbox: current.connected_email,
    },
  );
}

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

/** An admin's "Retry" on a failed email. Scoped to their workspace in SQL too. */
export async function retryInboundEmail(eventId: string): Promise<boolean> {
  const admin = await requireChannelAdmin();
  const db = createSupabaseAdminClient();

  const { data, error } = await db.rpc("email_retry_inbound_event", {
    p_tenant_id: admin.tenantId,
    p_event_id: eventId,
  });

  if (error) throw new Error(`retry failed: ${error.message}`);
  return data === true;
}

/** "Sync now": queue a sync for the workspace's mailbox. */
export async function requestEmailSync(): Promise<SyncRequestResult> {
  const admin = await requireChannelAdmin();
  const db = createSupabaseAdminClient();

  const { data: current } = await db
    .from("tenant_email_integrations")
    .select("id")
    .eq("tenant_id", admin.tenantId)
    .eq("provider", PROVIDER)
    .in("status", ["connected", "error", "connecting"])
    .maybeSingle();

  if (!current)
    throw new EmailChannelError("Connect Gmail first.", "not_found");

  const { data: jobId, error } = await db.rpc("email_enqueue_sync", {
    p_integration_id: current.id,
    p_reason: "manual",
    p_kind: "sync",
  });

  if (error) throw new Error(`sync request failed: ${error.message}`);
  if (typeof jobId !== "string") return "queued";

  // Run the worker now rather than at the next minute's cron, then wait a
  // little for this job so the page can show the result. If the kick or the
  // wait fails, the job is still queued and the cron runs it.
  const { error: kickError } = await db.rpc("email_kick_worker");
  if (kickError) {
    console.error("[email-channels] worker kick failed:", kickError.message);
    return "queued";
  }

  const deadline = Date.now() + SYNC_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const { data: job } = await db
      .from("email_sync_jobs")
      .select("status")
      .eq("id", jobId)
      .maybeSingle();

    if (job?.status === "completed") return "done";
    if (job?.status === "failed") return "failed";
  }

  return "queued";
}

/** How long "Sync now" waits for the worker before answering "queued". */
const SYNC_WAIT_MS = 20_000;

export type SyncRequestResult = "done" | "queued" | "failed";
