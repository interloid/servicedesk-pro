"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Loader2,
  RotateCcw,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SupportStatusBadge } from "@/features/support/components/support-badges";
import {
  SupportReplyBox,
  SupportThread,
} from "@/features/support/components/support-thread";
import {
  formatSupportTime,
  isOpenSupportStatus,
  SUPPORT_STATUS_LABELS_PLATFORM,
  SUPPORT_STATUSES,
  type SupportStatus,
} from "@/features/support/support";
import {
  TEAM_DIALOG_TITLE,
  TEAM_MODAL_BUTTON,
  TEAM_MODAL_BUTTON_PRIMARY,
} from "@/features/team/components/modal-buttons";
import { cn } from "@/lib/utils";

import {
  getPlatformSupportRequestAction,
  replyPlatformSupportAction,
  setPlatformSupportStatusAction,
} from "../actions/platform-support.actions";
import { formatCurrency } from "../format";
import type {
  PlatformSupportDetail,
  PlatformSupportRequest,
} from "../services/platform-support.service";
import { UNLIMITED_SEATS, type PlatformTenant } from "../types";
import { SignInAsButton } from "./sign-in-as-button";
import { TenantStatusBadge } from "./status-badge";

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium break-words text-foreground">
        {children}
      </span>
    </div>
  );
}

/** "Support access", shown only while the workspace's grant is active. */
export function InPersonViewLink({
  tenant,
  className,
  compact = false,
}: {
  tenant: Pick<PlatformTenant, "id" | "name">;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Button
      asChild
      variant="outline"
      size={compact ? "icon" : "default"}
      className={cn(
        "border-emerald-300! bg-emerald-50 text-emerald-700 shadow-none hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-800! dark:bg-emerald-950/40 dark:text-emerald-300",
        compact ? "size-9 rounded-lg" : "h-10 gap-2 rounded-lg font-semibold",
        className,
      )}
    >
      {/* No prefetch: opening the view writes an audit entry, and a prefetch
          must not record a visit nobody made. */}
      <Link
        href={`/platform/tenants/${tenant.id}/in-person-view`}
        prefetch={false}
        aria-label={`Support access for ${tenant.name}`}
        title="Support access: look around read-only, or sign in as their admin"
      >
        <UsersRound className="size-4" aria-hidden />
        {!compact && "Support access"}
      </Link>
    </Button>
  );
}

