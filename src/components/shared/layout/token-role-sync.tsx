"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseClient } from "@/lib/supabase/client";

const ATTEMPT_KEY = "token-role-sync";

/**
 * Database rules read the role in the login token, which can be up to an hour
 * old. When it no longer matches the person's live role, this gets a new token so
 * screens stop coming up empty. One try per role: if the refresh can't fix it, the
 * page must not keep reloading.
 */
export function TokenRoleSync({
  stale,
  role,
}: {
  stale: boolean;
  role: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!stale) return;

    try {
      if (sessionStorage.getItem(ATTEMPT_KEY) === role) return;
      sessionStorage.setItem(ATTEMPT_KEY, role);
    } catch {
      // No storage means no loop guard, so don't try at all.
      return;
    }

    createSupabaseClient()
      .auth.refreshSession()
      .then(({ error }) => {
        if (!error) router.refresh();
      })
      .catch(() => {
        // The old token keeps working until it expires.
      });
  }, [stale, role, router]);

  return null;
}
