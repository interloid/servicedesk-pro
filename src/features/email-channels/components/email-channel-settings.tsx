"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Inbox,
  Loader2,
  PlugZap,
  RefreshCw,
  RotateCcw,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TENANT_ROUTES, tenantPath } from "@/lib/tenancy";
import { cn } from "@/lib/utils";

import { GmailLogo } from "@/features/email-channels/components/channel-logos";
import {
  disconnectEmailChannelAction,
  retryInboundEmailAction,
  startGmailConnectAction,
  syncEmailChannelAction,
  updateEmailChannelAction,
} from "@/features/email-channels/actions/email-channels.actions";
import {
  CONNECT_RESULT_MESSAGES,
  GMAIL_CHANNEL_PATH,
  IGNORE_REASON_LABELS,
  displayStatus,
  type EmailChannelDisplayStatus,
  type EmailChannelPageData,
  type InboundEmail,
} from "@/features/email-channels/email-channels";

const STATUS_COPY: Record<
  EmailChannelDisplayStatus,
  { label: string; className: string }
> = {
  connected: {
    label: "Connected",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  syncing: {
    label: "Syncing",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  expired: {
    label: "Connection expired",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  error: { label: "Error", className: "bg-red-50 text-red-700 border-red-200" },
  disconnected: {
    label: "Disconnected",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

export function relative(value: string | null): string {
  if (!value) return "Never";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

export function StatusBadge({ status }: { status: EmailChannelDisplayStatus }) {
  const copy = STATUS_COPY[status];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", copy.className)}
    >
      {status === "syncing" ? (
        <Loader2 className="size-3 animate-spin" />
      ) : null}
      {copy.label}
    </Badge>
  );
}

function Fact({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="truncate text-sm text-slate-900" title={value}>
        {value}
      </span>
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </div>
  );
}

export function ConnectForm({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "outline";
}) {
  const [starting, startTransition] = useTransition();

  // The action sets the state cookie and returns Google's URL; the page then
  // navigates there itself (a form redirect would be blocked by the CSP's
  // form-action, see startGmailConnectAction).
  const connect = () => {
    startTransition(async () => {
      const result = await startGmailConnectAction();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      window.location.assign(result.url);
    });
  };

  return (
    <Button
      type="button"
      variant={variant}
      className="gap-2"
      onClick={connect}
      disabled={starting}
    >
      {starting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <PlugZap className="size-4" />
      )}
      {label}
    </Button>
  );
}

function EventStatus({ event }: { event: InboundEmail }) {
  if (event.status === "processed") {
    return (
      <span className="text-emerald-700">
        {event.outcome === "agent_reply_appended"
          ? "Agent reply added"
          : event.outcome === "reply_appended"
            ? "Added to ticket"
            : "Ticket created"}
      </span>
    );
  }
  if (event.status === "ignored") {
    return (
      <span className="text-slate-500">
        Ignored ·{" "}
        {IGNORE_REASON_LABELS[event.ignoreReason ?? ""] ??
          event.ignoreReason ??
          "filtered"}
      </span>
    );
  }
  if (event.status === "failed") {
    return (
      <span className="text-red-700">
        Failed after {event.retryCount} attempt
        {event.retryCount === 1 ? "" : "s"}
      </span>
    );
  }
  return (
    <span className="text-sky-700">
      {event.retryCount > 0
        ? `Retrying (attempt ${event.retryCount + 1})`
        : "Queued"}
    </span>
  );
}

export function EmailChannelSettings({ data }: { data: EmailChannelPageData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [pending, startTransition] = useTransition();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const channel = data.channel;
  const status = displayStatus(channel, data.stats?.syncInProgress ?? false);

  const [receivingEmail, setReceivingEmail] = useState(
    channel?.receivingEmail ?? "",
  );
  const [enabled, setEnabled] = useState(channel?.enabled ?? true);
  const [autoCreate, setAutoCreate] = useState(
    channel?.autoCreateCustomer ?? true,
  );
  const [fieldError, setFieldError] = useState<string | null>(null);

  const dirty =
    !!channel &&
    (receivingEmail.trim().toLowerCase() !== channel.receivingEmail ||
      enabled !== channel.enabled ||
      autoCreate !== channel.autoCreateCustomer);

  // The OAuth round trip comes back with ?gmail=<code>: say what happened
  // once, then drop the parameter so a refresh doesn't repeat it.
  useEffect(() => {
    const code = searchParams.get("gmail");
    if (!code) return;
    const result =
      CONNECT_RESULT_MESSAGES[code] ?? CONNECT_RESULT_MESSAGES.failed;
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
    router.replace(tenantPath(tenantSlug, GMAIL_CHANNEL_PATH), {
      scroll: false,
    });
  }, [searchParams, router, tenantSlug]);

  const save = () => {
    setFieldError(null);
    startTransition(async () => {
      const result = await updateEmailChannelAction({
        receivingEmail,
        enabled,
        autoCreateCustomer: autoCreate,
      });
      if (!result.ok) {
        if (result.field) setFieldError(result.message);
        toast.error(result.message);
        return;
      }
      toast.success("Email channel saved.");
      router.refresh();
    });
  };

  const disconnect = () => {
    startTransition(async () => {
      const result = await disconnectEmailChannelAction();
      setConfirmDisconnect(false);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Gmail disconnected. Tickets already created are kept.");
      router.refresh();
    });
  };

  const sync = () => {
    startTransition(async () => {
      const result = await syncEmailChannelAction();
      if (!result.ok) toast.error(result.message);
      else if (result.result === "done") toast.success("Inbox checked.");
      else if (result.result === "failed")
        toast.error("The sync failed. See the channel's last error.");
      else toast.success("Sync queued. New email shows up within a minute.");
      router.refresh();
    });
  };

  const retry = (eventId: string) => {
    startTransition(async () => {
      const result = await retryInboundEmailAction(eventId);
      if (!result.ok) toast.error(result.message);
      else toast.success("Queued for another try.");
      router.refresh();
    });
  };

  return (
    // Full width; from xl the two columns fill the window and only the email
    // list scrolls, inside its card, so the page itself never does.
    <div className="h-full overflow-y-auto p-4 font-sans text-slate-900 sm:p-6 lg:p-8 xl:overflow-hidden">
      <div className="flex w-full flex-col gap-6 xl:h-full">
        <div className="flex flex-col gap-3">
          <Link
            href={tenantPath(tenantSlug, TENANT_ROUTES.SETTINGS.CHANNELS)}
            className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="size-4" />
            Channels &amp; Integrations
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Gmail</h1>
            <p className="text-sm text-slate-500">
              Turn emails sent to your support address into tickets, and replies
              into ticket updates.
            </p>
          </div>
        </div>

        {!data.configured ? (
          <div className="flex items-start gap-3 rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              Email channels aren&apos;t set up on this deployment yet. Your
              platform administrator needs to add the Google OAuth and Pub/Sub
              settings before Gmail can be connected.
            </p>
          </div>
        ) : null}

        <div
          className={cn(
            "grid grid-cols-1 items-start gap-6 xl:min-h-0 xl:flex-1",
            channel &&
              "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-stretch",
          )}
        >
          <div className="flex min-w-0 flex-col gap-6 xl:min-h-0 xl:overflow-y-auto">
            {/* Connection */}
            <section className="flex flex-col gap-5 rounded-[14px] border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-slate-100">
                    <GmailLogo className="h-6 w-auto" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold">Gmail</h2>
                      <StatusBadge status={status} />
                    </div>
                    <p className="text-sm text-slate-500">
                      {channel
                        ? `Reading ${channel.connectedEmail}. Only mail to the support address below becomes tickets.`
                        : "Connect the Gmail account your customers write to. We only ask for permission to read mail."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!channel && data.configured ? (
                    <ConnectForm label="Connect Gmail" />
                  ) : null}
                  {channel && status === "expired" && data.configured ? (
                    <ConnectForm label="Reconnect Gmail" />
                  ) : null}
                  {channel && status !== "expired" ? (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={sync}
                      disabled={pending}
                    >
                      <RefreshCw
                        className={cn("size-4", pending && "animate-spin")}
                      />
                      Sync now
                    </Button>
                  ) : null}
                  {channel ? (
                    <Button
                      variant="outline"
                      className="gap-2 text-red-700 hover:text-red-800"
                      onClick={() => setConfirmDisconnect(true)}
                      disabled={pending}
                    >
                      <Unplug className="size-4" />
                      Disconnect
                    </Button>
                  ) : null}
                </div>
              </div>

              {channel ? (
                <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
                  <Fact
                    label="Connected account"
                    value={channel.connectedEmail}
                  />
                  <Fact
                    label="Support address"
                    value={channel.receivingEmail}
                  />
                  <Fact
                    label="Last sync"
                    value={relative(channel.lastSyncAt)}
                  />
                  <Fact
                    label="Push notifications"
                    value={
                      channel.watchExpiration
                        ? `Renews ${relative(channel.watchExpiration)}`
                        : "Not registered"
                    }
                    hint="Renewed automatically before they expire"
                  />
                </div>
              ) : null}

              {channel?.lastError &&
              status !== "connected" &&
              status !== "syncing" ? (
                <div className="flex items-start gap-2.5 rounded-[10px] bg-red-50 px-3.5 py-3 text-sm text-red-800">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span>{channel.lastError}</span>
                    {channel.lastErrorAt ? (
                      <span className="text-xs text-red-700/80">
                        {relative(channel.lastErrorAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>

            {/* Settings */}
            {channel ? (
              <section className="flex flex-col gap-5 rounded-[14px] border border-border bg-card p-4 sm:p-5">
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-semibold">Routing</h2>
                  <p className="text-sm text-slate-500">
                    Which mail becomes a ticket, and who can raise one.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="receiving-email">Support address</Label>
                  <Input
                    id="receiving-email"
                    type="email"
                    value={receivingEmail}
                    onChange={(event) => setReceivingEmail(event.target.value)}
                    aria-invalid={fieldError ? true : undefined}
                    className="max-w-md"
                  />
                  <p
                    className={cn(
                      "text-xs",
                      fieldError ? "text-red-700" : "text-slate-500",
                    )}
                  >
                    {fieldError ??
                      `Mail to this address (To, Cc or Bcc) is filed. Use ${channel.connectedEmail} itself, an alias such as ${channel.connectedEmail.replace("@", "+support@")}, or an address that forwards into this inbox.`}
                  </p>
                </div>

                <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="email-enabled">
                      Create tickets from email
                    </Label>
                    <p className="text-xs text-slate-500">
                      While off, the inbox is still watched but nothing is
                      filed, and mail that arrives meanwhile is not imported
                      later.
                    </p>
                  </div>
                  <Switch
                    id="email-enabled"
                    checked={enabled}
                    onCheckedChange={setEnabled}
                  />
                </div>

                <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="email-auto-create">
                      Create customers for new senders
                    </Label>
                    <p className="text-xs text-slate-500">
                      Off: only people already in Customers can raise a ticket
                      by email; anyone else is ignored. A new customer
                      can&apos;t sign in to the portal until they confirm their
                      address there.
                    </p>
                  </div>
                  <Switch
                    id="email-auto-create"
                    checked={autoCreate}
                    onCheckedChange={setAutoCreate}
                  />
                </div>

                <div className="flex justify-end gap-2 border-t border-border pt-4">
                  <Button
                    variant="outline"
                    disabled={!dirty || pending}
                    onClick={() => {
                      setReceivingEmail(channel.receivingEmail);
                      setEnabled(channel.enabled);
                      setAutoCreate(channel.autoCreateCustomer);
                      setFieldError(null);
                    }}
                  >
                    Discard
                  </Button>
                  <Button disabled={!dirty || pending} onClick={save}>
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Save changes
                  </Button>
                </div>
              </section>
            ) : null}
          </div>

          {/* Monitoring */}
          {channel ? (
            <section className="flex min-w-0 flex-col gap-4 rounded-[14px] border border-border bg-card p-4 sm:p-5 xl:min-h-0">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold">Recent emails</h2>
                <p className="text-sm text-slate-500">
                  The last seven days, and what happened to each email.
                </p>
              </div>

              {data.stats ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    ["Received", data.stats.received],
                    ["Tickets created", data.stats.ticketsCreated],
                    ["Replies added", data.stats.repliesAppended],
                    ["Ignored", data.stats.ignored],
                    ["Failed", data.stats.failed],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[10px] bg-slate-50 px-3 py-2.5"
                    >
                      <div className="text-xs text-slate-500">{label}</div>
                      <div className="text-lg font-semibold tabular-nums">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {data.recent.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-[12px] border border-dashed border-border py-10 text-center">
                  <Inbox className="size-6 text-slate-400" />
                  <p className="text-sm font-medium">No emails yet</p>
                  <p className="max-w-sm text-xs text-slate-500">
                    Send a test email to {channel.receivingEmail}. It shows up
                    here within a minute.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-[12px] border border-border xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                  {data.recent.map((event) => (
                    <li
                      key={event.id}
                      className="flex flex-col gap-1.5 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">
                          {event.subject || "(no subject)"}
                        </span>
                        <span className="truncate text-xs text-slate-500">
                          {event.senderEmail ?? "Unknown sender"} ·{" "}
                          {relative(event.receivedAt ?? event.createdAt)}
                        </span>
                        {event.status === "failed" && event.errorMessage ? (
                          <span
                            className="truncate text-xs text-red-700"
                            title={event.errorMessage}
                          >
                            {event.errorMessage}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-xs">
                        <EventStatus event={event} />
                        {event.ticketId ? (
                          <Link
                            href={tenantPath(
                              tenantSlug,
                              `${TENANT_ROUTES.TICKETS}/${event.ticketId}`,
                            )}
                            className="font-medium text-primary hover:underline"
                          >
                            View ticket
                          </Link>
                        ) : null}
                        {event.status === "failed" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5"
                            disabled={pending}
                            onClick={() => retry(event.id)}
                          >
                            <RotateCcw className="size-3.5" />
                            Retry
                          </Button>
                        ) : null}
                        {event.status === "processed" ? (
                          <CheckCircle2 className="size-4 text-emerald-600" />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      </div>

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Gmail?</AlertDialogTitle>
            <AlertDialogDescription>
              New email to {channel?.receivingEmail} will stop becoming tickets,
              and our access to {channel?.connectedEmail} is revoked at Google.
              Tickets and replies already created are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                disconnect();
              }}
              disabled={pending}
              className="bg-red-600 hover:bg-red-700"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
