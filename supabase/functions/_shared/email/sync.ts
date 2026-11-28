// The worker's two jobs, provider-neutral:
//
//   runSyncJob   read the mailbox's changes after the saved cursor, record
//                each new message once (the ledger), move the cursor, then
//                process every event that is due -- new ones and retries
//   runWatchJob  register or renew the provider's push subscription
//
// A notification is never assumed to mean one email: the cursor, not the
// notification, decides what is read, so one sync can file many emails and
// a burst of notifications files each email once.
//
// Ordering makes a crash safe at every point:
//   events recorded -> cursor advanced -> events processed
// A crash before the cursor moves re-reads the same history next time and
// the ledger drops the duplicates; a crash mid-processing leaves events
// pending (or committed) for the next run.

import {
  AuthRevokedError,
  EVENT_RETRY_DELAYS_SECONDS,
  JOB_RETRY_DELAYS_SECONDS,
  MessageNotFoundError,
  classifyError,
  retryDelaySeconds,
  safeErrorMessage,
} from "./errors.ts";
import type { Logger } from "./logger.ts";
import { processIncomingEmail, type ProcessorDeps } from "./processor.ts";
import type { EmailIntegration, EmailProvider } from "./types.ts";

export interface SyncJob {
  id: string;
  tenantId: string;
  integrationId: string;
  kind: "sync" | "watch";
  reason: string;
  historyId: string | null;
  /** Including this one. */
  attempts: number;
  maxAttempts: number;
}

export interface ClaimedEvent {
  id: string;
  providerMessageId: string;
  /** Failed attempts so far. */
  retryCount: number;
  /** Its ticket or reply already exists (an earlier attempt committed it). */
  committed: boolean;
}

export interface SyncStore {
  loadIntegration(integrationId: string): Promise<EmailIntegration | null>;
  acquireLease(integrationId: string, owner: string): Promise<boolean>;
  releaseLease(integrationId: string, owner: string): Promise<void>;
  /** Insert one pending event per message id, skipping known ones. Returns how many were new. */
  recordEvents(
    integration: EmailIntegration,
    messageIds: string[],
  ): Promise<number>;
  advanceHistory(integrationId: string, historyId: string): Promise<void>;
  claimEvents(integrationId: string, limit: number): Promise<ClaimedEvent[]>;
  /** Back to pending (or failed); returns the new status. */
  failEvent(
    eventId: string,
    message: string,
    category: "temporary" | "permanent",
    retryInSeconds: number | null,
  ): Promise<string>;
  /** Back to pending without counting a retry (the integration, not the email, is broken). */
  releaseEvent(eventId: string, delaySeconds: number): Promise<void>;
  ignoreEvent(eventId: string, reason: string): Promise<void>;
  saveWatch(
    integrationId: string,
    watch: { expiration: Date; historyId: string | null },
  ): Promise<void>;
  /** status connected, last_error cleared. */
  markHealthy(integrationId: string): Promise<void>;
  markProblem(
    integrationId: string,
    status: "error" | "expired",
    message: string,
  ): Promise<void>;
}

export interface WorkerDeps {
  store: SyncStore;
  provider: EmailProvider;
  processor: Omit<ProcessorDeps, "provider" | "logger">;
  logger: Logger;
  /** Unique per invocation: the lease owner. */
  workerId: string;
  /** Stop claiming new work after this (epoch ms): the function's wall-clock budget. */
  deadline: number;
  now?: () => number;
}

export type JobResult =
  | {
      ok: true;
      recorded?: number;
      processed?: number;
      failed?: number;
      ignored?: number;
    }
  | { ok: false; error: string; retryInSeconds: number | null };

const EVENT_BATCH = 5;

function now(deps: WorkerDeps): number {
  return deps.now ? deps.now() : Date.now();
}

function jobFailure(job: SyncJob, error: unknown): JobResult {
  const classified = classifyError(error);
  return {
    ok: false,
    error: safeErrorMessage(`${classified.code}: ${classified.message}`, 1000),
    retryInSeconds:
      classified.category === "permanent"
        ? null
        : retryDelaySeconds(job.attempts, JOB_RETRY_DELAYS_SECONDS),
  };
}

