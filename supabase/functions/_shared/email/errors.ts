// Categorised failures, and the retry schedule they drive.
//
//   temporary  rate limits, timeouts, 5xx, network, database blips:
//              retried with backoff, up to the event's max_retries
//   permanent  bad input, unusable integration, refused credentials:
//              failed at once (an admin can retry it by hand)

export type ErrorCategory = "temporary" | "permanent";

export type EmailErrorCode =
  | "rate_limited"
  | "provider_unavailable"
  | "timeout"
  | "network"
  | "database"
  | "auth_revoked"
  | "invalid_integration"
  | "invalid_email"
  | "message_not_found"
  | "history_expired"
  | "misconfigured"
  | "provider_error"
  | "unknown";

export class EmailIngestError extends Error {
  readonly category: ErrorCategory;
  readonly code: EmailErrorCode;

  constructor(
    message: string,
    options: { category: ErrorCategory; code: EmailErrorCode; cause?: unknown },
  ) {
    super(message);
    this.name = "EmailIngestError";
    this.category = options.category;
    this.code = options.code;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export class TemporaryEmailError extends EmailIngestError {
  constructor(
    message: string,
    code: EmailErrorCode = "unknown",
    cause?: unknown,
  ) {
    super(message, { category: "temporary", code, cause });
    this.name = "TemporaryEmailError";
  }
}

export class PermanentIngestError extends EmailIngestError {
  constructor(
    message: string,
    code: EmailErrorCode = "unknown",
    cause?: unknown,
  ) {
    super(message, { category: "permanent", code, cause });
    this.name = "PermanentIngestError";
  }
}

/**
 * The provider refused the refresh token (revoked, expired, password
 * change). Nothing works until a Tenant Admin reconnects: the integration is
 * marked expired and its jobs stop.
 */
export class AuthRevokedError extends PermanentIngestError {
  constructor(message: string, cause?: unknown) {
    super(message, "auth_revoked", cause);
    this.name = "AuthRevokedError";
  }
}

/** The message is gone (deleted, moved out of reach) before we read it. */
export class MessageNotFoundError extends PermanentIngestError {
  constructor(message: string) {
    super(message, "message_not_found");
    this.name = "MessageNotFoundError";
  }
}

/** The saved history cursor is older than the provider keeps. */
export class HistoryExpiredError extends PermanentIngestError {
  constructor(message: string) {
    super(message, "history_expired");
    this.name = "HistoryExpiredError";
  }
}

export interface ClassifiedError {
  category: ErrorCategory;
  code: EmailErrorCode;
  message: string;
}

/**
 * Anything thrown, as a category. Unknown errors count as temporary: they are
 * retried a bounded number of times, then fail visibly, which is safer than
 * dropping an email on a bug.
 */
export function classifyError(error: unknown): ClassifiedError {
  if (error instanceof EmailIngestError) {
    return {
      category: error.category,
      code: error.code,
      message: error.message,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";

  if (name === "AbortError" || name === "TimeoutError") {
    return { category: "temporary", code: "timeout", message };
  }

  if (
    error instanceof TypeError &&
    /fetch|network|socket|connect/i.test(message)
  ) {
    return { category: "temporary", code: "network", message };
  }

  return { category: "temporary", code: "unknown", message };
}

/** Per-email retries: 5 s, 30 s, 2 min, 10 min, then failed. */
export const EVENT_RETRY_DELAYS_SECONDS: readonly number[] = [5, 30, 120, 600];

/** Sync and watch jobs: the same curve, a little longer at the end. */
export const JOB_RETRY_DELAYS_SECONDS: readonly number[] = [
  5, 30, 120, 600, 1800,
];

/**
 * Delay before the next attempt, given how many attempts have already
 * failed (1 after the first failure), or null once the schedule is spent.
 */
export function retryDelaySeconds(
  failedAttempts: number,
  schedule: readonly number[] = EVENT_RETRY_DELAYS_SECONDS,
): number | null {
  if (!Number.isInteger(failedAttempts) || failedAttempts < 1) {
    return schedule[0] ?? null;
  }

  return failedAttempts <= schedule.length
    ? schedule[failedAttempts - 1]
    : null;
}

/** Error text safe to store and show: one line, bounded, no bearer tokens. */
export function safeErrorMessage(message: string, max = 500): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(
      /(access_token|refresh_token|id_token|code)=[^&\s"]+/gi,
      "$1=[redacted]",
    )
    .replace(/[\r\n]+/g, " ")
    .slice(0, max);
}
