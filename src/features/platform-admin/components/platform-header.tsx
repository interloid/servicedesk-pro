"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu, Settings } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useLogout } from "@/features/auth/hooks/use-auth";

import { initialsOf, PLATFORM_NAV } from "./platform-sidebar";

const NAV_ITEMS = PLATFORM_NAV.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label })),
);

// The nav item whose section holds this path: the overview only on an exact
// match, anything else for its own page and the pages below it.
function currentPage(pathname: string) {
  return NAV_ITEMS.find(
    (item) =>
      pathname === item.href ||
      (item.href !== "/platform" && pathname.startsWith(`${item.href}/`)),
  );
}

function PlatformProfileMenu({
  adminName,
  adminEmail,
}: {
  adminName: string;
  adminEmail: string;
}) {
  const { logout, isPending } = useLogout({ redirectTo: "/login" });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-11 items-center gap-2 rounded-lg px-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-foreground text-xs font-bold text-background">
              {initialsOf(adminName)}
            </AvatarFallback>
          </Avatar>

          <div className="hidden min-w-0 flex-col items-start sm:flex">
            <span className="max-w-40 truncate text-sm font-semibold text-foreground lg:max-w-48">
              {adminName}
            </span>
            <span className="max-w-40 truncate text-xs text-muted-foreground lg:max-w-48">
              Platform Admin
            </span>
          </div>

          <ChevronDown
            className="hidden size-4 text-muted-foreground sm:block"
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={13}
        className="w-72 rounded-xl p-0"
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5 border-b px-3.5 py-3 font-normal">
          <span className="truncate text-sm font-semibold text-foreground">
            {adminName}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {adminEmail}
          </span>
        </DropdownMenuLabel>

        <div className="p-1.5">
          <DropdownMenuItem
            asChild
            className="h-9 cursor-pointer gap-2 px-3 text-sm font-medium"
          >
            <Link href="/platform/settings">
              <Settings className="size-4" aria-hidden />
              Platform settings
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            variant="destructive"
            className="h-9 cursor-pointer gap-2 px-3 text-sm font-medium"
            disabled={isPending}
            onSelect={(event) => {
              event.preventDefault();
              void logout();
            }}
          >
            <LogOut className="size-4" aria-hidden />
            {isPending ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PlatformHeader({
  adminName,
  adminEmail,
}: {
  adminName: string;
  adminEmail: string;
}) {
  const pathname = usePathname();
  const page = currentPage(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-15 shrink-0 items-center gap-2.5 border-b bg-background/95 px-4 backdrop-blur md:px-6 lg:px-8">
      <SidebarTrigger
        icon={<Menu />}
        className="size-9 shrink-0 border border-border bg-card text-muted-foreground hover:bg-muted lg:hidden"
      />

      <div className="flex min-w-0 flex-col">
        <span className="hidden truncate text-xs text-muted-foreground sm:block">
          Platform Admin
          {page && <> · {page.group}</>}
        </span>
        <span className="truncate text-sm font-bold text-foreground">
          {page?.label ?? "Platform Admin"}
        </span>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <PlatformProfileMenu adminName={adminName} adminEmail={adminEmail} />
      </div>
    </header>
  );
}
