"use client";

import {
  Download,
  ExternalLink,
  File,
  FileImage,
  FileText,
  ZoomIn,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChatAttachment } from "@/features/chatbot/chatbot";
import { formatBytes } from "@/features/portal/portal";
import { cn } from "@/lib/utils";

/**
 * Files on a request the assistant looked up: images as thumbnails that open
 * full size, everything else as download cards.
 *
 * Every URL here came from the server (a signed Storage link for this
 * customer's own request), never from the model. The links last an hour, so
 * a card read back from an older conversation points to the request page.
 */
export function ChatAttachments({
  attachments,
}: {
  attachments: ChatAttachment[];
}) {
  // Read once, when the list appears: whether the signed links still work.
  const [now] = useState(() => Date.now());

  const isLive = (attachment: ChatAttachment) =>
    attachment.url !== null && Date.parse(attachment.expiresAt) > now;

  const images = attachments.filter(
    (attachment) => attachment.mime.startsWith("image/") && isLive(attachment),
  );
  const files = attachments.filter(
    (attachment) => !images.includes(attachment),
  );

  return (
    <div className="space-y-1.5">
      {images.length > 0 ? (
        <ul
          aria-label="Images"
          className={cn(
            "grid gap-1.5",
            images.length === 1 ? "max-w-xs grid-cols-1" : "grid-cols-2",
          )}
        >
          {images.map((attachment, index) => (
            <li key={`${attachment.requestUrl}-${attachment.name}-${index}`}>
              <ImagePreview attachment={attachment} />
            </li>
          ))}
        </ul>
      ) : null}

      {files.length > 0 ? (
        <ul aria-label="Files" className="grid gap-1.5 sm:grid-cols-2">
          {files.map((attachment, index) => (
            <li key={`${attachment.requestUrl}-${attachment.name}-${index}`}>
              <FileCard attachment={attachment} live={isLive(attachment)} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function where(attachment: ChatAttachment): string {
  return attachment.requestNumber
    ? `#${attachment.requestNumber}`
    : "the request";
}

/** A thumbnail; a click opens it full size. Falls back to a file card. */
function ImagePreview({ attachment }: { attachment: ChatAttachment }) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (broken) {
    return <FileCard attachment={attachment} live />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-brand-accent/40"
        aria-label={`View ${attachment.name}`}
      >
        {!loaded ? (
          <span
            className="absolute inset-0 animate-pulse bg-muted"
            aria-hidden
          />
        ) : null}
        {/* A signed Storage URL that expires: next/image's optimiser would
            cache it under a URL that stops working, so a plain img it is. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url!}
          alt={attachment.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
          className={cn(
            "size-full object-cover transition-transform duration-300 group-hover:scale-105",
            !loaded && "opacity-0",
          )}
        />
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-6 pb-1.5 text-left text-[11px] font-medium text-white">
          <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
          <ZoomIn className="size-3.5 shrink-0 opacity-80" aria-hidden />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(64rem,calc(100vw-2rem))] gap-3 p-3 sm:max-w-[min(64rem,calc(100vw-2rem))] sm:p-4">
          <DialogTitle className="truncate pr-8 text-sm">
            {attachment.name}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Image attached to request {where(attachment)}
          </DialogDescription>

          <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-lg bg-muted/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.url!}
              alt={attachment.name}
              referrerPolicy="no-referrer"
              className="max-h-[70vh] w-auto max-w-full object-contain"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {formatBytes(attachment.size)} · from {where(attachment)}
            </span>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={attachment.requestUrl}>
                  <ExternalLink /> Open request
                </Link>
              </Button>
              <Button asChild size="sm">
                <a
                  href={attachment.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={attachment.name}
                >
                  <Download /> Download
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FileIcon({ mime }: { mime: string }) {
  const className = "size-4.5";

  if (mime.startsWith("image/")) {
    return <FileImage className={className} aria-hidden />;
  }

  if (mime === "application/pdf" || mime.startsWith("text/")) {
    return <FileText className={className} aria-hidden />;
  }

  return <File className={className} aria-hidden />;
}

/** One file with its download link, or a link to the request once expired. */
function FileCard({
  attachment,
  live,
}: {
  attachment: ChatAttachment;
  live: boolean;
}) {
  const body = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-ink">
        <FileIcon mime={attachment.mime} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground">
          {attachment.name}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {formatBytes(attachment.size)} ·{" "}
          {live
            ? `from ${where(attachment)}`
            : `open ${where(attachment)} to download`}
        </span>
      </span>
      {live ? (
        <Download
          className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brand-ink"
          aria-hidden
        />
      ) : null}
    </>
  );

  const className =
    "group flex items-center gap-2.5 rounded-xl border bg-background p-2 pr-3 text-foreground shadow-xs transition-colors hover:border-brand-accent/40 hover:bg-brand-accent/5 hover:text-foreground";

  return live ? (
    <a
      href={attachment.url!}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.name}
      className={className}
      title={`Download ${attachment.name}`}
    >
      {body}
    </a>
  ) : (
    <Link href={attachment.requestUrl} className={className}>
      {body}
    </Link>
  );
}
