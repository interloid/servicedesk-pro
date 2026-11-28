"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Mail,
  MoreHorizontal,
  Network,
  RefreshCw,
  Settings2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { tenantPath } from "@/lib/tenancy";
import { cn } from "@/lib/utils";

import {
  disconnectEmailChannelAction,
  syncEmailChannelAction,
} from "@/features/email-channels/actions/email-channels.actions";
import {
  GmailLogo,
  TeamsLogo,
} from "@/features/email-channels/components/channel-logos";
import {
  ConnectForm,
  StatusBadge,
  relative,
} from "@/features/email-channels/components/email-channel-settings";
import {
  GMAIL_CHANNEL_PATH,
  displayStatus,
  type EmailChannelPageData,
} from "@/features/email-channels/email-channels";

function ChannelCard({
  highlighted,
  icon,
  title,
  badge,
  description,
  menu,
  children,
  actions,
}: {
  highlighted?: boolean;
  icon: React.ReactNode;
  title: string;
  badge: React.ReactNode;
  description: string;
  menu?: React.ReactNode;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-[14px] border bg-card p-4 sm:p-5",
        highlighted
          ? "border-emerald-600/60 bg-emerald-50/30"
          : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center">
          {icon}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{title}</h2>
            {badge}
          </div>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        {menu}
      </div>

      <div className="flex min-h-6 flex-wrap items-center gap-x-8 gap-y-2 pl-0 text-sm text-slate-700 sm:pl-14">
        {children}
      </div>

      <div className="mt-auto flex flex-wrap justify-end gap-2">{actions}</div>
    </section>
  );
}

export function ChannelsOverview({ gmail }: { gmail: EmailChannelPageData }) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [pending, startTransition] = useTransition();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const channel = gmail.channel;
  const status = displayStatus(channel, gmail.stats?.syncInProgress ?? false);
  const managePath = tenantPath(tenantSlug, GMAIL_CHANNEL_PATH);

  const sync = () => {
    startTransition(async () => {
      const result = await syncEmailChannelAction();
      if (!result.ok) toast.error(result.message);
      else if (result.result === "done") toast.success("Inbox checked.");
      else if (result.result === "failed")
        toast.error("The sync failed. Open Manage to see the last error.");
      else toast.success("Sync queued. New email shows up within a minute.");
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

  return (
    <div className="h-full overflow-y-auto p-4 font-sans text-slate-900 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Channels &amp; Integrations
          </h1>
          <p className="text-sm text-slate-500">
            Connect communication channels to manage support requests,
            conversations, and ticket updates from one place.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Gmail */}
          <ChannelCard
            highlighted={Boolean(channel) && status === "connected"}
            icon={<GmailLogo className="h-8 w-auto" />}
            title="Gmail"
            badge={
              channel ? (
                <StatusBadge status={status} />
              ) : (
                <Badge
                  variant="outline"
                  className="border-slate-200 bg-slate-100 font-medium text-slate-600"
                >
                  Not connected
                </Badge>
              )
            }
            description="Convert incoming emails into support tickets and manage replies."
            menu={
              channel ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label="Gmail options"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={managePath}>
                        <Settings2 className="size-4" />
                        Manage settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setConfirmDisconnect(true)}
                    >
                      <Unplug className="size-4" />
                      Disconnect
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null
            }
            actions={
              channel ? (
                <>
                  {status !== "expired" ? (
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
                  ) : (
                    <ConnectForm label="Reconnect Gmail" variant="outline" />
                  )}
                  <Button asChild className="gap-2">
                    <Link href={managePath}>
                      Manage
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </>
              ) : gmail.configured ? (
                <ConnectForm label="Connect Gmail" />
              ) : (
                <Button disabled>Connect Gmail</Button>
              )
            }
          >
            {channel ? (
              <>
                <span className="flex min-w-0 items-center gap-2">
                  <Mail className="size-4 shrink-0 text-slate-500" />
                  <span className="truncate" title={channel.receivingEmail}>
                    {channel.receivingEmail}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="size-4 shrink-0 text-slate-500" />
                  Last sync: {relative(channel.lastSyncAt)}
                </span>
              </>
            ) : gmail.configured ? (
              <span className="flex items-center gap-2">
                <Network className="size-4 shrink-0 text-slate-500" />
                Connect your support Gmail account to get started.
              </span>
            ) : (
              <span className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="size-4 shrink-0" />
                Not set up on this deployment yet.
              </span>
            )}
          </ChannelCard>

          {/* Microsoft Teams: not built yet, so nothing here pretends to work. */}
          <ChannelCard
            icon={<TeamsLogo className="h-9 w-auto" />}
            title="Microsoft Teams"
            badge={
              <Badge
                variant="outline"
                className="border-slate-200 bg-slate-100 font-medium text-slate-600"
              >
                Coming soon
              </Badge>
            }
            description="Create tickets from Teams conversations and receive ticket updates."
            actions={
              <Button disabled className="gap-2">
                Connect Teams
                <ArrowRight className="size-4" />
              </Button>
            }
          >
            <span className="flex items-center gap-2">
              <Network className="size-4 shrink-0 text-slate-500" />
              Connect your Microsoft 365 account to get started.
            </span>
          </ChannelCard>
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
