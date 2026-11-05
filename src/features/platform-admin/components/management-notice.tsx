import { AlertTriangle, KeyRound } from "lucide-react";

import { ModalNotice } from "@/components/shared/modal-notice";

import type { ManagementFailure } from "../types";

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
    <ModalNotice icon={KeyRound} tone="neutral" title="Connect Supabase logs">
      <ol className="mt-1 list-decimal space-y-1 pl-4">
        <li>
          In Supabase, open Account → Access Tokens and create a token limited
          to this project, with only the Logs (Read) permission.
        </li>
        <li>
          Add it to the server environment as{" "}
          <code className="font-mono">SUPABASE_MANAGEMENT_TOKEN</code>, then
          restart the app.
        </li>
      </ol>
    </ModalNotice>
  );
}
