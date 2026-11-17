import { LogOut, ShieldAlert } from "lucide-react";

import { IMPERSONATION_END_PATH } from "@/lib/impersonation-shared";

/**
 * Shown on every workspace page while platform support is signed in as this
 * user (migration 20261117160000). A plain form, so it works before the page
 * hydrates and without client JavaScript.
 */
export function ImpersonationBanner({
  operator,
  userName,
}: {
  operator: string;
  userName: string;
}) {
  return (
    <div
      role="status"
      className="flex shrink-0 flex-col gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100"
    >
      <p className="flex items-start gap-2 text-sm">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong>Platform support ({operator})</strong> is signed in as{" "}
          <strong>{userName}</strong>. Every change is recorded in the audit log
          as platform support.
        </span>
      </p>
      <form action={IMPERSONATION_END_PATH} method="post" className="shrink-0">
        <button
          type="submit"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-400 bg-white px-3 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
        >
          <LogOut className="size-3.5" aria-hidden />
          End session
        </button>
      </form>
    </div>
  );
}
