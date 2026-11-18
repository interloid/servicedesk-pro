"use client";

import {
  Loader2,
  Maximize2,
  Minimize2,
  SquarePen,
  SendHorizontal,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getChatUsageAction,
  sendChatMessageAction,
} from "@/features/chatbot/actions/chatbot.actions";
import {
  CHAT_HISTORY_MAX,
  CHAT_MESSAGE_MAX,
  CHAT_REPLY_MAX,
  chatStorageKey,
  STARTER_SUGGESTIONS,
  type ChatDraft,
  type ChatTurn,
  type ChatUsage,
} from "@/features/chatbot/chatbot";
import { ChatDraftCard } from "@/features/chatbot/components/chat-draft-card";
import { ChatWelcome } from "@/features/chatbot/components/chat-welcome";
import {
  ChatLauncher,
  ChatTeaser,
} from "@/features/chatbot/components/chat-launcher";
import {
  AssistantAvatar,
  ChatMessage,
  SuggestionChips,
  TypingIndicator,
  type ChatItem,
} from "@/features/chatbot/components/chat-messages";
import {
  ChatUsageMeter,
  remainingOf,
  resetTime,
} from "@/features/chatbot/components/chat-usage-meter";
import { PORTAL_ROUTES, portalPath } from "@/features/portal/portal";
import { cn } from "@/lib/utils";

type StoredChat = { items: ChatItem[]; draft: ChatDraft | null };

/** The thread page has its own composer in the bottom-right corner. */
const REQUEST_THREAD = /\/portal\/requests\/[0-9a-f-]{36}\/?$/i;

/**
 * How many px of the portal footer are on screen. The launcher and panel are
 * fixed to the viewport, so without this they slide over the footer once the
 * page is scrolled to the end; adding this to their `bottom` makes them rest
 * on top of it instead, following it as it scrolls in.
 */
