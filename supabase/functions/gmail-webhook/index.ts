import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { createLogger } from "../_shared/email/logger.ts";
import {
  decodeGmailPush,
  PubSubAuthError,
  verifyPubSubPushToken,
} from "../_shared/email/providers/gmail/pubsub-auth.ts";

// Gmail -> Pub/Sub push endpoint.
//
//   validate (Google-signed OIDC token for our subscription)
//   -> decode {emailAddress, historyId}
//   -> find the integration for that mailbox
//   -> queue a sync (email_enqueue_sync collapses bursts)
//   -> 200
//
// Nothing else: no Gmail call, no ticket. The worker (email-ingest) is
// kicked in the background so the email is filed within seconds, and the
// cron picks the job up anyway if the kick is lost.
//
// verify_jwt is OFF (config.toml): Google's token is not a Supabase JWT. The
// OIDC check below is what stands in front of the queue, and it fails closed
// when GOOGLE_PUBSUB_AUDIENCE or GOOGLE_PUBSUB_SERVICE_ACCOUNT is unset.
//
// Status codes: 2xx acknowledges, anything else makes Pub/Sub redeliver with
// backoff. So a request we can never use (unknown mailbox, junk payload) is
// acknowledged, and only a failure worth retrying (database down) is not.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")?.trim();
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
const AUDIENCE = Deno.env.get("GOOGLE_PUBSUB_AUDIENCE")?.trim() ?? "";
const SERVICE_ACCOUNT =
  Deno.env.get("GOOGLE_PUBSUB_SERVICE_ACCOUNT")?.trim() ?? "";
// Optional second factor: ?token=<value> on the push endpoint URL.
const VERIFICATION_TOKEN =
  Deno.env.get("GOOGLE_PUBSUB_VERIFICATION_TOKEN")?.trim() ?? "";

if (!SUPABASE_URL) throw new Error("SUPABASE_URL is missing");
if (!SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const logger = createLogger({ service: "gmail-webhook" });

/** A Gmail notification is ~300 bytes; anything large is not one. */
const MAX_BODY_BYTES = 16 * 1024;

declare const EdgeRuntime:
  { waitUntil(promise: Promise<unknown>): void } | undefined;

function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

function kickWorker(): void {
  const run = fetch(`${SUPABASE_URL}/functions/v1/email-ingest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  })
    .then((response) => response.body?.cancel())
    .catch((error) => {
      logger.warn("worker_kick_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    });

  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime) {
    EdgeRuntime.waitUntil(run);
  }
}

const ack = () => new Response(null, { status: 204 });

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  if (VERIFICATION_TOKEN) {
    const token = new URL(req.url).searchParams.get("token") ?? "";
    if (!constantTimeEqual(token, VERIFICATION_TOKEN)) {
      logger.warn("push_rejected", { why: "verification_token" });
      return new Response(null, { status: 403 });
    }
  }

  try {
    await verifyPubSubPushToken(req.headers.get("authorization"), {
      audience: AUDIENCE,
      serviceAccountEmail: SERVICE_ACCOUNT,
    });
  } catch (error) {
    const why =
      error instanceof PubSubAuthError ? error.message : "verification error";
    logger.warn("push_rejected", { why });
    return new Response(null, {
      status: error instanceof PubSubAuthError ? 401 : 503,
    });
  }

  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) {
    logger.warn("push_ignored", { why: "body_too_large", size: length });
    return ack();
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    logger.warn("push_ignored", { why: "body_too_large", size: raw.length });
    return ack();
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    logger.warn("push_ignored", { why: "invalid_json" });
    return ack();
  }

  const notification = decodeGmailPush(body);
  if (!notification) {
    logger.warn("push_ignored", { why: "not_a_gmail_notification" });
    return ack();
  }

  const { data: integration, error } = await db
    .from("tenant_email_integrations")
    .select("id, tenant_id, status")
    .eq("provider", "gmail")
    .eq("connected_email", notification.emailAddress)
    .neq("status", "disconnected")
    .maybeSingle();

  if (error) {
    logger.error("integration_lookup_failed", { message: error.message });
    return new Response(null, { status: 500 });
  }

  if (!integration) {
    // A mailbox disconnected since its watch was registered: the watch runs
    // out within a week. Acknowledge so Pub/Sub stops redelivering.
    logger.info("push_ignored", {
      why: "unknown_mailbox",
      pubsub_message_id: notification.pubsubMessageId,
    });
    return ack();
  }

  const { data: jobId, error: enqueueError } = await db.rpc(
    "email_enqueue_sync",
    {
      p_integration_id: integration.id,
      p_history_id: notification.historyId,
      p_reason: "push",
      p_kind: "sync",
    },
  );

  if (enqueueError) {
    // Not acknowledged: Pub/Sub redelivers, and reconciliation is the backstop.
    logger.error("enqueue_failed", {
      integration_id: integration.id,
      tenant_id: integration.tenant_id,
      message: enqueueError.message,
    });
    return new Response(null, { status: 500 });
  }

  logger.info("push_accepted", {
    integration_id: integration.id,
    tenant_id: integration.tenant_id,
    history_id: notification.historyId,
    pubsub_message_id: notification.pubsubMessageId,
    queue_job_id: typeof jobId === "string" ? jobId : null,
  });

  kickWorker();

  return ack();
});
