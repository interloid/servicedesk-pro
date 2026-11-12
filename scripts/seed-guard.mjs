/**
 * Password rules for scripts/seed-tenants.mjs, kept free of side effects so
 * they can be tested.
 *
 * The default password is in this repository, so it is only allowed on a local
 * stack. Seeding any other project needs a SEED_PASSWORD that nobody reading
 * the code can guess.
 */

/** Committed on purpose: only ever used against a local Supabase stack. */
export const DEFAULT_SEED_PASSWORD = "test@123";

export const MIN_HOSTED_PASSWORD_LENGTH = 12;

/**
 * True unless the URL is clearly a local stack (the Supabase CLI serves on
 * 127.0.0.1). Anything unparseable counts as hosted, so the check fails closed.
 */
export function isHostedSupabaseUrl(url) {
  if (typeof url !== "string" || !URL.canParse(url)) return true;
  const host = new URL(url).hostname.toLowerCase();
  const local =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".local");
  return !local;
}

/** Empty or whitespace-only counts as not set. */
function present(value) {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/**
 * Why `password` can't protect accounts on a hosted project, or null when it
 * can. Messages never include the password itself.
 */
export function hostedPasswordProblem(password, name = "SEED_PASSWORD") {
  if (!present(password)) {
    return `${name} is not set.`;
  }
  if (password === DEFAULT_SEED_PASSWORD) {
    return `${name} is the default committed in this repository.`;
  }
  if (password.length < MIN_HOSTED_PASSWORD_LENGTH) {
    return `${name} is shorter than ${MIN_HOSTED_PASSWORD_LENGTH} characters.`;
  }
  if (new Set(password).size < 4) {
    return `${name} repeats too few distinct characters.`;
  }
  return null;
}

/**
 * Decides the passwords for a --apply run.
 *
 *   env           SEED_PASSWORD and PLATFORM_ADMIN_PASSWORD
 *   hosted        from isHostedSupabaseUrl
 *   adminExists   whether the platform admin account is already there
 *
 * Returns { seedPassword, adminPassword, usingDefault, errors }. adminPassword
 * is undefined when the admin should get a random one (local only). Nothing
 * may be written while errors is non-empty.
 */
export function resolveSeedPasswords(env, { hosted, adminExists }) {
  const errors = [];
  const seed = present(env.SEED_PASSWORD);
  const admin = present(env.PLATFORM_ADMIN_PASSWORD);

  if (hosted) {
    const problem = hostedPasswordProblem(seed);
    if (problem) errors.push(problem);

    if (!adminExists) {
      const adminProblem = hostedPasswordProblem(
        admin,
        "PLATFORM_ADMIN_PASSWORD",
      );
      if (adminProblem) errors.push(adminProblem);
    }
  }

  // Demo viewers are given the seed password; the console must not share it.
  if (admin && admin === (seed ?? DEFAULT_SEED_PASSWORD)) {
    errors.push("PLATFORM_ADMIN_PASSWORD must differ from SEED_PASSWORD.");
  }

  return {
    seedPassword: seed ?? DEFAULT_SEED_PASSWORD,
    adminPassword: admin,
    usingDefault: !seed,
    errors,
  };
}
