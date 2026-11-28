"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Headset, Loader2, Send, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  formatSupportTime,
  SUPPORT_BODY_MAX,
  type SupportRequestDetail,
} from "../support";

type Viewer = "tenant" | "platform";

function Message({
  author,
  fromSupport,
  ownSide,
  time,
  body,
  label,
}: {
  author: string;
  fromSupport: boolean;
  ownSide: boolean;
  time: string;
  body: string;
  label?: string;
}) {
  const Icon = fromSupport ? Headset : User;

  return (
    <li className={cn("flex gap-2 sm:gap-3", ownSide && "flex-row-reverse")}>
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full sm:size-8",
          fromSupport
            ? "bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100"
            : "bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground",
        )}
        aria-hidden
      >
        <Icon className="size-3.5 sm:size-4" />
      </span>
      <div
        className={cn(
          "flex max-w-[88%] min-w-0 flex-col gap-1 sm:max-w-[80%]",
          ownSide && "items-end",
        )}
      >
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-500">
          <span className="font-semibold text-foreground">{author}</span>
          {label && <span>{label}</span>}
          <span>{time}</span>
        </p>
        <div
          className={cn(
            // A long message scrolls inside its own bubble, so one paste can't
            // push the rest of the conversation out of view.
            "max-h-72 overflow-y-auto overscroll-contain rounded-xl border px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] sm:max-h-80 sm:px-3.5 sm:py-2.5",
            ownSide
              ? "border-brand-700/20! bg-brand-50/70 text-foreground dark:bg-brand-700/10"
              : "border-border bg-slate-50/60 text-foreground dark:bg-muted/30",
          )}
        >
          {body}
        </div>
      </div>
    </li>
  );
}

/**
 * The opening description, then every reply. `viewer` puts that side's
 * messages on the right, as in a chat.
 */
export function SupportThread({
  request,
  viewer,
  className,
}: {
  request: SupportRequestDetail;
  viewer: Viewer;
  /** Overrides the scroll area's height. */
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const count = request.messages.length;

  // Keep the newest message in view when the thread opens or a reply lands.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [request.id, count]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "max-h-[60vh] min-h-0 overflow-y-auto overscroll-contain pr-1 sm:max-h-[32rem]",
        className,
      )}
    >
      <ol className="flex flex-col gap-4" aria-label="Conversation">
        <Message
          author={request.createdByName}
          fromSupport={false}
          ownSide={viewer === "tenant"}
          time={formatSupportTime(request.createdAt)}
          label="opened the request"
          body={request.description}
        />
        {request.messages.map((message) => {
          const fromSupport = message.authorType === "platform";

          return (
            <Message
              key={message.id}
              author={message.authorName}
              fromSupport={fromSupport}
              ownSide={fromSupport === (viewer === "platform")}
              time={formatSupportTime(message.createdAt)}
              body={message.body}
            />
          );
        })}
      </ol>
    </div>
  );
}

export function SupportReplyBox({
  requestId,
  disabledReason,
  placeholder,
  send,
  onSent,
}: {
  requestId: string;
  /** Set when replying isn't possible; shown instead of the box. */
  disabledReason?: string;
  placeholder: string;
  send: (input: {
    requestId: string;
    body: string;
  }) => Promise<{ ok: boolean; message?: string }>;
  onSent?: () => void;
}) {
  const [body, setBody] = useState("");
  const [isSending, startSending] = useTransition();

  if (disabledReason) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-slate-50/60 px-4 py-3 text-sm text-slate-500 dark:bg-muted/30">
        {disabledReason}
      </p>
    );
  }

  function submit() {
    const text = body.trim();

    if (!text) return;

    startSending(async () => {
      try {
        const result = await send({ requestId, body: text });

        if (!result.ok) {
          toast.error("Couldn't send your reply", {
            description: result.message,
          });
          return;
        }

        setBody("");
        toast.success("Reply sent");
        onSent?.();
      } catch {
        toast.error("Couldn't send your reply", {
          description: "Check your connection and try again.",
        });
      }
    });
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Label htmlFor="support-reply" className="text-sm font-semibold">
        Reply
      </Label>
      <Textarea
        id="support-reply"
        rows={4}
        value={body}
        maxLength={SUPPORT_BODY_MAX}
        placeholder={placeholder}
        className="max-h-60 min-h-24 resize-y rounded-lg"
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className="hidden text-xs text-slate-400 sm:inline">
          Ctrl + Enter to send
        </span>
        <Button
          type="submit"
          disabled={isSending || !body.trim()}
          className="h-10 w-full gap-2 rounded-lg bg-brand-accent px-4 font-semibold text-brand-accent-foreground shadow-none hover:bg-brand-accent/90 sm:w-auto"
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          Send reply
        </Button>
      </div>
    </form>
  );
}
