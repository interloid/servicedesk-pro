"use client";

import { ChevronDown, MessageCircle, X } from "lucide-react";
import type { Ref } from "react";

import { cn } from "@/lib/utils";

/**
 * The floating button in the corner. It stays put while the panel is open and
 * becomes its close button (except on a phone, where the panel is full screen
 * and has its own). A flat circle in the brand colour with a chat bubble: the
 * familiar "message us" button, nothing more.
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
      aria-label={open ? "Close support chat" : "Open support chat"}
      className={cn(
        "relative inline-flex size-14 shrink-0 items-center justify-center rounded-full",
        "bg-brand-accent text-brand-accent-foreground",
        "shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)]",
        "transition-[transform,background-color] duration-200 outline-none hover:bg-brand-accent/90 active:scale-95",
        "focus-visible:ring-4 focus-visible:ring-brand-accent/30",
        open && "max-sm:hidden",
      )}
    >
      <MessageCircle
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
        className="block w-full rounded-xl border bg-background px-4 py-3 text-left text-sm shadow-[0_8px_24px_-12px_rgba(15,23,42,0.3)] transition-colors hover:bg-muted"
      >
        <span className="block font-semibold text-foreground">
          {firstName ? `Hi ${firstName}, need a hand?` : "Need a hand?"}
        </span>
        <span className="mt-0.5 block text-muted-foreground">
          Ask about a request, or get help raising a new one.
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
