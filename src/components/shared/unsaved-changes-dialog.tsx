"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import {
  TEAM_DIALOG_CONTENT,
  TEAM_DIALOG_FOOTER,
  TEAM_MODAL_BUTTON,
  TEAM_MODAL_BUTTON_DANGER,
} from "@/features/team/components/modal-buttons";
import {
  DIALOG_FOOTER_BAND,
  DialogIconHeader,
} from "@/features/team/components/dialog-icon-header";

/**
 * "Leave without saving?" popup for useUnsavedChangesGuard. Same look as the
 * Branding page's discard confirm.
 */
export function UnsavedChangesDialog({
  open,
  onStay,
  onLeave,
  description = "Your changes haven't been saved. If you leave this page now, they will be lost.",
}: {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
  description?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onStay()}>
      <DialogContent className={`sm:max-w-115 ${TEAM_DIALOG_CONTENT}`}>
        <DialogIconHeader
          icon={TriangleAlert}
          tint="bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300"
          title="Leave without saving?"
          description={description}
        />

        <DialogFooter className={`${TEAM_DIALOG_FOOTER} ${DIALOG_FOOTER_BAND}`}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onStay}
            className={TEAM_MODAL_BUTTON}
          >
            Stay on page
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onLeave}
            className={`${TEAM_MODAL_BUTTON} ${TEAM_MODAL_BUTTON_DANGER}`}
          >
            Leave page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
