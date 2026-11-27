"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, FileText } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRelativeTime, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

import { TEAM_DIALOG_TITLE } from "@/features/team/components/modal-buttons";
import { AUDIT_ACTION_ICONS } from "@/features/audit/components/audit-icons";
import {
  AUDIT_ACTION_BADGE,
  AUDIT_ACTION_LABELS,
  AUDIT_MODULE_BADGE,
  AUDIT_MODULE_LABELS,
  AUDIT_RESULT_BADGE,
  AUDIT_RESULT_LABELS,
  formatAuditTimestamp,
  type AuditEvent,
} from "@/features/audit/types/audit";

export async function copyText(value: string, what: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    toast.error(`Couldn't copy the ${what.toLowerCase()}`, {
      description: "Select the text and copy it yourself instead.",
    });
    return false;
  }
}

const COPIED_MS = 2000;

/** Copy, then report `copied` for two seconds so the button can show a tick. */
function useCopy(value: string, what: string) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    if (!(await copyText(value, what))) return;
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return { copied, copy };
}

function CopyButton({ value, what }: { value: string; what: string }) {
  const { copied, copy } = useCopy(value, what);
  const Icon = copied ? Check : Copy;

  return (
    <Button
      variant="outline"
      size="icon"
      className="size-7 shrink-0 rounded-md shadow-none"
      aria-label={copied ? `${what} copied` : `Copy ${what.toLowerCase()}`}
      onClick={copy}
    >
      <Icon
        className={cn("size-3.5", copied && "text-emerald-600")}
        aria-hidden
      />
    </Button>
  );
}

function Row({
  label,
  children,
  stacked,
}: {
  label: string;
  children: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "gap-2 px-3.5 py-3",
        stacked
          ? "flex flex-col"
          : "grid grid-cols-[5.5rem_minmax(0,1fr)] items-center sm:grid-cols-[7rem_minmax(0,1fr)]",
      )}
    >
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

/** A small uppercase label over a block of the popup. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
      {children}
    </h3>
  );
}

/**
 * Everything recorded about one event: the inside of the details popup -- its
 * header and a scrolling body. The caller supplies the
 * Dialog and its DialogContent (with TEAM_DIALOG_CONTENT), so it looks like
 * every other popup in the app; the dialog's own cross closes it.
 */
export function AuditEventDetails({
  event,
  timeZone,
  now,
}: {
  event: AuditEvent;
  timeZone: string;
  now: number;
}) {
  const ActionIcon = AUDIT_ACTION_ICONS[event.action];
  const relative = formatRelativeTime(event.createdAt, now);
  const failed = event.result === "failure";

  return (
    <>
      <DialogHeader className="min-w-0 pr-6">
        <DialogTitle className={cn(TEAM_DIALOG_TITLE, "font-heading")}>
          Event details
        </DialogTitle>
        <DialogDescription>
          Everything recorded about this event.
        </DialogDescription>
      </DialogHeader>

      {/* Only the body scrolls: the title stays in view. */}
      <div className="-mx-5 flex max-h-[60vh] min-h-0 min-w-0 flex-col gap-5 overflow-x-hidden overflow-y-auto px-5 pb-1">
        {/* What happened, when, and its result, module and action at a glance. */}
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border p-4",
            failed
              ? "border-red-200! bg-red-50/50 dark:border-red-900/60! dark:bg-red-950/20"
              : "border-border bg-slate-50/70 dark:bg-muted/30",
          )}
        >
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full",
              failed
                ? "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300"
                : "bg-brand-50 text-brand-700 dark:bg-emerald-950/60 dark:text-emerald-300",
            )}
          >
            <ActionIcon className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="min-w-0">
              <p className="font-heading font-bold break-words text-foreground">
                {event.summary}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatAuditTimestamp(event.createdAt, timeZone)}
                {relative ? ` (${relative})` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge className={AUDIT_RESULT_BADGE[event.result]}>
                {AUDIT_RESULT_LABELS[event.result]}
              </Badge>
              <Badge className={AUDIT_MODULE_BADGE[event.module]}>
                {AUDIT_MODULE_LABELS[event.module]}
              </Badge>
              <Badge className={cn("gap-1", AUDIT_ACTION_BADGE[event.action])}>
                <ActionIcon className="size-3" aria-hidden />
                {AUDIT_ACTION_LABELS[event.action]}
              </Badge>
            </div>
          </div>
        </div>

        {event.changes.length > 0 && (
          <section>
            <SectionTitle>Changes</SectionTitle>
            <ul className="flex flex-col divide-y divide-slate-100! overflow-hidden rounded-xl border border-border">
              {event.changes.map((change) => (
                <li
                  key={change.field}
                  className="flex flex-col gap-1.5 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-3"
                >
                  <span className="shrink-0 text-xs font-medium text-slate-500 sm:w-28">
                    {change.label}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 break-words text-slate-600 line-through decoration-slate-400/70 dark:bg-muted">
                      {change.from || "—"}
                    </span>
                    <ArrowRight
                      className="size-3.5 shrink-0 text-slate-400"
                      aria-hidden
                    />
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-medium break-words text-emerald-700 ring-1 ring-emerald-600/15 ring-inset dark:bg-emerald-950/40 dark:text-emerald-300">
                      {change.to || "—"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <SectionTitle>Information</SectionTitle>
          <dl className="flex flex-col divide-y divide-slate-100! rounded-xl border border-border">
            <Row label="User">
              {event.actor ? (
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar className="size-8">
                    {event.actor.avatarUrl && (
                      <AvatarImage src={event.actor.avatarUrl} alt="" />
                    )}
                    <AvatarFallback className="text-xs font-semibold">
                      {getInitials(event.actor.name, event.actor.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{event.actor.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {event.actor.role ?? event.actor.email}
                    </p>
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground">System</span>
              )}
            </Row>

            <Row label="IP address">
              {event.ip ? (
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 font-mono text-[13px] break-all">
                    {event.ip}
                  </span>
                  <CopyButton value={event.ip} what="IP address" />
                </div>
              ) : (
                <span className="text-muted-foreground">Not recorded</span>
              )}
            </Row>

            <Row label="Event ID">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 font-mono text-[13px] break-all">
                  {event.id}
                </span>
                <CopyButton value={event.id} what="Event ID" />
              </div>
            </Row>

            <Row label="User agent" stacked>
              {event.userAgent ? (
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-xs break-all text-muted-foreground">
                    {event.userAgent}
                  </span>
                  <CopyButton value={event.userAgent} what="User agent" />
                </div>
              ) : (
                <span className="text-muted-foreground">Not recorded</span>
              )}
            </Row>
          </dl>
        </section>

        {event.related && (
          <section>
            <SectionTitle>Related resource</SectionTitle>
            <div className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <FileText className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="text-sm font-medium">{event.related.label}</span>
              <span className="ml-auto min-w-0 truncate font-mono text-xs text-slate-500">
                {event.related.value}
              </span>
              <CopyButton value={event.related.value} what="Resource ID" />
            </div>
          </section>
        )}
      </div>
    </>
  );
}
