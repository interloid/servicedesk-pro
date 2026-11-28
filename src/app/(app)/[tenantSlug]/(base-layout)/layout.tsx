import type { Metadata } from "next";
import { AppFooter } from "@/components/shared/layout/app-footer";
import { AppHeader } from "@/components/shared/layout/app-header";
import { AppSidebar } from "@/components/shared/layout/app-sidebar";
import { GlobalShortcuts } from "@/components/shared/layout/global-shortcuts";
import { ImpersonationBanner } from "@/components/shared/layout/impersonation-banner";
import { RoleRouteGuard } from "@/components/shared/layout/role-route-guard";
import { TokenRoleSync } from "@/components/shared/layout/token-role-sync";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NotificationsProvider } from "@/features/notifications/components/notifications-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceStatusWatcher } from "@/features/platform-admin/components/workspace-status-watcher";
import { getShellIdentity } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { APP_ROUTES } from "@/lib/routes";
import { isStaffRole } from "@/lib/tenancy";
import { notFound, redirect } from "next/navigation";

// Signed-in screens have nothing for a search engine.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{
    tenantSlug: string;
  }>;
}) {
  const { tenantSlug } = await params;

  const identity = await getShellIdentity(tenantSlug);

  // getShellIdentity returns null for a failed claims lookup, a session whose
  // tenant does not match the URL, or a tenant row RLS will not return. Without
  // this the shell renders with customer navigation, which fails open.
  //
  // Deliberately notFound() and not a redirect to the tenant login: the proxy
  // bounces an authenticated visitor off /[slug]/login back to /[slug]/tickets
  // (see allowsExistingSession in lib/tenancy.ts), so redirecting there would
  // loop forever for exactly the broken sessions this guard catches.
  if (!identity) {
    // Signed out altogether -- most often the page re-rendering in the same
    // moment Sign out clears the session -- goes to the sign-in page, as the
    // platform console does, instead of flashing a 404 first. No loop: the
    // proxy only bounces visitors who still have a session off /login.
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect(APP_ROUTES.LOGIN);
    }

    notFound();
  }

  // Backstop for the proxy's customer check. A customer does have a live
  // membership, so getShellIdentity resolves for them and `identity` is not
  // null -- without this the dashboard renders on a customer's session if the
  // proxy is ever bypassed. /unauthorized is a central, tenant-less path, so it
  // cannot bounce back in here.
  if (!isStaffRole(identity.user.role)) {
    redirect(
      `${APP_ROUTES.UNAUTHORIZED}?tenant=${encodeURIComponent(tenantSlug)}`,
    );
  }

  return (
    <SidebarProvider className="w-full">
      <TooltipProvider delayDuration={0}>
        <NotificationsProvider userId={identity.user.id}>
          <RoleRouteGuard role={identity.user.role} />
          <WorkspaceStatusWatcher slug={tenantSlug} />
          <TokenRoleSync
            stale={identity.user.tokenRoleStale}
            role={identity.user.role}
          />
          <GlobalShortcuts role={identity.user.role} />
          <div className="relative flex h-screen w-full overflow-hidden bg-background text-xs text-slate-800 font-sans antialiased">
            <AppSidebar identity={identity} />

            <div className="flex flex-1 flex-col min-w-0 h-full w-full">
              {identity.user.impersonatedBy && (
                <ImpersonationBanner
                  operator={identity.user.impersonatedBy}
                  userName={identity.user.name}
                />
              )}
              <AppHeader identity={identity} />

              <main className="w-full flex-1 overflow-y-auto p-0">
                {children}
              </main>

              <AppFooter identity={identity} />
            </div>
          </div>
        </NotificationsProvider>
      </TooltipProvider>
    </SidebarProvider>
  );
}
