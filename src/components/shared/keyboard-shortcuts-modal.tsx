"use client";

import * as React from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  TEAM_DIALOG_CONTENT,
  TEAM_DIALOG_FOOTER,
  TEAM_MODAL_BUTTON,
  TEAM_MODAL_BUTTON_PRIMARY,
} from "@/features/team/components/modal-buttons";
import {
  DIALOG_FOOTER_BAND,
  DialogIconHeader,
} from "@/features/team/components/dialog-icon-header";
import { Button } from "@/components/ui/button";
import { shortcutAccess } from "@/components/shared/layout/global-shortcuts";

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The viewer's role: only the shortcuts it can use are listed. */
  role?: string | null;
}

type Shortcut = {
  description: string;
  keys: string[];
  /** Hidden from roles that can't use it; none = everyone. */
  needs?: "tickets" | "billing";
};

const SHORTCUTS: Shortcut[] = [
  { description: "Focus search", keys: ["/"], needs: "tickets" },
  {
    description: "Go to ticket queue",
    keys: ["G", "then", "T"],
    needs: "tickets",
  },
  { description: "Go to billing", keys: ["G", "then", "B"], needs: "billing" },
  { description: "New ticket", keys: ["N"], needs: "tickets" },
  { description: "Assign selected to me", keys: ["A"], needs: "tickets" },
  { description: "Mark selected solved", keys: ["E"], needs: "tickets" },
  { description: "Reply to open ticket", keys: ["R"], needs: "tickets" },
  { description: "Close panel or dialog", keys: ["Esc"] },
];

export function KeyboardShortcutsModal({
  open,
  onOpenChange,
  role,
}: KeyboardShortcutsModalProps) {
  // Without a role (older callers) every shortcut shows, as before.
  const access = role === undefined ? null : shortcutAccess(role);
  const shortcuts = access
    ? SHORTCUTS.filter((s) => !s.needs || access[s.needs])
    : SHORTCUTS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The platform console's popup: icon header, roomy body, banded footer. */}
      <DialogContent
        className={`flex max-h-[85vh] flex-col sm:max-w-130 ${TEAM_DIALOG_CONTENT}`}
      >
        <DialogIconHeader
          icon={Keyboard}
          title="Keyboard shortcuts"
          description="Move around the workspace without reaching for the mouse."
          className="shrink-0"
        />

        <div className="overflow-y-auto min-h-0 flex-1 divide-y divide-border rounded-xl border border-border bg-card">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm"
            >
              <span className="font-medium text-slate-700 truncate min-w-0 pr-2">
                {shortcut.description}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {shortcut.keys.map((key, kIndex) =>
                  key === "then" ? (
                    <span
                      key={kIndex}
                      className="px-0.5 text-[10px] sm:text-xs font-normal text-slate-500"
                    >
                      then
                    </span>
                  ) : (
                    <kbd
                      key={kIndex}
                      className="inline-flex min-w-5 sm:min-w-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-1.5 sm:px-2 py-0.5 sm:py-1 font-mono text-[10px] sm:text-xs font-bold text-slate-800 shadow-xs"
                    >
                      {key}
                    </kbd>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter
          className={`shrink-0 ${TEAM_DIALOG_FOOTER} ${DIALOG_FOOTER_BAND}`}
        >
          <DialogClose asChild>
            <Button
              size="sm"
              className={`${TEAM_MODAL_BUTTON} ${TEAM_MODAL_BUTTON_PRIMARY}`}
            >
              Done
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
