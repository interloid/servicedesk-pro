import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/config/env";
import {
  OPEN_SUPPORT_STATUSES,
  supportNumber,
} from "@/features/support/support";
import {
  decodeAccessToken,
  impersonatorOf,
  saveReturnSession,
  takeReturnSession,
} from "@/lib/impersonation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tenantPath } from "@/lib/tenancy";

/**
 * Support impersonation (migration 20261117160000).
 *
 * A platform admin signs in as the Tenant Admin who granted workspace access on
 * a support request, with that admin's full access, while the grant lasts. The
 * browser then holds a real Auth session for that admin; the database tags it
 * (impersonated_by claim), pins it to the granting workspace, records every
 * change as platform support, and locks it out once the grant ends.
 */

type PlatformActor = { id: string; email: string; name: string };

export class ImpersonationError extends Error {}

export type ImpersonationTarget = {
  userId: string;
  name: string;
  email: string;
};

/** A client that holds a session in memory only: never this browser's. */
function detachedAuthClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function recordAudit(
  tenantId: string,
  requestId: string,
  summary: string,
  meta: Record<string, string>,
): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("audit_logs")
    .insert({
      tenant_id: tenantId,
      actor_id: null,
      action: "support_access",
      entity: "support_request",
      entity_id: requestId,
      module: "platform",
      meta_json: { summary, ...meta },
    });

  if (error) {
    throw new Error(`[impersonation] audit failed: ${error.message}`);
  }
}

/**
 * Who support may sign in as on this request: the admin who granted access,
 * while the grant is live and they are still an active Tenant Admin. Null
 * otherwise -- the reason is not shown; the console just offers no button.
 */
export async function impersonationTarget(
  requestId: string,
): Promise<
  | (ImpersonationTarget & { tenantId: string; slug: string; number: string })
  | null
> {
  const db = createSupabaseAdminClient();
  const { data: request, error } = await db
    .from("support_requests")
    .select(
      "id, number, tenant_id, status, allow_workspace_access, access_expires_at, access_granted_by, created_by",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw new Error(`[impersonation] request read failed: ${error.message}`);
  }

  if (
    !request ||
    !request.allow_workspace_access ||
    !request.access_expires_at ||
    Date.parse(request.access_expires_at) <= Date.now() ||
    !(OPEN_SUPPORT_STATUSES as readonly string[]).includes(request.status)
  ) {
    return null;
  }

  const userId = request.access_granted_by ?? request.created_by;

  if (!userId) return null;

  const [{ data: membership }, { data: tenant }, { data: user }] =
    await Promise.all([
      db
        .from("memberships")
        .select("role, status")
        .eq("tenant_id", request.tenant_id)
        .eq("user_id", userId)
        .maybeSingle(),
      db
        .from("tenants")
        .select("slug, status, deleted_at")
        .eq("id", request.tenant_id)
        .maybeSingle(),
      db
        .from("users")
        .select("email, full_name")
        .eq("id", userId)
        .maybeSingle(),
    ]);

  if (
    membership?.role !== "tenant_admin" ||
    membership.status !== "active" ||
    !tenant ||
    tenant.deleted_at ||
    tenant.status !== "active" ||
    !user?.email
  ) {
    return null;
  }

  return {
    userId,
    name: user.full_name || user.email,
    email: user.email,
    tenantId: request.tenant_id,
    slug: tenant.slug,
    number: supportNumber(request.number),
  };
}

/**
 * Signs this browser in as the granting admin and returns where to go. The
 * operator's console session is kept, encrypted, for endImpersonation.
 */
