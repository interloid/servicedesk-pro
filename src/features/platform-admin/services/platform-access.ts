import "server-only";

import { notFound, redirect } from "next/navigation";

import { serverEnv } from "@/config/server-env";
import { APP_ROUTES } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function isPlatformAdminEmail(
  email: string | null | undefined,
): boolean {
  if (!email) {
    return false;
  }

  return (serverEnv.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .includes(email.toLowerCase());
}

/**
 * The console reads every workspace through the service-role client, so the
 * gate has to hold before any of it runs. Signed out goes to sign-in; signed in
 * but not on PLATFORM_ADMIN_EMAILS gets a 404, so the console's existence is
 * not advertised to tenant users.
 */
export async function requirePlatformAdmin(): Promise<{
  id: string;
  email: string;
  name: string;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(APP_ROUTES.LOGIN);
  }

  const email = user.email?.toLowerCase() ?? "";

  // Verified, or anyone signing up with a listed address would get in.
  if (!user.email_confirmed_at || !isPlatformAdminEmail(email)) {
    notFound();
  }

  const fullName = user.user_metadata?.full_name;

  return {
    id: user.id,
    email,
    name: typeof fullName === "string" && fullName ? fullName : email,
  };
}