/** Auth gone: the integration needs a reconnect; nothing to retry until then. */
async function handleAuthRevoked(
  deps: WorkerDeps,
  integration: EmailIntegration,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : String(error);
  await deps.store.markProblem(
    integration.id,
    "expired",
    safeErrorMessage(
      `Google refused the connection: ${message}. Reconnect Gmail.`,
      500,
    ),
  );
  deps.logger.metric("oauth_refresh_failures", 1, {
    tenant_id: integration.tenantId,
    integration_id: integration.id,
  });
}

/** Process the mailbox's due events, oldest first, until none are left or time runs out. */
export async function processDueEvents(
  integration: EmailIntegration,
  deps: WorkerDeps,
): Promise<{
  processed: number;
  failed: number;
  ignored: number;
  authRevoked: boolean;
}> {
  const totals = { processed: 0, failed: 0, ignored: 0, authRevoked: false };
  const log = deps.logger.child({
    integration_id: integration.id,
    tenant_id: integration.tenantId,
  });

  while (now(deps) < deps.deadline) {
    const events = await deps.store.claimEvents(integration.id, EVENT_BATCH);
    if (events.length === 0) break;

    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];

      // Out of time or credentials: hand the rest back untouched.
      if (totals.authRevoked || now(deps) >= deps.deadline) {
        await deps.store.releaseEvent(event.id, totals.authRevoked ? 600 : 0);
        continue;
      }

      const started = now(deps);

      try {
        const email = await deps.provider.getMessage(
          integration,
          event.providerMessageId,
        );
        const outcome = await processIncomingEmail(email, integration, event, {
          ...deps.processor,
          provider: deps.provider,
          logger: deps.logger,
        });

        if (outcome.status === "ignored") totals.ignored += 1;
        else totals.processed += 1;
      } catch (error) {
        if (error instanceof MessageNotFoundError) {
          // Deleted (or moved out of reach) before we read it.
          await deps.store.ignoreEvent(event.id, "message_unavailable");
          totals.ignored += 1;
          continue;
        }

        if (error instanceof AuthRevokedError) {
          totals.authRevoked = true;
          await handleAuthRevoked(deps, integration, error);
          await deps.store.releaseEvent(event.id, 600);
          continue;
        }

        const classified = classifyError(error);
        const failedAttempts = event.retryCount + 1;
        const delay =
          classified.category === "permanent"
            ? null
            : retryDelaySeconds(failedAttempts, EVENT_RETRY_DELAYS_SECONDS);

        const status = await deps.store.failEvent(
          event.id,
          safeErrorMessage(`${classified.code}: ${classified.message}`, 2000),
          classified.category,
          delay,
        );

        totals.failed += 1;
        log.warn("email_processing_failed", {
          event_id: event.id,
          provider_message_id: event.providerMessageId,
          error_category: classified.category,
          error_code: classified.code,
          retry_count: failedAttempts,
          next_status: status,
          retry_in_seconds: delay,
          duration_ms: now(deps) - started,
        });
        deps.logger.metric("email_processing_failures", 1, {
          tenant_id: integration.tenantId,
          error_category: classified.category,
          final: status === "failed",
        });
      }
    }
  }

  return totals;
}

