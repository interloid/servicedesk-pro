import { PlatformName } from "@/components/shared/platform-brand";
import { ShellIdentity } from "@/types/shell-identity";

export function AppFooter({ identity }: { identity: ShellIdentity | null }) {
  return (
    // One line at every width: on a phone the extra links are dropped so the
    // footer never wraps and eats into the page above it.
    <footer className="mx-auto flex w-full max-w-full shrink-0 items-center gap-3 border-t bg-white px-4 py-2.5 text-xs text-muted-foreground md:px-6 md:py-3 lg:px-8">
      <span className="min-w-0 truncate">
        <PlatformName />
        {identity ? ` · ${identity.org.name}` : ""}
      </span>
      <span aria-hidden className="hidden md:inline">
        ·
      </span>
      <span className="hidden md:inline">Status</span>
      <span className="hidden md:inline">Docs</span>
      <span className="hidden lg:inline">Keyboard shortcuts</span>
      <span className="ml-auto shrink-0 font-mono">v3.14</span>
    </footer>
  );
}
