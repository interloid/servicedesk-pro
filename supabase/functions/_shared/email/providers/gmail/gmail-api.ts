// Thin, typed wrappers over the Google OAuth and Gmail REST endpoints, with
// errors mapped onto the pipeline's categories. Plain fetch, so the Next.js
// OAuth routes and the Edge worker share it. Nothing here logs; request
// bodies (codes, tokens) never appear in an error message.

import {
  AuthRevokedError,
  HistoryExpiredError,
  MessageNotFoundError,
  PermanentIngestError,
  TemporaryEmailError,
  safeErrorMessage,
} from "../../errors.ts";
import type { TokenResult } from "../../types.ts";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

/**
 * The one scope email-to-ticket needs: read messages and attachments, read
 * history, and register the watch. It cannot send, delete or change mail.
 */
export const GMAIL_READONLY_SCOPE =
  "https://www.googleapis.com/auth/gmail.readonly";

const TIMEOUT_MS = 15_000;

const RATE_LIMIT_REASONS = new Set([
  "rateLimitExceeded",
  "userRateLimitExceeded",
  "dailyLimitExceeded",
  "quotaExceeded",
  "backendError",
  "RESOURCE_EXHAUSTED",
]);

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface GoogleClientConfig {
  clientId: string;
  clientSecret: string;
}

async function request(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  what: string,
): Promise<Response> {
  try {
    return await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    throw new TemporaryEmailError(
      `${what}: no response from Google (${safeErrorMessage(error instanceof Error ? error.message : String(error), 200)})`,
      name === "TimeoutError" || name === "AbortError" ? "timeout" : "network",
      error,
    );
  }
}

async function readJson(
  response: Response,
): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Google's token endpoint error -> category. */
async function tokenError(response: Response, what: string): Promise<Error> {
  const body = await readJson(response);
  const code = typeof body?.error === "string" ? body.error : "no error code";
  const description =
    typeof body?.error_description === "string"
      ? `: ${body.error_description.slice(0, 200)}`
      : "";
  const message = `${what} failed (${response.status} ${code})${description}`;

  // invalid_grant: revoked, expired (7 days on a Testing consent screen),
  // password changed. The mailbox has to be reconnected.
  if (code === "invalid_grant") {
    return new AuthRevokedError(message);
  }

  if (response.status === 429 || response.status >= 500) {
    return new TemporaryEmailError(
      message,
      response.status === 429 ? "rate_limited" : "provider_unavailable",
    );
  }

  // invalid_client, unauthorized_client, redirect_uri_mismatch: our config.
  return new PermanentIngestError(message, "misconfigured");
}

function toTokenResult(
  body: Record<string, unknown>,
  now: number,
): TokenResult {
  if (typeof body.access_token !== "string") {
    throw new TemporaryEmailError(
      "Google returned no access token",
      "provider_error",
    );
  }

  const expiresIn = Number(body.expires_in) || 3600;

  return {
    accessToken: body.access_token,
    expiresAt: new Date(now + expiresIn * 1000),
    refreshToken:
      typeof body.refresh_token === "string" ? body.refresh_token : undefined,
    scope: typeof body.scope === "string" ? body.scope : undefined,
  };
}

export async function exchangeAuthorizationCode(
  params: GoogleClientConfig & {
    code: string;
    redirectUri: string;
    codeVerifier: string;
  },
  fetchImpl: FetchLike = fetch,
): Promise<TokenResult> {
  const response = await request(
    fetchImpl,
    GOOGLE_TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        code: params.code,
        code_verifier: params.codeVerifier,
        redirect_uri: params.redirectUri,
        grant_type: "authorization_code",
      }),
    },
    "Google code exchange",
  );

  if (!response.ok) throw await tokenError(response, "Google code exchange");

  return toTokenResult((await readJson(response)) ?? {}, Date.now());
}

export async function refreshAccessToken(
  params: GoogleClientConfig & { refreshToken: string },
  fetchImpl: FetchLike = fetch,
): Promise<TokenResult> {
  const response = await request(
    fetchImpl,
    GOOGLE_TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        refresh_token: params.refreshToken,
        grant_type: "refresh_token",
      }),
    },
    "Google token refresh",
  );

  if (!response.ok) throw await tokenError(response, "Google token refresh");

  const result = toTokenResult((await readJson(response)) ?? {}, Date.now());

  if (result.scope && !result.scope.split(" ").includes(GMAIL_READONLY_SCOPE)) {
    throw new AuthRevokedError(
      "The Gmail read permission was removed from this connection.",
    );
  }

  return result;
}

/** Best effort: a token Google no longer knows is already as good as revoked. */
export async function revokeToken(
  token: string,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  try {
    const response = await request(
      fetchImpl,
      GOOGLE_REVOKE_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      },
      "Google token revoke",
    );
    await response.body?.cancel();
    return response.ok || response.status === 400;
  } catch {
    return false;
  }
}

