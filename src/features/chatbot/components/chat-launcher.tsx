"use client";

import { BotMessageSquare, ChevronDown, X } from "lucide-react";
import type { Ref } from "react";

import { cn } from "@/lib/utils";

/**
 * The floating button in the corner. It stays put while the panel is open and
 * becomes its close button (except on a phone, where the panel is full screen
 * and has its own).
 */
export function ChatLauncher({
  ref,
  open,
  panelId,
  onToggle,
}: {
  ref?: Ref<HTMLButtonElement>;
  open: boolean;
  panelId: string;
  onToggle: () => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      aria-controls={panelId}
      aria-expanded={open}
      aria-label={open ? "Close support assistant" : "Open support assistant"}
      className={cn(
        "group relative inline-flex size-14 shrink-0 items-center justify-center rounded-full",
        "bg-brand-accent text-brand-accent-foreground",
        "shadow-[0_14px_34px_-10px_rgba(15,23,42,0.55)] ring-1 ring-black/5",
        "transition-all duration-200 outline-none hover:scale-105 hover:shadow-[0_18px_40px_-10px_rgba(15,23,42,0.6)] active:scale-95",
        "focus-visible:ring-4 focus-visible:ring-brand-accent/35",
        open && "max-sm:hidden",
      )}
    >
      {/* Sheen and a soft inner edge: depth on any brand colour. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-linear-to-br from-white/30 via-white/5 to-black/15"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-px rounded-full ring-1 ring-white/20 ring-inset"
      />

      <BotMessageSquare
        aria-hidden
        className={cn(
          "absolute size-6 transition-all duration-200",
          open
            ? "scale-50 rotate-90 opacity-0"
            : "scale-100 rotate-0 opacity-100",
        )}
      />
      <ChevronDown
        aria-hidden
        className={cn(
          "absolute size-6 transition-all duration-200",
          open
            ? "scale-100 rotate-0 opacity-100"
            : "scale-50 -rotate-90 opacity-0",
        )}
      />

      {!open ? (
        <span
          aria-hidden
          className="absolute top-0.5 right-0.5 size-3.5 rounded-full border-2 border-background bg-emerald-500"
        />
      ) : null}
    </button>
  );
}

/** A one-time nudge, stacked above the launcher. */
export function ChatTeaser({
  firstName,
  onOpen,
  onDismiss,
}: {
  firstName: string;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="relative w-[min(17rem,calc(100vw-2rem))] animate-in duration-300 fade-in slide-in-from-bottom-2">
      {/* Solid on hover too: a see-through bubble shows the page behind it. */}
      <button
        type="button"
        onClick={onOpen}
        className="block w-full rounded-2xl rounded-br-sm border bg-background px-4 py-3 text-left text-sm shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] transition-[background-color,border-color,box-shadow] hover:border-brand-accent/40 hover:bg-muted hover:shadow-[0_16px_36px_-12px_rgba(15,23,42,0.45)]"
      >
        <span className="block font-semibold text-foreground">
          Hi{firstName ? ` ${firstName}` : ""} 👋
        </span>
        <span className="mt-0.5 block text-muted-foreground">
          Questions about a request? I can look it up or help you raise a new
          one.
        </span>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute -top-2 -left-2 inline-flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
