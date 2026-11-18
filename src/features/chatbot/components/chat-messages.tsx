"use client";

import {
  BotMessageSquare,
  CircleAlert,
  RotateCcw,
  Sparkles,
  WifiOff,
} from "lucide-react";
import Link from "next/link";

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
          : "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-accent-foreground shadow-xs"
      }
    >
      <BotMessageSquare
        className={size === "md" ? "size-5" : "size-4"}
        aria-hidden
      />
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
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-accent px-3.5 py-2 text-sm whitespace-pre-wrap text-brand-accent-foreground shadow-xs">
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
          className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-destructive/25 bg-destructive/5 px-3.5 py-2.5 text-sm"
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
      <div className="min-w-0 flex-1 space-y-2">
        <div className="w-fit max-w-full rounded-2xl rounded-tl-md border bg-background px-3.5 py-2.5 text-sm text-foreground/90 shadow-xs">
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
  return (
    <div className="flex flex-wrap gap-2 pl-9.5">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onPick(suggestion)}
          className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-xs transition-all hover:-translate-y-px hover:border-brand-accent/50 hover:bg-brand-accent/5"
        >
          <Sparkles className="size-3 text-brand-ink opacity-70" aria-hidden />
          {suggestion}
        </button>
      ))}
    </div>
  );
}