export async function runSyncJob(
  job: SyncJob,
  deps: WorkerDeps,
): Promise<JobResult> {
  const log = deps.logger.child({
    job_id: job.id,
    integration_id: job.integrationId,
    tenant_id: job.tenantId,
    job_kind: job.kind,
    job_reason: job.reason,
    attempt: job.attempts,
  });

  const integration = await deps.store.loadIntegration(job.integrationId);

  if (
    !integration ||
    integration.tenantId !== job.tenantId ||
    integration.status === "disconnected"
  ) {
    log.info("sync_skipped", { why: "integration_gone" });
    return { ok: true };
  }

  if (integration.status === "expired") {
    log.info("sync_skipped", { why: "credentials_expired" });
    return { ok: true };
  }

  if (!(await deps.store.acquireLease(integration.id, deps.workerId))) {
    // Another worker has this mailbox right now; come back shortly.
    log.info("sync_deferred", { why: "lease_held" });
    return {
      ok: false,
      error: "Mailbox is being synced by another worker",
      retryInSeconds: 15,
    };
  }

  const started = now(deps);

  try {
    let recorded = 0;

    if (!integration.providerHistoryId) {
      // Connected, but the watch never stored a cursor: start from now.
      const historyId = await deps.provider.getCurrentHistoryId(integration);
      await deps.store.advanceHistory(integration.id, historyId);
      log.info("sync_cursor_initialised", { history_id: historyId });
    } else {
      const changes = await deps.provider.listChanges(
        integration,
        integration.providerHistoryId,
      );

      if (integration.enabled) {
        recorded = await deps.store.recordEvents(
          integration,
          changes.messageIds,
        );
      }
      // Disabled: the cursor still moves, so re-enabling does not flood the
      // queue with everything that arrived meanwhile.
      await deps.store.advanceHistory(integration.id, changes.historyId);

      if (changes.cursorReset) {
        log.warn("sync_cursor_reset", {
          recovered_messages: changes.messageIds.length,
        });
      }

      deps.logger.metric("emails_received", recorded, {
        tenant_id: integration.tenantId,
      });
    }

    const totals = await processDueEvents(integration, deps);

    if (!totals.authRevoked && integration.status !== "connected") {
      await deps.store.markHealthy(integration.id);
    }

    log.info("sync_completed", {
      recorded,
      processed: totals.processed,
      ignored: totals.ignored,
      failed: totals.failed,
      duration_ms: now(deps) - started,
    });

    return { ok: true, recorded, ...totals };
  } catch (error) {
    if (error instanceof AuthRevokedError) {
      await handleAuthRevoked(deps, integration, error);
      log.warn("sync_auth_revoked");
      return { ok: true };
    }

    const failure = jobFailure(job, error);
    const classified = classifyError(error);

    // Visible on the channel page; the job retries on its own schedule. One
    // passing blip (a single 503) does not flip the channel to Error.
    if (classified.category === "permanent" || job.attempts >= 2) {
      await deps.store.markProblem(
        integration.id,
        "error",
        safeErrorMessage(`Sync failed: ${classified.message}`, 500),
      );
    }

    log.error("sync_failed", {
      error_category: classified.category,
      error_code: classified.code,
      retry_in_seconds: failure.ok ? null : failure.retryInSeconds,
      duration_ms: now(deps) - started,
    });

    return failure;
  } finally {
    await deps.store.releaseLease(integration.id, deps.workerId);
  }
}

export async function runWatchJob(
  job: SyncJob,
  deps: WorkerDeps,
): Promise<JobResult> {
  const log = deps.logger.child({
    job_id: job.id,
    integration_id: job.integrationId,
    tenant_id: job.tenantId,
    job_kind: job.kind,
    attempt: job.attempts,
  });

  const integration = await deps.store.loadIntegration(job.integrationId);

  if (
    !integration ||
    integration.tenantId !== job.tenantId ||
    integration.status === "disconnected" ||
    integration.status === "expired"
  ) {
    return { ok: true };
  }

  try {
    const watch = await deps.provider.watch(integration);

    await deps.store.saveWatch(integration.id, {
      expiration: watch.expiration,
      // Only a mailbox without a cursor takes the watch's: an existing cursor
      // is behind it, and jumping ahead would skip unsynced mail.
      historyId: integration.providerHistoryId ? null : watch.historyId,
    });

    log.info("watch_renewed", {
      watch_expiration: watch.expiration.toISOString(),
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthRevokedError) {
      await handleAuthRevoked(deps, integration, error);
      return { ok: true };
    }

    const failure = jobFailure(job, error);
    const classified = classifyError(error);

    await deps.store.markProblem(
      integration.id,
      "error",
      safeErrorMessage(
        `Gmail watch renewal failed: ${classified.message}`,
        500,
      ),
    );
    log.error("watch_renewal_failed", {
      error_category: classified.category,
      error_code: classified.code,
    });
    deps.logger.metric("watch_renewal_failures", 1, {
      tenant_id: integration.tenantId,
    });

    return failure;
  }
}
