/**
 * Support impersonation helpers safe for any runtime (the proxy included).
 * See src/lib/impersonation.ts and migration 20261117160000.
 */

/** Ends an impersonation: signs the browser out and restores the console. */
export const IMPERSONATION_END_PATH = "/auth/impersonation/end";

/** The claims of an access token, unverified. Callers verify through Auth. */
export function decodeAccessToken(
  accessToken: string | null | undefined,
): Record<string, unknown> | null {
  const payload = accessToken?.split(".")[1];

  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** The operator's email when the token belongs to an impersonation session. */
export function impersonatorOf(
  claims: Record<string, unknown> | null | undefined,
): string | null {
  const value = claims?.impersonated_by;

  return typeof value === "string" && value ? value : null;
}
