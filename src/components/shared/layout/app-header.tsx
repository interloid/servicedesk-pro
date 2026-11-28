"use client";
import { useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { ChevronRight, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  isNavItemActive,
  sectionLabel,
  workspaceNavSections,
} from "@/components/shared/layout/app-sidebar";
import { HeaderSearch } from "@/components/shared/layout/header-search";
import { NotificationMenu } from "@/components/shared/layout/notification-menu";
import { ProfileMenu } from "@/components/shared/layout/profile-menu";
import { ShellIdentity } from "@/types/shell-identity";
import {
  isTenantRouteAllowed,
  stripTenantPrefix,
  TENANT_ROUTES,
} from "@/lib/tenancy";

/** Outline icon button in the header, as on the platform console. */
const HEADER_ICON_BUTTON =
  "relative size-10 rounded-lg border-none text-slate-600 transition-colors hover:bg-muted hover:text-slate-900";

export function AppHeader({ identity }: { identity: ShellIdentity | null }) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const pathname = usePathname();
  const params = useParams();
  // The search opens the ticket queue, so only for roles that can see it.
  const canSearch = isTenantRouteAllowed(
    identity?.user.role,
    TENANT_ROUTES.TICKETS,
  );

  // The sidebar item whose page (or a page below it) is open: its section and
  // label make the breadcrumb and title, like the platform console's header.
  const tenantSlug =
    (params?.tenantSlug as string | undefined) ??
    stripTenantPrefix(pathname)?.slug ??
    "";
  const page = workspaceNavSections(identity)
    .flatMap((section) =>
      section.items.map((item) => ({ ...item, section: section.title })),
    )
    .find((item) => isNavItemActive(pathname, tenantSlug, item.href));

  return (
    <header className="sticky top-0 z-10 flex h-15 shrink-0 items-center gap-2.5 border-b bg-white/90 px-4 backdrop-blur md:px-6 lg:px-8">
      <SidebarTrigger
        icon={<Menu />}
        className="size-9 shrink-0 border border-border bg-card text-muted-foreground hover:bg-muted lg:hidden"
      />

      <div className="flex min-w-0 flex-1 flex-col lg:flex-none lg:max-w-64 xl:max-w-80">
        <span className="hidden min-w-0 items-center gap-1 truncate text-xs text-slate-400 capitalize sm:flex">
          <span className="truncate">
            {identity?.org.name ?? "Tenant Workspace"}
          </span>
          {page?.section && (
            <>
              <ChevronRight className="size-3 shrink-0" aria-hidden />
              <span className="shrink-0 normal-case">
                {sectionLabel(page.section)}
              </span>
            </>
          )}
        </span>
        <span className="truncate font-heading text-sm font-bold tracking-tight text-foreground">
          {page?.label ?? "Workspace"}
        </span>
      </div>

      {canSearch && (
        <HeaderSearch className="ml-4 hidden h-9.5 max-w-105 flex-1 gap-2.25 rounded-lg border-border bg-muted lg:flex xl:ml-8" />
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {canSearch && (
          <Popover open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Search"
                className={`${HEADER_ICON_BUTTON} lg:hidden`}
              >
                <Search className="size-5" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(22rem,calc(100vw-2rem))] lg:hidden"
            >
              <HeaderSearch
                autoFocus
                shortcut={false}
                onSearch={() => setMobileSearchOpen(false)}
                className="h-9.5 gap-2.25 rounded-lg border-border bg-muted"
              />
            </PopoverContent>
          </Popover>
        )}

        <NotificationMenu />
        <ProfileMenu identity={identity} />
      </div>
    </header>
  );
}