function RequestDetail({
  requestId,
  onBack,
}: {
  requestId: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const [request, setRequest] = useState<PlatformSupportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const result = await getPlatformSupportRequestAction({ requestId });

    if (result.success) {
      setRequest(result.request);
      setError(null);
    } else {
      setError(result.message);
    }
  }, [requestId]);

  useEffect(() => {
    let live = true;

    getPlatformSupportRequestAction({ requestId })
      .then((result) => {
        if (!live) return;
        if (result.success) setRequest(result.request);
        else setError(result.message);
      })
      .catch(() => live && setError("Couldn't load the request."));

    return () => {
      live = false;
    };
  }, [requestId]);

  function changeStatus(status: SupportStatus) {
    if (!request || status === request.status) return;

    startTransition(async () => {
      const result = await setPlatformSupportStatusAction({
        requestId,
        status,
      });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(
        `${request.number} ${status === "resolved" ? "resolved" : `set to ${SUPPORT_STATUS_LABELS_PLATFORM[status]}`}.`,
      );
      await load();
      router.refresh();
    });
  }

  const back = (
    <button
      type="button"
      onClick={onBack}
      className="flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" aria-hidden />
      All support requests
    </button>
  );

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        {back}
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col gap-3">
        {back}
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading request…
        </p>
      </div>
    );
  }

  const open = isOpenSupportStatus(request.status);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {back}

      <div className="flex flex-col gap-1">
        <h3 className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold">
          <span className="text-muted-foreground tabular-nums">
            {request.number}
          </span>
          <span className="break-words">{request.subject}</span>
        </h3>
        <p className="text-xs text-muted-foreground">
          Opened by {request.createdByEmail || request.createdByName} ·{" "}
          {formatSupportTime(request.createdAt)}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <SupportStatusBadge status={request.status} side="platform" />
        </div>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Select
            value={request.status}
            disabled={isPending}
            onValueChange={(value) => changeStatus(value as SupportStatus)}
          >
            <SelectTrigger
              aria-label="Request status"
              className="min-h-10 w-full rounded-lg bg-card sm:w-48"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              side="bottom"
              align="start"
              position="popper"
              className="p-1"
            >
              {SUPPORT_STATUSES.map((status) => (
                <SelectItem
                  key={status}
                  value={status}
                  className="cursor-pointer p-2"
                >
                  {SUPPORT_STATUS_LABELS_PLATFORM[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {open ? (
            <Button
              className={cn(TEAM_MODAL_BUTTON, TEAM_MODAL_BUTTON_PRIMARY)}
              disabled={isPending}
              onClick={() => changeStatus("resolved")}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <CircleCheck className="size-4" aria-hidden />
              )}
              Resolve
            </Button>
          ) : (
            <Button
              variant="outline"
              className={TEAM_MODAL_BUTTON}
              disabled={isPending}
              onClick={() => changeStatus("open")}
            >
              <RotateCcw className="size-4" aria-hidden />
              Reopen
            </Button>
          )}
        </div>
      </div>

      <div className="max-h-[45vh] overflow-y-auto pr-1">
        <SupportThread request={request} viewer="platform" />
      </div>

      <SupportReplyBox
        requestId={request.id}
        placeholder="Reply to the workspace admin…"
        disabledReason={
          request.status === "closed"
            ? "The workspace closed this request. They can open a new one."
            : undefined
        }
        send={async (input) => {
          const result = await replyPlatformSupportAction(input);
          return result.success
            ? { ok: true }
            : { ok: false, message: result.message };
        }}
        onSent={async () => {
          await load();
          router.refresh();
        }}
      />
    </div>
  );
}

/**
 * The Tenants page's eye button and "N Open" badge: the workspace's facts and
 * its support requests, answered and resolved right here.
 */
export function TenantSupportDialog({
  tenant,
  requests,
  initialRequestId,
}: {
  tenant: PlatformTenant;
  /** This workspace's requests, newest first. */
  requests: PlatformSupportRequest[];
  /** Opens straight on a request (the "N Open" badge). */
  initialRequestId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialRequestId ?? null,
  );
  const openRequests = requests.filter((r) => isOpenSupportStatus(r.status));
  const accessActive = requests.some((r) => r.accessActive);
  const grantedRequest = requests.find((r) => r.accessActive);
  // Open ones first, then resolved and closed.
  const ordered = [
    ...openRequests,
    ...requests.filter((r) => !isOpenSupportStatus(r.status)),
  ];

  return (
    <>
      <DialogHeader className="pr-6">
        <DialogTitle className={TEAM_DIALOG_TITLE}>{tenant.name}</DialogTitle>
        <DialogDescription>
          {tenant.plan} plan · /{tenant.slug}
        </DialogDescription>
      </DialogHeader>

      {selectedId ? (
        <RequestDetail
          key={selectedId}
          requestId={selectedId}
          onBack={() => setSelectedId(null)}
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-5">
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
            <section className="divide-y divide-muted">
              <Fact label="Status">
                <TenantStatusBadge status={tenant.status} />
              </Fact>
              <Fact label="Owner">
                {tenant.ownerEmail
                  ? `${tenant.owner} (${tenant.ownerEmail})`
                  : tenant.owner}
              </Fact>
              <Fact label="Seats">
                {tenant.seatsUsed} /{" "}
                {tenant.seatsLimit >= UNLIMITED_SEATS
                  ? "Unlimited"
                  : tenant.seatsLimit}
              </Fact>
            </section>
            <section className="divide-y divide-muted border-t border-muted md:border-t-0">
              <Fact label="MRR">{formatCurrency(tenant.mrr)}</Fact>
              <Fact label="Created">{tenant.createdAt}</Fact>
              <Fact label="Workspace access">
                {accessActive ? "Granted" : "Not granted"}
              </Fact>
            </section>
          </div>

          {accessActive && (
            <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <p className="text-sm text-emerald-900 dark:text-emerald-100">
                The workspace granted access for troubleshooting. View it, or
                sign in as the admin who granted it. Everything is recorded in
                their audit log.
              </p>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <InPersonViewLink tenant={tenant} />
                {grantedRequest && (
                  <SignInAsButton
                    requestId={grantedRequest.id}
                    workspaceName={tenant.name}
                    accessEndsAt={grantedRequest.accessExpiresAt}
                  />
                )}
              </div>
            </div>
          )}

          <section className="flex flex-col gap-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">
              Support requests
              {requests.length > 0 && (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {openRequests.length} open · {requests.length} total
                </span>
              )}
            </h3>

            {ordered.length === 0 ? (
              <p className="py-1.5 text-sm text-muted-foreground">
                This workspace hasn&apos;t contacted support.
              </p>
            ) : (
              <ul className="max-h-80 divide-y divide-muted overflow-y-auto rounded-lg border border-border">
                {ordered.map((request) => (
                  <li key={request.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(request.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">
                          {request.subject}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {request.number} · updated{" "}
                          {formatSupportTime(request.updatedAt)}
                        </span>
                      </span>
                      <SupportStatusBadge
                        status={request.status}
                        side="platform"
                      />
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
