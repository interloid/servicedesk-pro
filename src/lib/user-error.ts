/**
 * The text a Server Action may hand the browser for a caught error.
 *
 * Our services throw plain `Error`s whose message is written for people
 * ("Ticket not found.", "Support is closed right now."). Errors from libraries
 * are subclasses -- `TypeError: fetch failed`, Supabase's `AuthError`,
 * `FunctionsHttpError`, `PostgrestError` -- and carry text meant for
 * developers, sometimes naming columns, functions or providers. Those are
 * logged here and replaced with `fallback`.
 */
export function userErrorMessage(error: unknown, fallback: string): string {
  if (
    error instanceof Error &&
    Object.getPrototypeOf(error) === Error.prototype
  ) {
    return error.message || fallback;
  }

  console.error("[action] unexpected error:", error);
  return fallback;
}
