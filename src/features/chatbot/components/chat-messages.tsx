"use client";

import {
  CircleAlert,
  CornerDownRight,
  Headset,
  RotateCcw,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import type {
  ChatAttachment,
  ChatProfile,
  ChatTurn,
} from "@/features/chatbot/chatbot";
import { ChatAttachments } from "@/features/chatbot/components/chat-attachments";
import { ChatMarkdown } from "@/features/chatbot/components/chat-markdown";
import { ChatProfileCard } from "@/features/chatbot/components/chat-profile-card";
import {
  PORTAL_ROUTES,
  portalPath,
  type PortalFailureCode,
} from "@/features/portal/portal";

export type ChatItem = ChatTurn & {
  id: string;
  /** Shown in the list but never sent to the model (the greeting). */
  local?: boolean;
  /** A failed turn. Never sent to the model; may offer a retry. */
  error?: { code: PortalFailureCode | "offline" | "network" };
  /** Follow-up chips; only the latest reply's are shown. */
  suggestions?: string[];
  /** Download cards under the reply (from the server, not the model). */
  attachments?: ChatAttachment[];
  /** The customer's own profile card under the reply (from the server). */
  profile?: ChatProfile | null;
};

/** Failures a retry cannot fix: a bad message, a limit, a lost session. */
const NOT_RETRYABLE = new Set(["validation", "not_signed_in", "rate_limited"]);

export function AssistantAvatar({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={
        size === "md"
          ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-current/15"
          : "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-brand-ink"
      }
    >
      <Headset className={size === "md" ? "size-5" : "size-4"} aria-hidden />
    </span>
  );
}

export function ChatMessage({
  item,
  slug,
  onRetry,
  retryDisabled,
}: {
  item: ChatItem;
  slug: string;
  onRetry: () => void;
  retryDisabled: boolean;
}) {
  if (item.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-tr-md bg-brand-accent px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-brand-accent-foreground shadow-xs">
          {item.text}
        </p>
      </div>
    );
  }

  if (item.error) {
    const { code } = item.error;

    return (
      <div className="flex gap-2.5">
        <AssistantAvatar />
        <div
          role="alert"
          className="max-w-[85%] min-w-0 rounded-2xl rounded-tl-md border border-destructive/25 bg-destructive/5 px-3.5 py-2.5 text-sm leading-relaxed"
        >
          <p className="flex items-start gap-2 text-destructive">
            {code === "offline" ? (
              <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <span>{item.text}</span>
          </p>
          {code === "not_signed_in" ? (
            <Link
              href={portalPath(slug, PORTAL_ROUTES.LOGIN)}
              className="mt-2 inline-block text-xs font-semibold text-brand-ink underline underline-offset-2"
            >
              Sign in again
            </Link>
          ) : !NOT_RETRYABLE.has(code) ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={onRetry}
              disabled={retryDisabled}
            >
              <RotateCcw /> Try again
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <AssistantAvatar />
      {/* Same padding and corner as the customer's bubble, mirrored: the
          tail corner is top-left here, top-right there. */}
      <div className="min-w-0 flex-1 space-y-2 pr-[8%]">
        <div className="w-fit max-w-full rounded-2xl rounded-tl-md border bg-background px-3.5 py-2.5 text-sm leading-relaxed text-foreground/90 shadow-xs">
          <ChatMarkdown text={item.text} />
        </div>
        {item.attachments && item.attachments.length > 0 ? (
          <ChatAttachments attachments={item.attachments} />
        ) : null}
        {item.profile ? <ChatProfileCard profile={item.profile} /> : null}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div
      className="flex gap-2.5"
      role="status"
      aria-label="Assistant is typing"
    >
      <AssistantAvatar />
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border bg-background px-4 py-3 shadow-xs">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SuggestionChips({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (suggestion: string) => void;
}) {
  const labelId = useId();

  return (
    <div role="group" aria-labelledby={labelId} className="pl-9.5">
      <p
        id={labelId}
        className="mb-1.5 text-[11px] font-medium text-muted-foreground"
      >
        Suggested replies
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-accent/35 bg-background py-1.5 pr-3 pl-2.5 text-xs font-medium text-brand-ink shadow-xs transition-[background-color,border-color,transform] outline-none hover:border-brand-accent hover:bg-brand-accent/8 focus-visible:border-brand-accent focus-visible:ring-3 focus-visible:ring-brand-accent/25 active:scale-[0.97]"
          >
            <CornerDownRight aria-hidden className="size-3.5 opacity-60" />
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
