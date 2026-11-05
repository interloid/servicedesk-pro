"use client";

import Link from "next/link";
import { Menu, LifeBuoy } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function PlatformHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-15 shrink-0 items-center gap-2.5 border-b bg-background/95 px-4 backdrop-blur md:px-6 lg:px-8">
      <SidebarTrigger
        icon={<Menu />}
        className="size-9 shrink-0 border border-border bg-card text-muted-foreground hover:bg-muted lg:hidden"
      />

      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-bold text-foreground">
          Platform Admin
        </span>
        <span className="hidden truncate text-xs text-muted-foreground sm:block">
          Global console for all workspaces
        </span>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <Link
          href="/"
          aria-label="Back to site"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <LifeBuoy className="size-4 text-muted-foreground" aria-hidden />
          <span className="hidden md:inline">Back to site</span>
        </Link>
      </div>
    </header>
  );
}
