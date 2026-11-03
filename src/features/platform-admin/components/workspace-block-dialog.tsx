"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ModalNotice } from "@/components/shared/modal-notice";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TEAM_DIALOG_FOOTER,
  TEAM_DIALOG_TITLE,
  TEAM_MODAL_BUTTON,
  TEAM_MODAL_BUTTON_DANGER,
  TEAM_MODAL_BUTTON_PRIMARY,
} from "@/features/team/components/modal-buttons";
import { cn } from "@/lib/utils";

import {
  blockWorkspaceAction,
  unblockWorkspaceAction,
} from "../actions/platform-tenants.actions";
import type { PlatformTenant } from "../types";

export function WorkspaceBlockDialog({
  tenant,
  onClose,
}: {
  tenant: PlatformTenant;
  onClose: () => void;
}) {
  const blocked = tenant.status === "suspended";
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function submit() {
    startSaving(async () => {
      const result = blocked
        ? await unblockWorkspaceAction(tenant.id)
        : await blockWorkspaceAction({ tenantId: tenant.id, reason });

      if (!result.success) {
        setError(result.message);
        return;
      }

      toast.success(
        blocked ? `${tenant.name} unblocked.` : `${tenant.name} blocked.`,
      );
      onClose();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className={TEAM_DIALOG_TITLE}>
          {blocked ? "Unblock" : "Block"} {tenant.name}?
        </DialogTitle>
        <DialogDescription>
          {blocked
            ? "Its team and customers get their access back within about 10 seconds."
            : "Its team and customers lose access to the workspace and portal within about 10 seconds. No data is deleted, and you can unblock it at any time."}
        </DialogDescription>
      </DialogHeader>

      {blocked ? (
        <div className="flex flex-col gap-3">
          {tenant.blockReason && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                Blocked because:
              </span>{" "}
              {tenant.blockReason}
            </p>
          )}
          {tenant.blockSource === "payment" && (
            <ModalNotice icon={Info} tone="neutral">
              Its paid subscription stays cancelled. It comes back on the Free
              plan until it subscribes again.
            </ModalNotice>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tenant.mrr > 0 && (
            <ModalNotice icon={AlertTriangle} tone="amber">
              Blocking doesn&apos;t stop billing: PayPal keeps charging this
              workspace until its subscription is cancelled.
            </ModalNotice>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-reason">Reason</Label>
            <Textarea
              id="block-reason"
              rows={2}
              maxLength={300}
              className="h-20 min-h-0 resize-none"
              placeholder="Only platform admins see this"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter className={cn(TEAM_DIALOG_FOOTER, "flex-row")}>
        <Button
          variant="outline"
          className={cn(TEAM_MODAL_BUTTON, "flex-1 sm:flex-none")}
          disabled={isSaving}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          variant={blocked ? "default" : "outline"}
          className={cn(
            TEAM_MODAL_BUTTON,
            blocked ? TEAM_MODAL_BUTTON_PRIMARY : TEAM_MODAL_BUTTON_DANGER,
            "flex-1 sm:flex-none",
          )}
          disabled={isSaving || (!blocked && reason.trim().length < 3)}
          onClick={submit}
        >
          {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {blocked ? "Unblock" : "Block workspace"}
        </Button>
      </DialogFooter>
    </>
  );
}
