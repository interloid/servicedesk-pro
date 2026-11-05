"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[platform] page error:", error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-lg font-bold text-foreground">
        Something went wrong in the platform console
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        The platform data could not be loaded. Try again, and if it keeps
        failing check the server logs.
      </p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