/** Gmail API error -> category. */
async function gmailError(response: Response, what: string): Promise<Error> {
  const body = await readJson(response);
  const error = (body?.error ?? {}) as {
    message?: unknown;
    status?: unknown;
    errors?: { reason?: unknown }[];
  };
  const reason = String(error.errors?.[0]?.reason ?? error.status ?? "");
  const message = `${what}: Gmail API ${response.status}${reason ? ` ${reason}` : ""}: ${safeErrorMessage(
    String(error.message ?? "no message"),
    300,
  )}`;

  if (
    response.status === 429 ||
    response.status >= 500 ||
    (response.status === 403 && RATE_LIMIT_REASONS.has(reason))
  ) {
    return new TemporaryEmailError(
      message,
      response.status === 429 || response.status === 403
        ? "rate_limited"
        : "provider_unavailable",
    );
  }

  if (response.status === 401) {
    return new AuthRevokedError(message);
  }

  if (response.status === 404) {
    return new MessageNotFoundError(message);
  }

  // 403 without a rate-limit reason: Gmail API disabled for the project,
  // insufficient scope, mailbox suspended. 400: our request.
  return new PermanentIngestError(
    message,
    response.status === 403 ? "invalid_integration" : "provider_error",
  );
}

export class GmailApi {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  private async get<T>(
    accessToken: string,
    path: string,
    what: string,
  ): Promise<T> {
    const response = await request(
      this.fetchImpl,
      `${GMAIL_API}${path}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      what,
    );

    if (!response.ok) throw await gmailError(response, what);
    return (await response.json()) as T;
  }

  private async post<T>(
    accessToken: string,
    path: string,
    body: unknown,
    what: string,
  ): Promise<T> {
    const response = await request(
      this.fetchImpl,
      `${GMAIL_API}${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body ?? {}),
      },
      what,
    );

    if (!response.ok) throw await gmailError(response, what);
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  getProfile(accessToken: string): Promise<GmailProfile> {
    return this.get(accessToken, "/profile", "Gmail profile");
  }

  watch(
    accessToken: string,
    topicName: string,
    labelIds: string[] = ["INBOX"],
  ): Promise<GmailWatchResponse> {
    return this.post(
      accessToken,
      "/watch",
      { topicName, labelIds, labelFilterBehavior: "INCLUDE" },
      "Gmail watch",
    );
  }

  stop(accessToken: string): Promise<unknown> {
    return this.post(accessToken, "/stop", {}, "Gmail stop");
  }

  /** One page of history. A 404 means the start id has aged out. */
  async listHistory(
    accessToken: string,
    params: { startHistoryId: string; pageToken?: string; labelId?: string },
  ): Promise<GmailHistoryResponse> {
    const query = new URLSearchParams({
      startHistoryId: params.startHistoryId,
      historyTypes: "messageAdded",
      maxResults: "500",
    });
    if (params.labelId) query.set("labelId", params.labelId);
    if (params.pageToken) query.set("pageToken", params.pageToken);

    try {
      return await this.get(accessToken, `/history?${query}`, "Gmail history");
    } catch (error) {
      if (error instanceof MessageNotFoundError) {
        throw new HistoryExpiredError(error.message);
      }
      throw error;
    }
  }

  listMessages(
    accessToken: string,
    params: {
      q?: string;
      labelIds?: string[];
      maxResults?: number;
      pageToken?: string;
    },
  ): Promise<GmailMessageList> {
    const query = new URLSearchParams({
      maxResults: String(params.maxResults ?? 100),
    });
    if (params.q) query.set("q", params.q);
    for (const label of params.labelIds ?? []) query.append("labelIds", label);
    if (params.pageToken) query.set("pageToken", params.pageToken);
    return this.get(accessToken, `/messages?${query}`, "Gmail message list");
  }

  getMessage(accessToken: string, id: string): Promise<GmailMessage> {
    return this.get(
      accessToken,
      `/messages/${encodeURIComponent(id)}?format=full`,
      "Gmail message",
    );
  }

  getAttachment(
    accessToken: string,
    messageId: string,
    attachmentId: string,
  ): Promise<GmailAttachmentBody> {
    return this.get(
      accessToken,
      `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
      "Gmail attachment",
    );
  }
}

// --- Gmail response shapes (only what the adapter reads) -----------------------

export interface GmailProfile {
  emailAddress: string;
  historyId: string;
  messagesTotal?: number;
}

export interface GmailWatchResponse {
  historyId: string;
  /** Epoch milliseconds, as a string. */
  expiration: string;
}

export interface GmailHistoryResponse {
  history?: {
    id: string;
    messagesAdded?: {
      message: { id: string; threadId?: string; labelIds?: string[] };
    }[];
  }[];
  nextPageToken?: string;
  historyId: string;
}

export interface GmailMessageList {
  messages?: { id: string; threadId?: string }[];
  nextPageToken?: string;
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  sizeEstimate?: number;
  payload?: GmailMessagePart;
}

export interface GmailAttachmentBody {
  size?: number;
  data?: string;
}
