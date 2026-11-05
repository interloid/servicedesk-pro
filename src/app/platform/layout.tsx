import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlatformSidebar } from "@/features/platform-admin/components/platform-sidebar";
import { PlatformHeader } from "@/features/platform-admin/components/platform-header";
import { requirePlatformAdmin } from "@/features/platform-admin/services/platform-access";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requirePlatformAdmin();

  return (
    // A touch wider than the tenant shell so "Subscriptions & Billing" fits
    // beside its "Soon" tag.
    <SidebarProvider
      className="w-full"
      style={{ "--sidebar-width": "17rem" } as React.CSSProperties}
    >
      <TooltipProvider delayDuration={0}>
        {/* relative: a screen-reader-only label is absolutely positioned, and
            without this it escapes every scroll area below and makes the whole
            document scroll, past the shell into blank space. */}
        <div className="relative flex h-screen w-full overflow-hidden bg-background text-xs text-slate-800 font-sans antialiased">
          <PlatformSidebar adminName={admin.name} adminEmail={admin.email} />

          <div className="flex flex-1 flex-col min-w-0 h-full w-full">
            <PlatformHeader />

            <main className="w-full flex-1 overflow-y-auto p-4 has-data-no-page-scrollbar:scrollbar-none sm:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </TooltipProvider>
    </SidebarProvider>
  );
}