function useFooterClearance(): number {
  const [clearance, setClearance] = useState(0);

  useEffect(() => {
    const footer = document.querySelector<HTMLElement>(
      "[data-portal-root] > footer",
    );
    if (!footer) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      // A hidden footer (phone, request thread) has an empty rect.
      const { top, height } = footer.getBoundingClientRect();
      const visible = height
        ? Math.max(0, Math.min(height, window.innerHeight - top))
        : 0;
      setClearance(Math.round(visible));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    measure();
    // Capture: <main> can be the scroller rather than the window.
    window.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    observer.observe(footer);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, []);

  return clearance;
}

const TEASER_KEY = "portal-chat:teaser-dismissed";
const TEASER_DELAY_MS = 2_500;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

/** Under Tailwind's `sm`, where the panel covers the whole screen. */
const isPhone = () => window.matchMedia("(max-width: 639px)").matches;

/**
 * The portal's support assistant: a launcher in the corner and a chat panel
 * above it (full screen on a phone, expandable on a desktop).
 *
 * The conversation lives in this tab only (sessionStorage), so it survives a
 * reload but not closing the tab. A request is never created by the
 * assistant: it hands back a draft, and Confirm submits it through the same
 * action as the New request form.
 */
export function PortalChatWidget({
  slug,
  customerId,
  customerName,
}: {
  slug: string;
  customerId: string;
  customerName: string;
}) {
  const pathname = usePathname();
  const storageKey = chatStorageKey(slug, customerId);
  const panelId = useId();
  const firstName = customerName.trim().split(/\s+/)[0] ?? "";

  const greeting: ChatItem = {
    id: "greeting",
    role: "assistant",
    local: true,
    text: `Hi${firstName ? ` ${firstName}` : ""} 👋 I can check on your requests, explain how this portal works, or help you raise a new request. What can I do for you?`,
    suggestions: STARTER_SUGGESTIONS,
  };

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [items, setItems] = useState<ChatItem[]>([greeting]);
  const [draft, setDraft] = useState<ChatDraft | null>(null);
  const [usage, setUsage] = useState<ChatUsage | null>(null);
  const [message, setMessage] = useState("");
  const [isSending, startSending] = useTransition();
  const [restored, setRestored] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const footerClearance = useFooterClearance();
  const clearanceStyle = {
    "--footer-clearance": `${footerClearance}px`,
  } as CSSProperties;

  // A one-time nudge, a moment after the first portal page of the session.
  useEffect(() => {
    let dismissed = true;

    try {
      dismissed = window.sessionStorage.getItem(TEASER_KEY) === "1";
    } catch {
      // No storage: skip the nudge rather than repeat it on every page.
    }

    if (dismissed) return;

    const timer = window.setTimeout(() => setTeaser(true), TEASER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!restored) return;

    try {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({ items, draft } satisfies StoredChat),
      );
    } catch {
      // Not saved; the chat still works for this page.
    }
  }, [items, draft, restored, storageKey]);

  // Keep the newest message in view -- inside the list only, never the page.
  useEffect(() => {
    const list = listRef.current;
    list?.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [items, draft, isSending, open, expanded]);

  // On a phone the panel covers the page; stop the page scrolling behind it.
  useEffect(() => {
    if (!open || !isPhone()) return;

    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";

    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    // preventScroll: focusing must not move the page under a fixed panel.
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  const onThreadPage = REQUEST_THREAD.test(pathname);

  if (onThreadPage && !open) {
    return null;
  }

  function dismissTeaser() {
    setTeaser(false);

    try {
      window.sessionStorage.setItem(TEASER_KEY, "1");
    } catch {
      // Shown again next page; harmless.
    }
  }

  function refreshUsage() {
    getChatUsageAction(slug)
      .then((result) => {
        if (result.success) setUsage(result.data);
      })
      .catch(() => {
        // The meter just stays as it was.
      });
  }

  // The layout keeps this mounted across portal pages; storage only matters
  // after a reload. It is read on the first open rather than on mount, so the
  // server render and the first client render agree. Storage can be missing or
  // blocked; the chat then starts fresh.
  function openPanel() {
    dismissTeaser();

    if (!restored) {
      try {
        const raw = window.sessionStorage.getItem(storageKey);
        const stored = raw ? (JSON.parse(raw) as StoredChat) : null;

        if (stored && Array.isArray(stored.items) && stored.items.length > 0) {
          setItems(stored.items);
          setDraft(stored.draft ?? null);
        }
      } catch {
        // Start fresh.
      }

      setRestored(true);
    }

    refreshUsage();
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
    requestAnimationFrame(() =>
      launcherRef.current?.focus({ preventScroll: true }),
    );
  }

  function append(item: Omit<ChatItem, "id">) {
    setItems((current) => [...current, { ...item, id: newId() }]);
  }

  /** Sends the conversation as it stands (its last line is the customer's). */
  function dispatch(conversation: ChatItem[]) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      append({
        role: "assistant",
        text: "You seem to be offline. Check your connection, then try again.",
        error: { code: "offline" },
      });
      return;
    }

    // Only real conversation goes to the model: no greeting, no error lines.
    const transcript: ChatTurn[] = conversation
      .filter((item) => !item.local && !item.error)
      .map(({ role, text }) => ({
        role,
        // Long replies go back cut; the server cuts them too (CHAT_REPLY_MAX).
        text: role === "assistant" ? text.slice(0, CHAT_REPLY_MAX) : text,
      }))
      .slice(-CHAT_HISTORY_MAX);

    startSending(async () => {
      try {
        const result = await sendChatMessageAction(slug, transcript);

        if (!result.success) {
          append({
            role: "assistant",
            text: result.message,
            error: { code: result.code },
          });

          if (result.code === "rate_limited") refreshUsage();
          return;
        }

        setUsage(result.data.usage);
        append({
          role: "assistant",
          text: result.data.reply,
          suggestions: result.data.suggestions,
          attachments: result.data.attachments,
          profile: result.data.profile,
        });

        if (result.data.draft) {
          setDraft(result.data.draft);
        }
      } catch {
        append({
          role: "assistant",
          text: "The assistant couldn't be reached. Check your connection and try again.",
          error: { code: "network" },
        });
      }
    });
  }

  const remaining = remainingOf(usage);
  const exhausted = remaining === 0;

  function send(text: string) {
    const trimmed = text.trim();

    if (
      !trimmed ||
      isSending ||
      exhausted ||
      trimmed.length > CHAT_MESSAGE_MAX
    ) {
      return;
    }

    const next = [
      ...items,
      { id: newId(), role: "user" as const, text: trimmed },
    ];

    setItems(next);
    setMessage("");
    dispatch(next);
  }

  /** Drops the failed line and sends the same conversation again. */
  function retry(failedId: string) {
    if (isSending || exhausted) return;

    const next = items.filter((item) => item.id !== failedId);

    setItems(next);
    dispatch(next);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    send(message);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      send(message);
    }
  }

  function discardDraft() {
    setDraft(null);
    // Said as the assistant so the model knows on the next turn.
    append({
      role: "assistant",
      text: "Okay, I've discarded that draft.",
      suggestions: ["Report a new problem", "Show my open requests"],
    });
  }

  function onCreated(
    number: number | null,
    subject: string,
    note: string | null,
  ) {
    setDraft(null);
    append({
      role: "assistant",
      text: `✅ Created request ${number ? `**#${number}**` : ""} — ${subject}.\n\n${
        note ?? "The support team will reply on the request page."
      } You can follow it in [your requests](${portalPath(slug, PORTAL_ROUTES.REQUESTS)}).`,
      suggestions: ["Show my open requests"],
    });
  }

  function reset() {
    setItems([greeting]);
    setDraft(null);
    setMessage("");
    inputRef.current?.focus({ preventScroll: true });
  }

  const last = items.at(-1);
  const suggestions =
    !isSending &&
    !draft &&
    !exhausted &&
    last?.role === "assistant" &&
    !last.error
      ? (last.suggestions ?? [])
      : [];
  const nearLimit = message.length > CHAT_MESSAGE_MAX * 0.8;
  // A fresh chat holds only the greeting: show the welcome screen instead.
  const welcome =
    !draft && !isSending && items.length === 1 && items[0]?.id === "greeting";
  const resets = resetTime(usage);

  return (
    <>
      {open ? (
        <section
          id={panelId}
          role="dialog"
          aria-label="Support assistant"
          onKeyDown={(event) => {
            if (event.key === "Escape") closePanel();
          }}
          style={clearanceStyle}
          className={cn(
            "fixed inset-0 z-50 flex flex-col overflow-hidden bg-background",
            "animate-in duration-200 fade-in-0 sm:slide-in-from-bottom-3 sm:zoom-in-95",
            "sm:inset-auto sm:right-6 sm:bottom-[calc(6rem+var(--footer-clearance))] sm:origin-bottom-right sm:rounded-3xl sm:border",
            "sm:shadow-[0_24px_60px_-12px_rgba(15,23,42,0.35)] sm:transition-[width,height] sm:duration-200",
            expanded
              ? "sm:h-[calc(100dvh-8rem-var(--footer-clearance))] sm:w-[min(56rem,calc(100vw-3rem))]"
              : "sm:h-[min(44rem,calc(100dvh-8rem-var(--footer-clearance)))] sm:w-[min(30rem,calc(100vw-3rem))]",
          )}
        >
          <header className="relative flex shrink-0 items-center gap-3 overflow-hidden bg-brand-accent px-4 py-3.5 text-brand-accent-foreground">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/20 via-transparent to-black/10"
            />
            <span className="relative">
              <AssistantAvatar size="md" />
              <span
                aria-hidden
                className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-brand-accent bg-emerald-400"
              />
            </span>
            <div className="relative min-w-0 flex-1">
              <h2 className="truncate text-sm leading-tight font-semibold">
                Support assistant
              </h2>
              <p className="truncate text-xs text-current/75">
                Online · usually replies in seconds
              </p>
            </div>
            <HeaderButton label="New chat" onClick={reset}>
              <SquarePen className="size-4" />
            </HeaderButton>
            <HeaderButton
              label={expanded ? "Shrink" : "Expand"}
              onClick={() => setExpanded((value) => !value)}
              className="hidden sm:inline-flex"
            >
              {expanded ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </HeaderButton>
            <HeaderButton label="Close" onClick={closePanel}>
              <X className="size-4" />
            </HeaderButton>
          </header>

          <div
            ref={listRef}
            // overscroll-contain: reaching the end of the chat must not start
            // scrolling the page behind it.
            className="flex-1 overflow-y-auto overscroll-contain bg-muted/25 px-3 py-4 sm:px-4"
            aria-live="polite"
          >
            <div
              className={cn(
                "mx-auto flex flex-col gap-4",
                expanded && "max-w-3xl",
              )}
            >
              <p className="mx-auto flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5" aria-hidden />
                AI assistant · can make mistakes · nothing is submitted until
                you confirm
              </p>

              {welcome ? (
                <ChatWelcome
                  firstName={firstName}
                  onPick={send}
                  disabled={exhausted}
                />
              ) : (
                items.map((item) => (
                  <ChatMessage
                    key={item.id}
                    item={item}
                    slug={slug}
                    onRetry={() => retry(item.id)}
                    retryDisabled={isSending}
                  />
                ))
              )}

              {draft ? (
                <ChatDraftCard
                  // A new draft from the assistant starts the card over.
                  key={`${draft.subject}\n${draft.description}`}
                  slug={slug}
                  draft={draft}
                  onChange={setDraft}
                  onDiscard={discardDraft}
                  onCreated={onCreated}
                />
              ) : null}

              {isSending ? <TypingIndicator /> : null}

              {!welcome && suggestions.length > 0 ? (
                <SuggestionChips suggestions={suggestions} onPick={send} />
              ) : null}
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            className="shrink-0 border-t bg-background px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
          >
            <div
              className={cn(
                "mx-auto flex items-end gap-2 rounded-2xl border bg-background p-1.5 pl-3 shadow-xs transition-shadow",
                "focus-within:border-brand-accent/60 focus-within:ring-3 focus-within:ring-brand-accent/15",
                exhausted && "bg-muted/40",
                expanded && "max-w-3xl",
              )}
            >
              <Textarea
                ref={inputRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={onKeyDown}
                maxLength={CHAT_MESSAGE_MAX}
                rows={1}
                disabled={exhausted}
                placeholder={
                  exhausted
                    ? `Daily limit reached${resets ? ` · back at ${resets}` : ""}`
                    : "Ask about a request, or describe a problem…"
                }
                aria-label="Message"
                className="max-h-36 min-h-9 resize-none border-0 bg-transparent px-0 py-1.5 shadow-none focus-visible:ring-0 disabled:bg-transparent dark:bg-transparent"
              />
              <Button
                type="submit"
                size="icon-lg"
                className="shrink-0 rounded-xl"
                disabled={isSending || exhausted || !message.trim()}
                aria-label="Send"
              >
                {isSending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <SendHorizontal />
                )}
              </Button>
            </div>

            <div
              className={cn(
                "mx-auto mt-2 flex min-h-4 items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground",
                expanded && "max-w-3xl",
              )}
            >
              <ChatUsageMeter usage={usage} />
              {exhausted ? (
                <Link
                  href={portalPath(slug, PORTAL_ROUTES.NEW_REQUEST)}
                  className="shrink-0 font-semibold text-brand-ink underline underline-offset-2"
                >
                  Raise a request instead
                </Link>
              ) : (
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    !nearLimit && "hidden sm:inline",
                    nearLimit && "font-medium text-destructive",
                  )}
                >
                  {nearLimit
                    ? `${message.length} / ${CHAT_MESSAGE_MAX}`
                    : "Shift+Enter for a new line"}
                </span>
              )}
            </div>
          </form>
        </section>
      ) : null}

      {/* The launcher hides on the thread page, whose composer sits here. */}
      {!onThreadPage ? (
        // A column: the teaser sits above the launcher, both right-aligned,
        // so neither can cover the other at any width.
        // Rests on the footer once it scrolls into view, never over it.
        <div
          style={clearanceStyle}
          className="fixed right-4 bottom-[calc(1rem+var(--footer-clearance))] z-50 flex flex-col items-end gap-3 sm:right-6 sm:bottom-[calc(1.5rem+var(--footer-clearance))]"
        >
          {teaser && !open ? (
            <ChatTeaser
              firstName={firstName}
              onOpen={openPanel}
              onDismiss={dismissTeaser}
            />
          ) : null}
          <ChatLauncher
            ref={launcherRef}
            open={open}
            panelId={panelId}
            onToggle={open ? closePanel : openPanel}
          />
        </div>
      ) : null}
    </>
  );
}

function HeaderButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex size-8 items-center justify-center rounded-lg text-current/85 transition-colors outline-none hover:bg-current/15 hover:text-current focus-visible:ring-2 focus-visible:ring-current/60",
        className,
      )}
    >
      {children}
    </button>
  );
}
