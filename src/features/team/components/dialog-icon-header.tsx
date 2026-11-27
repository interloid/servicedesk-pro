import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { TEAM_DIALOG_TITLE } from "./modal-buttons";

/**
 * The platform console's dialog header (see plans-manager.tsx): a round tinted
 * icon beside the title in the heading face and a line of description. Pass a
 * red tint for confirmations of something destructive.
 */
export function DialogIconHeader({
  icon: Icon,
  tint = "bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100",
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  tint?: string;
  title: ReactNode;
  description: ReactNode;
  className?: string;
}) {
  return (
    <DialogHeader
      className={cn("flex-row items-start gap-3.5 pr-6 text-left", className)}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          tint,
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <DialogTitle className={cn(TEAM_DIALOG_TITLE, "font-heading")}>
          {title}
        </DialogTitle>
        <DialogDescription className="leading-relaxed">
          {description}
        </DialogDescription>
      </div>
    </DialogHeader>
  );
}

/** The red tint for a destructive confirmation's icon circle. */
export const DIALOG_DANGER_TINT =
  "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400";

/** A small uppercase label over a group of fields. */
export function DialogSectionLabel({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
        {children}
      </p>
      {aside && <span className="text-xs text-slate-400">{aside}</span>}
    </div>
  );
}

/** Tints the full-bleed footer (TEAM_DIALOG_FOOTER) into a pale band. */
export const DIALOG_FOOTER_BAND =
  "rounded-b-xl bg-slate-50/60 dark:bg-muted/20";
