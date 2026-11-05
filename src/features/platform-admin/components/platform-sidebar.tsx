"use client";

import { usePlatformBrand } from "@/components/shared/platform-brand";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  CreditCard,
  Layers,
  BarChart3,
  ScrollText,
  Activity,
  LogOut,
  PanelLeft,
  TerminalSquare,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/features/auth/hooks/use-auth";
import { cn } from "@/lib/utils";

interface PlatformNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  // No page behind it yet: shown greyed out with a "Soon" tag, not linked.
  comingSoon?: boolean;
}

interface PlatformNavGroup {
  label: string;
  items: PlatformNavItem[];
}

const PLATFORM_NAV: PlatformNavGroup[] = [
  {
    label: "Manage platform",
    items: [
      { label: "Overview", href: "/platform", icon: LayoutDashboard },
      { label: "Tenants", href: "/platform/tenants", icon: Building2 },
      { label: "Users", href: "/platform/users", icon: Users },
    ],
  },
  {
    label: "Billing & product",
    items: [
      {
        label: "Subscriptions & Billing",
        href: "/platform/billing",
        icon: CreditCard,
      },
      {
        label: "Plans & Features",
        href: "/platform/plans",
        icon: Layers,
      },
      {
        label: "Analytics & Reports",
        href: "/platform/analytics",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        label: "Audit Logs",
        href: "/platform/audit-logs",
        icon: ScrollText,
      },
      {
        label: "System Health",
        href: "/platform/health",
        icon: Activity,
      },
      {
        label: "Application Logs",
        href: "/platform/logs",
        icon: TerminalSquare,
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        label: "Platform Settings",
        href: "/platform/settings",
        icon: Settings,
      },
    ],
  },
];

const NAV_BUTTON_CLASS = cn(
  "h-10 w-full rounded-md px-2.5 text-sm font-medium text-slate-600",
  "transition-colors hover:bg-slate-100/80 hover:text-slate-900",
  "group-data-[collapsible=icon]:h-10",
  "group-data-[collapsible=icon]:w-10",
  "group-data-[collapsible=icon]:justify-center",
  "group-data-[collapsible=icon]:p-0",
);

function initialsOf(name: string): string {
  return (
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "PA"
  );
}

export function PlatformSidebar({
  adminName,
  adminEmail,
}: {
  adminName: string;
  adminEmail: string;
}) {
  const pathname = usePathname();
  const { logout, isPending } = useLogout({ redirectTo: "/login" });
  const { platformName } = usePlatformBrand();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon" className="select-none border-r">
      <SidebarHeader className="border-b border-sidebar-border p-3.5 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sm font-extrabold text-sidebar-primary-foreground">
            {platformName.charAt(0).toUpperCase()}
          </div>

          <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
            <span className="block min-w-0 truncate text-sm font-bold text-foreground">
              {platformName}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              Platform console
            </span>
          </div>

          <SidebarTrigger
            icon={<PanelLeft />}
            className="hidden size-8 shrink-0 border border-border bg-card text-muted-foreground hover:bg-muted md:flex"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-3.5 px-2.5 py-3 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        {PLATFORM_NAV.map((group) => (
          <SidebarGroup key={group.label} className="gap-1 p-0">
            <SidebarGroupLabel className="h-auto px-3 pt-1.5 pb-1 text-xs font-bold tracking-widest text-muted-foreground/80 uppercase group-data-[collapsible=icon]:hidden">
              {group.label}
            </SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  if (item.comingSoon) {
                    return (
                      <SidebarMenuItem
                        key={item.href}
                        className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
                      >
                        <SidebarMenuButton
                          aria-disabled="true"
                          tooltip={`${item.label} (coming soon)`}
                          className={cn(
                            NAV_BUTTON_CLASS,
                            "cursor-default text-muted-foreground/70 hover:bg-transparent hover:text-muted-foreground/70",
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate group-data-[collapsible=icon]:hidden">
                            {item.label}
                          </span>
                          <span className="ml-auto shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground group-data-[collapsible=icon]:hidden">
                            Soon
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }

                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/platform" &&
                      pathname.startsWith(`${item.href}/`));

                  return (
                    <SidebarMenuItem
                      key={item.href}
                      className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
                    >
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                        className={cn(
                          NAV_BUTTON_CLASS,
                          isActive &&
                            "bg-slate-100/80 font-semibold text-slate-900",
                        )}
                      >
                        <Link
                          href={item.href}
                          className="flex min-w-0 items-center gap-2.5 group-data-[collapsible=icon]:justify-center"
                          onClick={() => {
                            if (isMobile) {
                              setOpenMobile(false);
                            }
                          }}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate group-data-[collapsible=icon]:hidden">
                            {item.label}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-foreground text-xs font-bold text-background">
              {initialsOf(adminName)}
            </AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold text-foreground">
              {adminName}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {adminEmail}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Sign out"
            title="Sign out"
            disabled={isPending}
            onClick={() => void logout()}
            className="shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
