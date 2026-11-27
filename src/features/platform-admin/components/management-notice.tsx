import { AlertTriangle, KeyRound } from "lucide-react";

import { ModalNotice } from "@/components/shared/modal-notice";

import type { ManagementFailure } from "../types";
import { PLATFORM_CARD } from "./platform-ui";

/** One numbered step in the setup card. */
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 ring-1 ring-brand-700/15">
        {n}
      </span>
      <span className="pt-0.5 text-sm leading-relaxed text-slate-600">
        {children}
      </span>
    </li>
  );
}

/** Why Supabase logs aren't showing, and for a missing token, how to add one. */
export function ManagementNotice({ failure }: { failure: ManagementFailure }) {
  if (failure.reason !== "not_configured") {
    return (
      <ModalNotice icon={AlertTriangle} tone="danger" title="Logs unavailable">
        {failure.message}
      </ModalNotice>
    );
  }

  return (
    // A setup card rather than a warning: nothing is broken, a token is missing.
    <div className={`${PLATFORM_CARD} flex flex-col gap-4 p-5 sm:flex-row`}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <KeyRound className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col gap-3">
        <div>
          <h3 className="font-heading text-base font-bold text-foreground">
            Connect Supabase logs
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Logs come from the Supabase Management API, which needs an access
            token.
          </p>
        </div>
        <ol className="flex flex-col gap-2.5">
          <Step n={1}>
            In Supabase, open Account → Access Tokens and create a token limited
            to this project, with only the Logs (Read) permission.
          </Step>
          <Step n={2}>
            Add it to the server environment as{" "}
            <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
              SUPABASE_MANAGEMENT_TOKEN
            </code>
            , then restart the app.
          </Step>
        </ol>
      </div>
    </div>
  );
}
