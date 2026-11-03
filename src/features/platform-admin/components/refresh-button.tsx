"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { PLATFORM_BUTTON } from "./platform-ui";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      className={cn(PLATFORM_BUTTON, "w-full gap-1.5 sm:w-auto")}
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw
        className={cn("size-4", isPending && "animate-spin")}
        aria-hidden
      />
      Refresh
    </Button>
  );
}
