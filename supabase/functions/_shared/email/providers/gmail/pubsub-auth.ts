// Authenticating Google Pub/Sub push requests, and reading their payload.
//
// The push subscription is configured with authentication: Pub/Sub then
// sends `Authorization: Bearer <OIDC token>` signed by Google for the
// subscription's service account. We verify, with no shared secret:
//   * the RS256 signature against Google's published keys,
//   * iss = accounts.google.com, aud = our configured audience,
//   * exp/iat within a small clock skew,
//   * email = the configured service account, email_verified = true.
// Anyone can POST to the URL; only Google, for our subscription, passes.

const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set([
  "accounts.google.com",
  "https://accounts.google.com",
]);
const CLOCK_SKEW_SECONDS = 300;
const DEFAULT_JWKS_TTL_MS = 60 * 60 * 1000;

export class PubSubAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PubSubAuthError";
  }
}

export interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  n: string;
  e: string;
  use?: string;
}

export interface PubSubAuthConfig {
  /** The audience set on the push subscription (defaults to the push URL there). */
  audience: string;
  /** The service account the subscription pushes as. */
  serviceAccountEmail: string;
  fetchJwks?: () => Promise<Jwk[]>;
  /** Seconds since the epoch. */
  now?: () => number;
}

let jwksCache: { keys: Jwk[]; expiresAt: number } | null = null;

async function fetchGoogleJwks(): Promise<Jwk[]> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) {
    return jwksCache.keys;
  }

  const response = await fetch(GOOGLE_CERTS_URL, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new PubSubAuthError(
      `Could not load Google signing keys (${response.status})`,
    );
  }

  const body = (await response.json()) as { keys?: Jwk[] };
  const maxAge = /max-age=(\d+)/.exec(
    response.headers.get("cache-control") ?? "",
  );
  jwksCache = {
    keys: body.keys ?? [],
    expiresAt:
      Date.now() + (maxAge ? Number(maxAge[1]) * 1000 : DEFAULT_JWKS_TTL_MS),
  };

  return jwksCache.keys;
}

/** For tests: forget the cached keys. */
export function resetJwksCache(): void {
  jwksCache = null;
}

function base64UrlDecode(segment: string): Uint8Array<ArrayBuffer> {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(
    normalized + "=".repeat((4 - (normalized.length % 4)) % 4),
  );
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson(segment: string): Record<string, unknown> {
  try {
    return JSON.parse(
      new TextDecoder().decode(base64UrlDecode(segment)),
    ) as Record<string, unknown>;
  } catch {
    throw new PubSubAuthError("Malformed token");
  }
}

export interface VerifiedPush {
  email: string;
  subject?: string;
}

export async function verifyPubSubPushToken(
  authorization: string | null | undefined,
  config: PubSubAuthConfig,
): Promise<VerifiedPush> {
  if (!config.audience || !config.serviceAccountEmail) {
    throw new PubSubAuthError("Push authentication is not configured");
  }

  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new PubSubAuthError("Missing bearer token");

  const parts = token.split(".");
  if (parts.length !== 3) throw new PubSubAuthError("Malformed token");

  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJson(headerPart);
  const payload = decodeJson(payloadPart);

  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new PubSubAuthError("Unexpected token algorithm");
  }

  const keys = await (config.fetchJwks ?? fetchGoogleJwks)();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new PubSubAuthError("Unknown signing key");

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlDecode(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );

  if (!valid) throw new PubSubAuthError("Bad signature");

  const now = config.now ? config.now() : Math.floor(Date.now() / 1000);

  if (typeof payload.iss !== "string" || !GOOGLE_ISSUERS.has(payload.iss)) {
    throw new PubSubAuthError("Wrong issuer");
  }

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(config.audience)) {
    throw new PubSubAuthError("Wrong audience");
  }

  if (
    typeof payload.exp !== "number" ||
    payload.exp + CLOCK_SKEW_SECONDS < now
  ) {
    throw new PubSubAuthError("Token expired");
  }

  if (
    typeof payload.iat === "number" &&
    payload.iat - CLOCK_SKEW_SECONDS > now
  ) {
    throw new PubSubAuthError("Token issued in the future");
  }

  if (
    typeof payload.email !== "string" ||
    payload.email.toLowerCase() !==
      config.serviceAccountEmail.trim().toLowerCase() ||
    payload.email_verified !== true
  ) {
    throw new PubSubAuthError("Wrong service account");
  }

  return {
    email: payload.email,
    subject: typeof payload.sub === "string" ? payload.sub : undefined,
  };
}

export interface GmailPushNotification {
  emailAddress: string;
  historyId: string;
  pubsubMessageId?: string;
  subscription?: string;
}

/**
 * The push body: {message: {data: base64({emailAddress, historyId}),
 * messageId}, subscription}. Null for anything else -- the caller still
 * acknowledges it, since Pub/Sub would otherwise redeliver junk forever.
 */
export function decodeGmailPush(body: unknown): GmailPushNotification | null {
  if (!body || typeof body !== "object") return null;

  const message = (
    body as {
      message?: { data?: unknown; messageId?: unknown; message_id?: unknown };
    }
  ).message;
  if (!message || typeof message.data !== "string") return null;

  let data: { emailAddress?: unknown; historyId?: unknown };
  try {
    data = JSON.parse(new TextDecoder().decode(base64UrlDecode(message.data)));
  } catch {
    return null;
  }

  const emailAddress =
    typeof data.emailAddress === "string"
      ? data.emailAddress.trim().toLowerCase()
      : "";
  const historyId =
    typeof data.historyId === "number" || typeof data.historyId === "string"
      ? String(data.historyId)
      : "";

  if (!emailAddress || !/^[0-9]{1,30}$/.test(historyId)) return null;

  const messageId = message.messageId ?? message.message_id;

  return {
    emailAddress,
    historyId,
    pubsubMessageId: typeof messageId === "string" ? messageId : undefined,
    subscription:
      typeof (body as { subscription?: unknown }).subscription === "string"
        ? (body as { subscription: string }).subscription
        : undefined,
  };
}
