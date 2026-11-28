import "server-only";

// The Gmail OAuth `state`: CSRF protection for the callback.
//
// state  = base64url(payload) "." base64url(HMAC-SHA256(payload))
// cookie = the same nonce + the PKCE verifier, httpOnly, 10 minutes
//
// The callback accepts a code only when the state's signature verifies, it
// has not expired, its nonce matches the cookie this browser was given when
// the flow started, and the signed-in user is the one who started it and is
// still the workspace's Tenant Admin. An attacker cannot plant their own
// Google grant in an admin's session: they cannot mint a state for that
// admin, and cannot set the admin's cookie.
//
// The HMAC key is derived from EMAIL_ENCRYPTION_KEY (HKDF, its own label),
// so no extra secret is needed and the token key is never used directly.

import { parseEncryptionKey } from "../../../../supabase/functions/_shared/email/token-crypto.ts";

export const OAUTH_COOKIE = "sd_gmail_oauth";
export const OAUTH_TTL_SECONDS = 10 * 60;

export interface OAuthStatePayload {
  /** Tenant id. */
  t: string;
  /** User id. */
  u: string;
  /** Tenant slug, for the redirect back. */
  s: string;
  /** Nonce, also in the cookie. */
  n: string;
  /** Expiry, epoch ms. */
  e: number;
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

async function hmacKey(rawKey: string | undefined): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    parseEncryptionKey(rawKey),
    "HKDF",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("servicedesk"),
      info: new TextEncoder().encode("gmail-oauth-state-v1"),
    },
    base,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign", "verify"],
  );
}

export function newNonce(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(24)));
}

export async function signState(
  payload: OAuthStatePayload,
  rawKey: string | undefined,
): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(rawKey),
    new TextEncoder().encode(body),
  );
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/** The payload, or null for anything forged, malformed or expired. */
export async function verifyState(
  state: string | null | undefined,
  rawKey: string | undefined,
  now = Date.now(),
): Promise<OAuthStatePayload | null> {
  if (!state || state.length > 2048) return null;

  const [body, signature, extra] = state.split(".");
  if (!body || !signature || extra !== undefined) return null;

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(rawKey),
      Buffer.from(signature, "base64url"),
      new TextEncoder().encode(body),
    );
  } catch {
    return null;
  }

  if (!valid) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as OAuthStatePayload;

    if (
      typeof payload.t !== "string" ||
      typeof payload.u !== "string" ||
      typeof payload.s !== "string" ||
      typeof payload.n !== "string" ||
      typeof payload.e !== "number" ||
      payload.e < now
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/** What the cookie holds: the nonce to match and the PKCE verifier. */
export interface OAuthCookie {
  n: string;
  v: string;
}

export function encodeOAuthCookie(value: OAuthCookie): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeOAuthCookie(raw: string | undefined): OAuthCookie | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as OAuthCookie;
    return typeof value.n === "string" && typeof value.v === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}

/** Constant-time string comparison for the nonce. */
export function sameNonce(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}
