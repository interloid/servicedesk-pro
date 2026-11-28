// Building the Google consent URL, with PKCE. Used by the Next.js connect
// route; the code exchange itself is exchangeAuthorizationCode in gmail-api.

import { GMAIL_READONLY_SCOPE, GOOGLE_AUTH_URL } from "./gmail-api.ts";

export const GMAIL_OAUTH_SCOPES: readonly string[] = [GMAIL_READONLY_SCOPE];

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** RFC 7636 verifier (43 chars) and its S256 challenge. */
export async function createPkcePair(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export function buildGoogleAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  loginHint?: string;
}): string {
  const url = new URL(GOOGLE_AUTH_URL);

  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_OAUTH_SCOPES.join(" "));
  // A refresh token, every time: the worker reads mail while nobody is
  // signed in, and a reconnect must replace a revoked grant.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (params.loginHint) url.searchParams.set("login_hint", params.loginHint);

  return url.toString();
}

/** True when Google granted the scope email-to-ticket cannot work without. */
export function hasRequiredScopes(granted: string | undefined): boolean {
  if (!granted) return false;
  const scopes = new Set(granted.split(/\s+/));
  return GMAIL_OAUTH_SCOPES.every((scope) => scopes.has(scope));
}
