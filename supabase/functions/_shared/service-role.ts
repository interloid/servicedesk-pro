/**
 * True when the request carries the service role: either the service role key
 * itself, or a JWT whose role claim is service_role.
 *
 * Scheduled functions run with verify_jwt = true, which proves only that a token
 * is genuine. Any signed-in user's token passes that, so every function that
 * pg_cron calls must also check the role here before doing any work.
 */
export function isServiceRole(
  req: Request,
  serviceRoleKey: string | undefined,
): boolean {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return false;
  }

  if (serviceRoleKey && token === serviceRoleKey) {
    return true;
  }

  // The gateway has already verified the signature; read the role claim.
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}
