"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  Ticket,
  Bookmark,
  Building2,
  BookOpen,
  MessageSquareText,
  Clock,
  BarChart2,
  Users,
  Droplet,
  Mail,
  Zap,
  Shield,
  Database,
  Bell,
  FileText,
  CreditCard,
  PanelLeft,
  User,
  BadgeDollarSign,
  Lock,
  LifeBuoy,
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
  SidebarTrigger,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  SHIPPED_TENANT_ROUTES,
  stripTenantPrefix,
  TENANT_ROUTES,
  tenantPath,
} from "@/lib/tenancy";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isMembershipRole, MembershipRole } from "@/types/team-members";
import { ShellIdentity } from "@/types/shell-identity";
import { planIncludesReports } from "@/features/reports/types/types";
import { planIncludesBranding } from "@/features/branding/branding";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: MembershipRole[];
  /** Not on the tenant's plan: still listed, with a lock, so it can be discovered. */
  locked?: boolean;
}

export interface NavSection {
  title: string | null;
  items: NavItem[];
}

/**
 * The workspace navigation, shared by the sidebar and the header breadcrumb.
 * Not filtered by role here; the sidebar drops what the role cannot open.
 */
export function workspaceNavSections(
  identity: ShellIdentity | null,
): NavSection[] {
  return [
    {
      title: "Workspace",
      items: [
        {
          label: "Ticket queue",
          href: TENANT_ROUTES.TICKETS,
          icon: Ticket,
          roles: ["tenant_admin", "manager", "agent"],
        },
        {
          label: "Saved views",
          href: TENANT_ROUTES.VIEWS,
          icon: Bookmark,
          roles: ["tenant_admin", "manager", "agent"],
        },
        {
          label: "Customers",
          href: TENANT_ROUTES.CUSTOMERS,
          icon: Building2,
          roles: ["tenant_admin", "manager", "agent"],
        },
        {
          label: "Knowledge base",
          href: TENANT_ROUTES.KNOWLEDGE_BASE,
          icon: BookOpen,
          roles: ["tenant_admin", "manager", "agent"],
        },
        {
          label: "Macros & templates",
          href: TENANT_ROUTES.MACROS,
          icon: MessageSquareText,
          roles: ["tenant_admin", "manager", "agent"],
        },
        {
          label: "SLA policies",
          href: TENANT_ROUTES.SLA,
          icon: Clock,
          roles: ["tenant_admin", "manager", "agent"],
        },
        {
          label: "Reports",
          href: TENANT_ROUTES.REPORTS,
          icon: BarChart2,
          roles: ["tenant_admin", "manager", "agent"],
          locked: !planIncludesReports(identity?.org.planName),
        },
      ],
    },

    {
      title: "SETTINGS",
      items: [
        {
          label: "Team & roles",
          href: TENANT_ROUTES.SETTINGS.TEAM,
          icon: Users,
          roles: ["tenant_admin", "manager"],
        },
        {
          label: "Branding",
          href: TENANT_ROUTES.SETTINGS.BRANDING,
          icon: Droplet,
          roles: ["tenant_admin", "manager"],
          locked: !planIncludesBranding(identity?.org.planName),
        },
        {
          label: "Channels & email",
          href: TENANT_ROUTES.SETTINGS.CHANNELS,
          icon: Mail,
          roles: ["tenant_admin"],
        },
        {
          label: "Integrations & API",
          href: TENANT_ROUTES.SETTINGS.INTEGRATIONS,
          icon: Zap,
          roles: ["tenant_admin"],
        },
        {
          label: "Security & SSO",
          href: TENANT_ROUTES.SETTINGS.SECURITY,
          icon: Shield,
          roles: ["tenant_admin"],
        },
        {
          label: "Data & privacy",
          href: TENANT_ROUTES.SETTINGS.DATA,
          icon: Database,
          roles: ["tenant_admin"],
        },
        {
          label: "Notification center",
          href: TENANT_ROUTES.SETTINGS.NOTIFICATIONS,
          icon: Bell,
          roles: ["tenant_admin", "manager", "agent"],
        },
        {
          label: "Audit log",
          href: TENANT_ROUTES.SETTINGS.AUDIT,
          icon: FileText,
          roles: ["tenant_admin", "manager"],
          locked: !identity?.org.auditLogs,
        },
      ],
    },

    {
      title: "ACCOUNT",
      items: [
        {
          label: "Billing overview",
          href: TENANT_ROUTES.ACCOUNT.BILLING,
          icon: CreditCard,
          roles: ["tenant_admin", "billing_admin"],
        },
        {
          label: "Plans & pricing",
          href: TENANT_ROUTES.ACCOUNT.PLANS,
          icon: BadgeDollarSign,
          roles: ["tenant_admin", "billing_admin"],
        },
        {
          label: "Help & Support",
          href: TENANT_ROUTES.SUPPORT.HOME,
          icon: LifeBuoy,
          roles: ["tenant_admin"],
        },
      ],
    },
  ];
}

/** "SETTINGS" -> "Settings", for the header breadcrumb. */
export function sectionLabel(title: string): string {
  return title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
}

/** Whether a nav item's page (or one below it) is the current path. */
export function isNavItemActive(
  pathname: string,
  tenantSlug: string,
  href: string,
): boolean {
  const targetPath = tenantSlug ? tenantPath(tenantSlug, href) : href;
  return (
    pathname === targetPath ||
    (href !== "/" && pathname.startsWith(`${targetPath}/`))
  );
}

