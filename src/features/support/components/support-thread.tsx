"use client";

import { useState, useTransition } from "react";
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
    <li className={cn("flex gap-3", ownSide && "flex-row-reverse")}>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          fromSupport
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <div
        className={cn(
          "flex max-w-[85%] min-w-0 flex-col gap-1",
          ownSide && "items-end",
        )}
      >
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{author}</span>
          {label && <span>{label}</span>}
          <span>{time}</span>
        </p>
        <div
          className={cn(
            "rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap",
            ownSide
              ? "border-primary/20 bg-primary/5 text-foreground"
              : "border-border bg-card text-foreground",
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
}: {
  request: SupportRequestDetail;
  viewer: Viewer;
}) {
  return (
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
      <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
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
          toast.error(result.message ?? "We couldn't send that reply.");
          return;
        }

        setBody("");
        toast.success("Reply sent.");
        onSent?.();
      } catch {
        toast.error("We couldn't send that reply. Check your connection.");
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
        className="resize-y"
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          Ctrl + Enter to send
        </span>
        <Button
          type="submit"
          disabled={isSending || !body.trim()}
          className="h-10 gap-2 rounded-lg bg-brand-accent px-4 font-semibold text-brand-accent-foreground shadow-none hover:bg-brand-accent/90"
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
