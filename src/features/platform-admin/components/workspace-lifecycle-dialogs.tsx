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
import { Input } from "@/components/ui/input";
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
  extendTrialAction,
  restoreWorkspaceAction,
  softDeleteWorkspaceAction,
} from "../actions/platform-tenants.actions";
import { formatDate } from "../format";
import { TRIAL_EXTENSION_DAYS, type PlatformTenant } from "../types";

function Footer({
  isSaving,
  disabled,
  danger,
  label,
  onCancel,
  onConfirm,
}: {
  isSaving: boolean;
  disabled?: boolean;
  danger?: boolean;
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <DialogFooter className={cn(TEAM_DIALOG_FOOTER, "flex-row")}>
      <Button
        variant="outline"
        className={cn(TEAM_MODAL_BUTTON, "flex-1 sm:flex-none")}
        disabled={isSaving}
        onClick={onCancel}
      >
        Cancel
      </Button>
      <Button
        variant={danger ? "outline" : "default"}
        className={cn(
          TEAM_MODAL_BUTTON,
          danger ? TEAM_MODAL_BUTTON_DANGER : TEAM_MODAL_BUTTON_PRIMARY,
          "flex-1 sm:flex-none",
        )}
        disabled={isSaving || disabled}
        onClick={onConfirm}
      >
        {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label}
      </Button>
    </DialogFooter>
  );
}

/** Soft-delete, confirmed by typing the workspace name. */
export function WorkspaceDeleteDialog({
  tenant,
  onClose,
}: {
  tenant: PlatformTenant;
  onClose: () => void;
}) {
  const [confirmName, setConfirmName] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const nameMatches = confirmName.trim() === tenant.name.trim();

  function submit() {
    startSaving(async () => {
      const result = await softDeleteWorkspaceAction({
        tenantId: tenant.id,
        confirmName,
        reason,
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      toast.success(`${tenant.name} deleted. You can restore it later.`);
      onClose();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className={TEAM_DIALOG_TITLE}>
          Delete {tenant.name}?
        </DialogTitle>
        <DialogDescription>
          This is a soft delete. Its team and customers lose access within about
          10 seconds and it leaves the tenant list. No tickets, files or audit
          entries are removed, and you can restore it.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        {tenant.mrr > 0 && (
          <ModalNotice icon={AlertTriangle} tone="amber">
            Its PayPal subscription is cancelled now, with no refund, and it
            moves to the Free plan. A restored workspace has to subscribe again.
          </ModalNotice>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-reason">Reason</Label>
          <Textarea
            id="delete-reason"
            rows={2}
            maxLength={300}
            className="h-20 min-h-0 resize-none"
            placeholder="Recorded in the workspace's audit log"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-confirm">
            Type <span className="font-semibold">{tenant.name}</span> to confirm
          </Label>
          <Input
            id="delete-confirm"
            autoComplete="off"
            className="h-10 rounded-lg"
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Footer
        danger
        isSaving={isSaving}
        disabled={!nameMatches || reason.trim().length < 3}
        label="Delete workspace"
        onCancel={onClose}
        onConfirm={submit}
      />
    </>
  );
}

export function WorkspaceRestoreDialog({
  tenant,
  onClose,
}: {
  tenant: PlatformTenant;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function submit() {
    startSaving(async () => {
      const result = await restoreWorkspaceAction(tenant.id);

      if (!result.success) {
        setError(result.message);
        return;
      }

      toast.success(
        `${tenant.name} restored. It stays blocked until you unblock it.`,
      );
      onClose();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className={TEAM_DIALOG_TITLE}>
          Restore {tenant.name}?
        </DialogTitle>
        <DialogDescription>
          It comes back to the tenant list, still blocked. Unblock it when its
          team should get access again.
        </DialogDescription>
      </DialogHeader>

      {tenant.deleteReason && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Deleted because:</span>{" "}
          {tenant.deleteReason}
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Footer
        isSaving={isSaving}
        label="Restore workspace"
        onCancel={onClose}
        onConfirm={submit}
      />
    </>
  );
}

export function ExtendTrialDialog({
  tenant,
  onClose,
}: {
  tenant: PlatformTenant;
  onClose: () => void;
}) {
  const [days, setDays] = useState<number>(TRIAL_EXTENSION_DAYS[0]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function submit() {
    startSaving(async () => {
      const result = await extendTrialAction({ tenantId: tenant.id, days });

      if (!result.success) {
        setError(result.message);
        return;
      }

      toast.success(
        `${tenant.name}'s trial now ends ${formatDate(result.endsAt)}.`,
      );
      onClose();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className={TEAM_DIALOG_TITLE}>
          Extend {tenant.name}&apos;s trial
        </DialogTitle>
        <DialogDescription>
          {tenant.trialEndsAt
            ? `The trial ends ${formatDate(tenant.trialEndsAt)}.`
            : "This workspace is on a trial."}{" "}
          The extension is recorded in its audit log.
        </DialogDescription>
      </DialogHeader>

      <div
        role="radiogroup"
        aria-label="Days to add"
        className="grid grid-cols-3 gap-2"
      >
        {TRIAL_EXTENSION_DAYS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={days === value}
            onClick={() => setDays(value)}
            className={cn(
              "flex h-12 items-center justify-center rounded-lg border text-sm font-semibold transition-colors",
              days === value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-foreground hover:bg-muted/40",
            )}
          >
            +{value} days
          </button>
        ))}
      </div>

      <ModalNotice icon={Info} tone="neutral">
        Only trials with no PayPal subscription can be extended. A paid
        subscription&apos;s dates come from PayPal.
      </ModalNotice>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Footer
        isSaving={isSaving}
        label={`Add ${days} days`}
        onCancel={onClose}
        onConfirm={submit}
      />
    </>
  );
}