export async function startImpersonation(
  admin: PlatformActor,
  requestId: string,
): Promise<string> {
  const target = await impersonationTarget(requestId);

  if (!target) {
    throw new ImpersonationError(
      "Access to this workspace isn't granted any more, or the admin who granted it can't be signed in as.",
    );
  }

  const server = await createSupabaseServerClient();
  const {
    data: { session: own },
  } = await server.auth.getSession();

  if (!own?.refresh_token) {
    throw new ImpersonationError("Sign in again, then try once more.");
  }

  const db = createSupabaseAdminClient();

  // A one-time sign-in for the admin, verified here: no email is sent.
  const { data: link, error: linkError } = await db.auth.admin.generateLink({
    type: "magiclink",
    email: target.email,
  });

  if (linkError || !link.properties?.hashed_token) {
    throw new Error(
      `[impersonation] sign-in link failed: ${linkError?.message ?? "no token"}`,
    );
  }

  const auth = detachedAuthClient();
  const { data: verified, error: verifyError } = await auth.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  const sessionId = decodeAccessToken(
    verified?.session?.access_token,
  )?.session_id;

  if (verifyError || !verified.session || typeof sessionId !== "string") {
    throw new Error(
      `[impersonation] sign-in failed: ${verifyError?.message ?? "no session"}`,
    );
  }

  const { data: requestRow } = await db
    .from("support_requests")
    .select("access_expires_at")
    .eq("id", requestId)
    .single();

  const { error: insertError } = await db
    .from("impersonation_sessions")
    .insert({
      auth_session_id: sessionId,
      request_id: requestId,
      tenant_id: target.tenantId,
      target_user_id: target.userId,
      platform_admin_id: admin.id,
      platform_admin_email: admin.email,
      expires_at: requestRow?.access_expires_at ?? new Date().toISOString(),
    });

  if (insertError) {
    await db.rpc("end_impersonation_session", {
      p_auth_session_id: sessionId,
      p_reason: "start failed",
    });
    throw new Error(`[impersonation] record failed: ${insertError.message}`);
  }

  // Re-issue the token now that the session is recorded, so it carries the
  // impersonated_by claim and is pinned to this workspace.
  const { data: tagged, error: refreshError } = await auth.auth.refreshSession({
    refresh_token: verified.session.refresh_token,
  });

  if (
    refreshError ||
    !tagged.session ||
    impersonatorOf(decodeAccessToken(tagged.session.access_token)) !==
      admin.email
  ) {
    await db.rpc("end_impersonation_session", {
      p_auth_session_id: sessionId,
      p_reason: "start failed",
    });
    throw new Error(
      `[impersonation] tagging failed: ${refreshError?.message ?? "no claim"}`,
    );
  }

  await recordAudit(
    target.tenantId,
    requestId,
    `Platform support (${admin.email}) signed in as ${target.name} on ${target.number}`,
    {
      platform_admin_email: admin.email,
      impersonated_user: target.email,
      request_number: target.number,
    },
  );

  await saveReturnSession(own.refresh_token);

  const { error: setError } = await server.auth.setSession({
    access_token: tagged.session.access_token,
    refresh_token: tagged.session.refresh_token,
  });

  if (setError) {
    await db.rpc("end_impersonation_session", {
      p_auth_session_id: sessionId,
      p_reason: "start failed",
    });
    throw new Error(`[impersonation] session swap failed: ${setError.message}`);
  }

  return tenantPath(target.slug, "/tickets");
}

/**
 * Ends this browser's impersonation and restores the operator's console
 * session. Returns where to send the browser.
 *
 * Never touches an ordinary session, so a stray visit can't sign anyone out.
 * With no session at all (the grant was withdrawn: its Auth session is already
 * deleted and the proxy cleared the cookies), it only restores the console
 * session saved when the impersonation started, if there is one.
 */
export async function endImpersonation(reason: string): Promise<string> {
  const server = await createSupabaseServerClient();
  const {
    data: { session },
  } = await server.auth.getSession();
  const claims = decodeAccessToken(session?.access_token);
  const operator = impersonatorOf(claims);
  const sessionId = claims?.session_id;

  if (session && (!operator || typeof sessionId !== "string")) {
    return "/";
  }

  if (!session || !operator || typeof sessionId !== "string") {
    return restoreConsole();
  }

  const db = createSupabaseAdminClient();
  const { data: row } = await db
    .from("impersonation_sessions")
    .select("tenant_id, request_id, ended_at, end_reason")
    .eq("auth_session_id", sessionId)
    .maybeSingle();

  // Only a session this table knows can be ended (and the token's claim was
  // checked by the database when it was issued).
  if (row) {
    await db.rpc("end_impersonation_session", {
      p_auth_session_id: sessionId,
      p_reason: reason,
    });

    await recordAudit(
      row.tenant_id,
      row.request_id,
      `Platform support (${operator}) signed out (${row.end_reason ?? reason})`,
      { platform_admin_email: operator },
    ).catch((error) => console.error(error));
  }

  // The Auth session is gone already; this clears the browser's cookies.
  await server.auth.signOut({ scope: "local" }).catch(() => undefined);

  return restoreConsole();
}

/** Signs the operator back in from the session saved at the start. */
async function restoreConsole(): Promise<string> {
  const server = await createSupabaseServerClient();
  const refreshToken = await takeReturnSession();

  if (refreshToken) {
    const { error } = await server.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (!error) return "/platform/tenants";
  }

  return "/login";
}
