import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { maxAttachmentBytes } from "../_shared/email/attachments.ts";
import { IntegrationCredentials } from "../_shared/email/credentials.ts";
import { classifyError, safeErrorMessage } from "../_shared/email/errors.ts";
import { createLogger } from "../_shared/email/logger.ts";
import {
  GmailProvider,
  gmailRefresher,
} from "../_shared/email/providers/gmail/gmail-provider.ts";
import {
  runSyncJob,
  runWatchJob,
  type SyncJob,
  type WorkerDeps,
} from "../_shared/email/sync.ts";
import { createThreadMatcher } from "../_shared/email/threading.ts";
import { importEncryptionKey } from "../_shared/email/token-crypto.ts";
import { isServiceRole } from "../_shared/service-role.ts";

import { SupabaseEmailStore } from "./store.ts";

// The email-to-ticket worker. Drains public.email_sync_jobs:
//   sync   Gmail history -> email_inbound_events -> tickets / replies
//   watch  register or renew the Gmail push subscription
//
// Two callers, both with the service role key as a bearer token:
//   1. pg_cron every minute while a job is due (retries, reconciliation,
//      watch renewal -- see email_ingest_schedule)
//   2. gmail-webhook, right after it queues a sync, so a new email does not
//      wait for the minute
// claim_email_sync_jobs (SKIP LOCKED) and the per-mailbox lease let them run
// at the same time without doing anything twice.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")?.trim();
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")?.trim();
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim();
const GOOGLE_PUBSUB_TOPIC = Deno.env.get("GOOGLE_PUBSUB_TOPIC")?.trim();
const EMAIL_ENCRYPTION_KEY = Deno.env.get("EMAIL_ENCRYPTION_KEY")?.trim();
const MAX_ATTACHMENT_BYTES = maxAttachmentBytes(
  Deno.env.get("EMAIL_MAX_ATTACHMENT_BYTES"),
);
// The platform's own sending address(es): mail from them is never a customer.
const SYSTEM_SENDERS = [Deno.env.get("FROM_EMAIL")]
  .map((value) => value?.trim().match(/<([^<>]+)>/)?.[1] ?? value?.trim())
  .filter((value): value is string => Boolean(value));

