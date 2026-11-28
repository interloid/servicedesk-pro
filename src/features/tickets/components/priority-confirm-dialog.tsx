"use client";

import { ArrowDownWideNarrow, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalNotice } from "@/components/shared/modal-notice";
import {
  TEAM_DIALOG_CONTENT,
  TEAM_DIALOG_FOOTER,
  TEAM_DIALOG_TITLE,
  TEAM_MODAL_BUTTON,
  TEAM_MODAL_BUTTON_PRIMARY,
} from "@/features/team/components/modal-buttons";
import { cn } from "@/lib/utils";
import { TICKET_PRIORITY_LABELS, TicketPriority } from "../types/tickets.types";

/**
 * Confirms a lowered priority before it is saved. No reason is asked for;
 * change_ticket_priority still keeps due-soon deadlines and audits the change.
 */
export function PriorityConfirmDialog({
  open,
  to,
  ticketCount = 1,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /** The priority being lowered to. */
  to: TicketPriority | null;
  /** More than one for a bulk change. */
  ticketCount?: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const label = to ? TICKET_PRIORITY_LABELS[to] : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <DialogContent
        className={cn(
          "w-[calc(100%-2rem)] max-w-lg min-w-0 overflow-hidden sm:max-w-lg",
          TEAM_DIALOG_CONTENT,
        )}
      >
        <DialogHeader className="min-w-0 flex-row items-start gap-3.5 pr-6 text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300">
            <ArrowDownWideNarrow
              className="size-5"
              strokeWidth={1.75}
              aria-hidden
            />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className={cn(TEAM_DIALOG_TITLE, "font-heading")}>
              Lower priority to {label}?
            </DialogTitle>

            <DialogDescription className="leading-relaxed wrap-break-word">
              {ticketCount > 1
                ? `Some of the ${ticketCount} selected tickets will drop in priority.`
                : "This ticket will drop in priority."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="w-full min-w-0">
          <ModalNotice icon={Info} tone="amber">
            <span className="block min-w-0 whitespace-normal wrap-break-word">
              An SLA timer that is due soon keeps its current deadline, and a
              breach already recorded stays on record.
            </span>
          </ModalNotice>
        </div>

        <DialogFooter
          className={cn(
            TEAM_DIALOG_FOOTER,
            "flex-row bg-slate-50/60 dark:bg-muted/30",
          )}
        >
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className={cn(TEAM_MODAL_BUTTON, "flex-1 sm:flex-none")}
            onClick={onCancel}
          >
            Cancel
          </Button>

          <Button
            type="button"
            autoFocus
            disabled={pending}
            className={cn(
              TEAM_MODAL_BUTTON,
              TEAM_MODAL_BUTTON_PRIMARY,
              "flex-1 sm:flex-none",
            )}
            onClick={onConfirm}
          >
            {pending ? "Saving…" : "Lower priority"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
