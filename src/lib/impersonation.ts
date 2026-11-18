import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { cookies } from "next/headers";

import { serverEnv } from "@/config/server-env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AUTH_COOKIE_SCOPE } from "@/lib/supabase/remember";

/**
 * Support impersonation: platform support signed in as a workspace's Tenant
 * Admin (migration 20261117160000). While it lasts the browser holds that
 * admin's session; the operator's own console session waits, encrypted, in an
 * httpOnly cookie and is restored when the impersonation ends.
 */

import { impersonatorOf } from "./impersonation-shared";

export {
  decodeAccessToken,
  IMPERSONATION_END_PATH,
  impersonatorOf,
} from "./impersonation-shared";

export const IMPERSONATION_RETURN_COOKIE = "sdp_support_return";

/** Long enough for any grant (72 hours); the session itself ends sooner. */
const RETURN_COOKIE_MAX_AGE = 72 * 60 * 60;

/** Derived, never stored: only a server with the service role key can read it. */
function key(): Buffer {
  return createHash("sha256")
    .update(`impersonation-return:${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`)
    .digest();
}

function seal(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);

  return [iv, cipher.getAuthTag(), body]
    .map((part) => part.toString("base64url"))
    .join(".");
}

function unseal(sealed: string): string | null {
  try {
    const [iv, tag, body] = sealed
      .split(".")
      .map((part) => Buffer.from(part, "base64url"));

    if (!iv || !tag || !body) return null;

    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(body), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}

/** Keeps the operator's console refresh token for when the impersonation ends. */
export async function saveReturnSession(refreshToken: string): Promise<void> {
  (await cookies()).set(IMPERSONATION_RETURN_COOKIE, seal(refreshToken), {
    ...AUTH_COOKIE_SCOPE,
    httpOnly: true,
    maxAge: RETURN_COOKIE_MAX_AGE,
  });
}

/** Reads and removes the saved console session. */
export async function takeReturnSession(): Promise<string | null> {
  const store = await cookies();
  const sealed = store.get(IMPERSONATION_RETURN_COOKIE)?.value;

  store.set(IMPERSONATION_RETURN_COOKIE, "", {
    ...AUTH_COOKIE_SCOPE,
    httpOnly: true,
    maxAge: 0,
  });

  return sealed ? unseal(sealed) : null;
}

/** Shown when support tries to change the account it is signed in as. */
export const IMPERSONATION_ACCOUNT_LOCKED =
  "Platform support can't change this account's password or email.";

/**
 * Whether this request's session is platform support signed in as the user.
 * Read from the verified token. Password and email changes are refused while
 * it is: they would keep support in the account after the grant ends.
 */
export async function isImpersonating(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();

  return (
    impersonatorOf(data?.claims as Record<string, unknown> | undefined) !== null
  );
}