const NAV_BUTTON_CLASS = cn(
  "h-10 w-full gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 [&_svg]:text-slate-600",
  "transition-colors hover:bg-slate-100 hover:text-slate-900 hover:[&_svg]:text-slate-900",
  // Active: a light wash of the brand teal, a 3px accent on the leading edge
  // (dropped when the sidebar collapses to icons), brand icon. Same as the
  // platform console's sidebar.
  "data-[active=true]:bg-brand-700/10 data-[active=true]:font-semibold data-[active=true]:text-brand-800 data-[active=true]:hover:bg-brand-700/10 data-[active=true]:hover:text-brand-800 data-[active=true]:shadow-[inset_3px_0_0_var(--brand-700)] data-[active=true]:[&_svg]:text-brand-700 data-[active=true]:hover:[&_svg]:text-brand-700",
  "group-data-[collapsible=icon]:data-[active=true]:shadow-none",
  "group-data-[collapsible=icon]:h-10",
  "group-data-[collapsible=icon]:w-10",
  "group-data-[collapsible=icon]:justify-center",
  "group-data-[collapsible=icon]:p-0",
);

export function AppSidebar({ identity }: { identity: ShellIdentity | null }) {
  const pathname = usePathname();
  const params = useParams();

  const { isMobile, setOpenMobile } = useSidebar();

  // identity.user.role is a plain string and can hold a value that is not a
  // real membership role (the JWT claim is absent for a member whose row was
  // not active when the token was minted). Checking it rather than casting is
  // what keeps an unknown role from filtering every nav item away.
  const userRole: MembershipRole = isMembershipRole(identity?.user.role)
    ? identity.user.role
    : "customer";

  // org.name is a display name ("CloudNova Systems"), never a URL slug, so the
  // path is the only safe fallback for the route parameter.
  const tenantSlug =
    (params?.tenantSlug as string | undefined) ??
    stripTenantPrefix(pathname)?.slug ??
    "";

  const navSections = workspaceNavSections(identity);

  const hasAccess = (itemRoles: MembershipRole[]) =>
    itemRoles.includes(userRole);

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => hasAccess(item.roles) && SHIPPED_TENANT_ROUTES.has(item.href),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <Sidebar collapsible="icon" className="select-none border-r">
      <SidebarHeader className="h-15 shrink-0 justify-center border-b border-sidebar-border px-3.5 py-0 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sm font-extrabold text-sidebar-primary-foreground">
            {identity?.org.initial ?? "T"}
          </div>

          <TooltipProvider>
            <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block min-w-0 truncate font-sans text-sm font-bold tracking-tight text-foreground capitalize">
                    {identity?.org.name ?? "Tenant Workspace"}
                  </span>
                </TooltipTrigger>

                <TooltipContent className="capitalize">
                  {identity?.org.name ?? "Tenant Workspace"}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block min-w-0 truncate text-xs text-muted-foreground">
                    {identity?.org.planSummary ?? "Active Plan"}
                  </span>
                </TooltipTrigger>

                <TooltipContent>
                  {identity?.org.planSummary ?? "Active Plan"}
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          <SidebarTrigger
            icon={<PanelLeft />}
            className="hidden size-8 shrink-0 border border-border bg-card text-muted-foreground hover:bg-muted md:flex"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-5 px-3 py-4 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        {visibleSections.map((group, index) => (
          <SidebarGroup
            key={group.title ?? `group-${index}`}
            className="gap-1 p-0"
          >
            {group.title && (
              <SidebarGroupLabel className="h-auto px-3 pb-2 text-[11px] font-semibold tracking-[0.08em] text-slate-400 uppercase group-data-[collapsible=icon]:hidden">
                {group.title}
              </SidebarGroupLabel>
            )}

            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  const targetPath = tenantSlug
                    ? tenantPath(tenantSlug, item.href)
                    : item.href;

                  const isActive = isNavItemActive(
                    pathname,
                    tenantSlug,
                    item.href,
                  );

                  return (
                    <SidebarMenuItem
                      key={item.href}
                      className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
                    >
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                        className={NAV_BUTTON_CLASS}
                      >
                        <Link
                          href={targetPath}
                          onClick={() => {
                            if (isMobile) {
                              setOpenMobile(false);
                            }
                          }}
                          className="flex min-w-0 items-center gap-3 group-data-[collapsible=icon]:justify-center"
                        >
                          <Icon
                            className="size-[18px] shrink-0"
                            strokeWidth={1.75}
                          />

                          <span className="truncate group-data-[collapsible=icon]:hidden">
                            {item.label}
                          </span>

                          {item.locked && (
                            <Lock
                              aria-label="Upgrade to unlock"
                              className="ml-auto size-3.5 shrink-0 text-slate-400! group-data-[collapsible=icon]:hidden"
                            />
                          )}
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
        <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200/70 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:ring-0">
          <Avatar className="size-8 shrink-0">
            <AvatarImage
              src={identity?.user.avatarUrl}
              alt={identity?.user.name ?? "Unknown user"}
            />

            <AvatarFallback className="bg-brand-700 text-xs font-bold text-white">
              {identity?.user.initials ? (
                identity.user.initials
              ) : (
                <User className="h-4 w-4" />
              )}
            </AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold text-foreground">
              {identity?.user.name ?? "Unknown user"}
            </span>

            <span className="truncate text-xs capitalize text-muted-foreground">
              {userRole.replace("_", " ")}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