if (!SUPABASE_URL) throw new Error("SUPABASE_URL is missing");
if (!SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const logger = createLogger({ service: "email-ingest" });

/** Stop claiming work after this long; Edge Functions are cut off later. */
const TIME_BUDGET_MS = 100_000;
const JOBS_PER_CLAIM = 5;

function missingConfig(): string[] {
  return [
    ["GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID],
    ["GOOGLE_CLIENT_SECRET", GOOGLE_CLIENT_SECRET],
    ["GOOGLE_PUBSUB_TOPIC", GOOGLE_PUBSUB_TOPIC],
    ["EMAIL_ENCRYPTION_KEY", EMAIL_ENCRYPTION_KEY],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name as string);
}

type JobRow = {
  id: string;
  tenant_id: string;
  integration_id: string;
  kind: "sync" | "watch";
  reason: string;
  history_id: string | null;
  attempts: number;
  max_attempts: number;
};

async function buildDeps(
  workerId: string,
  deadline: number,
): Promise<WorkerDeps> {
  const store = new SupabaseEmailStore(db);
  const google = {
    clientId: GOOGLE_CLIENT_ID!,
    clientSecret: GOOGLE_CLIENT_SECRET!,
  };

  const credentials = new IntegrationCredentials({
    key: await importEncryptionKey(EMAIL_ENCRYPTION_KEY),
    refresh: gmailRefresher(google),
    persistence: store,
    onRefreshFailure: (integration, error) => {
      const classified = classifyError(error);
      logger.warn("oauth_refresh_failed", {
        integration_id: integration.id,
        tenant_id: integration.tenantId,
        error_category: classified.category,
        error_code: classified.code,
      });
      logger.metric("oauth_refresh_failures", 1, {
        tenant_id: integration.tenantId,
      });
    },
  });

  const provider = new GmailProvider({
    google,
    pubsubTopic: GOOGLE_PUBSUB_TOPIC!,
    credentials,
  });

  return {
    store,
    provider,
    processor: {
      store,
      storage: store,
      threads: createThreadMatcher(store),
      config: {
        systemSenders: SYSTEM_SENDERS,
        maxAttachmentBytes: MAX_ATTACHMENT_BYTES,
      },
    },
    logger,
    workerId,
    deadline,
  };
}

async function runJob(row: JobRow, deps: WorkerDeps): Promise<boolean> {
  const job: SyncJob = {
    id: row.id,
    tenantId: row.tenant_id,
    integrationId: row.integration_id,
    kind: row.kind,
    reason: row.reason,
    historyId: row.history_id,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
  };

  let result;
  try {
    result =
      job.kind === "watch"
        ? await runWatchJob(job, deps)
        : await runSyncJob(job, deps);
  } catch (error) {
    // A bug or an unexpected throw outside the job's own handling.
    const classified = classifyError(error);
    result = {
      ok: false as const,
      error: safeErrorMessage(
        `${classified.code}: ${classified.message}`,
        1000,
      ),
      retryInSeconds: classified.category === "permanent" ? null : 60,
    };
  }

  const { error } = await db.rpc("email_finish_sync_job", {
    p_job_id: job.id,
    p_ok: result.ok,
    p_error: result.ok ? null : result.error,
    p_retry_in:
      result.ok || result.retryInSeconds === null
        ? null
        : `${result.retryInSeconds} seconds`,
  });

  if (error) {
    // The lease runs out and the job is claimed again; nothing is lost.
    logger.error("job_finish_failed", {
      job_id: job.id,
      message: error.message,
    });
  }

  if (!result.ok) {
    logger.warn("job_failed", {
      job_id: job.id,
      job_kind: job.kind,
      integration_id: job.integrationId,
      tenant_id: job.tenantId,
      attempt: job.attempts,
      will_retry:
        result.retryInSeconds !== null && job.attempts < job.maxAttempts,
    });
  }

  return result.ok;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false }, { status: 405 });
  }

  // verify_jwt = true proves only that the token is genuine; a signed-in
  // user's token is genuine too.
  if (!isServiceRole(req, SERVICE_ROLE_KEY)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const missing = missingConfig();
  if (missing.length > 0) {
    // Jobs stay queued until the function is configured.
    logger.error("worker_not_configured", { missing: missing.join(",") });
    return Response.json(
      { ok: false, error: "not_configured" },
      { status: 503 },
    );
  }

  const started = Date.now();
  const workerId = crypto.randomUUID();
  const deps = await buildDeps(workerId, started + TIME_BUDGET_MS);
  let succeeded = 0;
  let failed = 0;

  while (Date.now() < deps.deadline) {
    const { data, error } = await db.rpc("claim_email_sync_jobs", {
      p_limit: JOBS_PER_CLAIM,
    });

    if (error) {
      logger.error("job_claim_failed", { message: error.message });
      return Response.json({ ok: false, succeeded, failed }, { status: 500 });
    }

    const jobs = (data ?? []) as JobRow[];
    if (jobs.length === 0) break;

    // Different mailboxes in parallel; one mailbox is serialised by its lease.
    const results = await Promise.all(jobs.map((job) => runJob(job, deps)));
    succeeded += results.filter(Boolean).length;
    failed += results.filter((ok) => !ok).length;

    if (jobs.length < JOBS_PER_CLAIM) break;
  }

  const { count } = await db
    .from("email_sync_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  logger.info("worker_run", {
    worker_id: workerId,
    jobs_succeeded: succeeded,
    jobs_failed: failed,
    duration_ms: Date.now() - started,
  });
  logger.metric("email_queue_depth", count ?? 0);

  return Response.json({ ok: true, succeeded, failed });
});
