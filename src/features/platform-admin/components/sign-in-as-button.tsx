"use client";

import { useState, useTransition } from "react";
import { Loader2, LogIn, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { ModalNotice } from "@/components/shared/modal-notice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TEAM_DIALOG_CONTENT,
  TEAM_DIALOG_FOOTER,
  TEAM_DIALOG_TITLE,
  TEAM_MODAL_BUTTON,
  TEAM_MODAL_BUTTON_PRIMARY,
} from "@/features/team/components/modal-buttons";
import { formatSupportTime } from "@/features/support/support";
import { cn } from "@/lib/utils";

import { startImpersonationAction } from "../actions/platform-impersonation.actions";

/**
 * Signs this browser in as the admin who granted access on the request, after
 * a confirmation: it gives full access, so it is never a single click. On
 * success the action redirects into their workspace, so only a failure comes
 * back here.
 */
export function SignInAsButton({
  requestId,
  name,
  workspaceName,
  accessEndsAt,
  className,
}: {
  requestId: string;
  /** The admin's name, when known; the server decides who it is either way. */
  name?: string;
  workspaceName?: string;
  accessEndsAt?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const who = name ?? "the admin who granted access";

  function signIn() {
    startTransition(async () => {
      const result = await startImpersonationAction({ requestId });

      if (result && !result.success) {
        toast.error(result.message);
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        className={cn("h-10 gap-2 rounded-lg font-semibold", className)}
        onClick={() => setOpen(true)}
      >
        <LogIn className="size-4" aria-hidden />
        {name ? `Sign in as ${name}` : "Sign in as admin"}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
        <DialogContent className={cn("sm:max-w-lg", TEAM_DIALOG_CONTENT)}>
          <DialogHeader>
            <DialogTitle className={TEAM_DIALOG_TITLE}>
              Sign in as {who}?
            </DialogTitle>
            <DialogDescription>
              You&apos;ll open {workspaceName ?? "their workspace"} as them,
              with their full access: you can change and delete what they can.
            </DialogDescription>
          </DialogHeader>

          <ModalNotice icon={ShieldAlert} tone="amber">
            Everything you open or change is recorded in their audit log as
            platform support.
            {accessEndsAt
              ? ` The session ends with their grant, ${formatSupportTime(accessEndsAt)}, or when you click End session.`
              : " The session ends with their grant, or when you click End session."}
          </ModalNotice>

          <DialogFooter className={cn(TEAM_DIALOG_FOOTER, "flex-row")}>
            <Button
              variant="outline"
              className={cn(TEAM_MODAL_BUTTON, "flex-1 sm:flex-none")}
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className={cn(
                TEAM_MODAL_BUTTON,
                TEAM_MODAL_BUTTON_PRIMARY,
                "flex-1 sm:flex-none",
              )}
              disabled={isPending}
              onClick={signIn}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <LogIn className="size-4" aria-hidden />
              )}
              Sign in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
