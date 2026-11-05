"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { createSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Signing out goes straight to Supabase: the usual server action posts to this
 * address, which the proxy answers with a 503 while the workspace is blocked.
 */
export function BlockedActions({
  billingHref,
}: {
  billingHref: string | null;
}) {
  const [isPending, setIsPending] = useState(false);

  async function signOut() {
    setIsPending(true);
    await createSupabaseClient().auth.signOut();
    // A full load on purpose: the session is gone, so nothing here may be kept.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {billingHref && (
        <a
          href={billingHref}
          className={cn(buttonVariants(), "h-11 w-full font-semibold")}
        >
          Fix billing
        </a>
      )}
      <Button
        variant="outline"
        className="h-11 w-full font-semibold"
        disabled={isPending}
        onClick={signOut}
      >
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Sign out
      </Button>
    </div>
  );
}
