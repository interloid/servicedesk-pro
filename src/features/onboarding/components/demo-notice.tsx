import { Info } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { env } from "@/config/env";

/** Same time as the schedule in .github/workflows/demo-reset.yml. */
export const DEMO_RESET_TIME = "02:00 UTC";

export function isDemoMode(): boolean {
  return env.NEXT_PUBLIC_DEMO_MODE === "true";
}

/**
 * Tells visitors to the public demo that what they create won't last. Only
 * shown where NEXT_PUBLIC_DEMO_MODE is "true", which is the environment the
 * nightly reset runs against.
 */
export function DemoNotice() {
  if (!isDemoMode()) {
    return null;
  }

  return (
    <Alert role="note" className="mx-auto w-full max-w-xl">
      <Info aria-hidden />
      <AlertDescription>
        This is a demo. Workspaces you create are deleted nightly at{" "}
        {DEMO_RESET_TIME}.
      </AlertDescription>
    </Alert>
  );
}
