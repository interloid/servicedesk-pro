"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  FilterX,
  MailPlus,
  MoreHorizontalIcon,
  Pause,
  Play,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DASHBOARD_CARD,
  DASHBOARD_ICON_BUTTON,
  FilterSelect,
  SearchField,
} from "@/components/shared/dashboard-ui";
import { cn } from "@/lib/utils";

import {
  TEAM_STATUS_VALUES,
  assignableRoleOptions,
  canEditMemberWithRole,
  canPerformTeamAction,
  formatAbsoluteDate,
  hasSeatLeft,
  roleWithArticle,
  type TeamMember,
  type TeamRole,
  type TeamRoleOption,
  type TeamSeats,
  type TeamStatus,
} from "@/features/team/types/team";
import { formatRelativeTime, getInitials } from "@/lib/format";
import {
  changeMemberRoleAction,
  changeMemberStatusAction,
  removeMemberAction,
  resendInviteAction,
  transferOwnershipAction,
} from "@/features/team/team-actions";
import { ChangeRoleModal } from "@/features/team/components/change-role-modal";
import { RemoveMemberModal } from "@/features/team/components/remove-member-modal";

const PAGE_SIZE = 10;

// The platform tables' header cell: a pale band, small uppercase label.
const TH =
  "h-10 bg-slate-50/80 px-4 text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-slate-500 uppercase shadow-[inset_0_-1px_0_var(--border)] dark:bg-muted/40";

// Soft fill plus a hairline ring in the same hue, as on the platform tables.
const TEAM_STATUS_BADGE: Record<TeamStatus, string> = {
  Active:
    "border-none bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15 ring-inset dark:bg-emerald-950/60 dark:text-emerald-300",
  Invited:
    "border-none bg-amber-50 text-amber-800 ring-1 ring-amber-600/20 ring-inset dark:bg-amber-950/60 dark:text-amber-300",
  Disabled:
    "border-none bg-slate-100 text-slate-600 ring-1 ring-slate-500/15 ring-inset dark:bg-muted dark:text-muted-foreground",
};

/** The timestamp line under a status badge, or null when there is nothing to say. */
function statusDetail(member: TeamMember, now: number): string | null {
  if (member.status === "Invited") {
    const when = formatRelativeTime(member.invitedAt, now);
    return when ? `Invited ${when}` : null;
  }

  if (member.status === "Disabled") {
    const when = formatRelativeTime(member.disabledAt, now);
    return when ? `Deactivated ${when}` : null;
  }

  return null;
}

interface TeamTableProps {
  members: TeamMember[];
  callerRole: TeamRole | null;
  /** The platform's active staff roles (public.roles). */
  roleOptions: readonly TeamRoleOption[];
  /** Used to block re-enabling a disabled member when every seat is taken. */
  seats: TeamSeats;
  /**
   * The server's clock at render time. Reading Date.now() here instead would
   * give the server render and the hydration that follows two different
   * answers, and a row that crosses a minute boundary between them trips a
   * hydration mismatch.
   */
  now: number;
}

/** Invited accounts start out named after their email prefix, so fall back to the address. */
function displayName(member: TeamMember): string {
  return member.name.trim() || member.email;
}

function displayRole(member: TeamMember): string {
  return member.isPrimary && member.role === "Tenant Admin"
    ? `Primary ${member.roleName}`
    : member.roleName;
}

interface RowAction {
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
  /** Why the action can't run. The item stays, greyed out, with this as its tooltip. */
  blockedReason?: string;
  run: () => void;
}

export function TeamTable({
  members,
  callerRole,
  roleOptions,
  seats,
  now,
}: TeamTableProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<TeamStatus | "All">(
    "All",
  );
  // A role id, or "All".
  const [roleFilter, setRoleFilter] = React.useState<string>("All");
  const [page, setPage] = React.useState(1);
  const [roleTarget, setRoleTarget] = React.useState<{
    member: TeamMember;
    /** The role id picked from the row select, if any. */
    role: string | null;
    primaryOnly?: boolean;
  } | null>(null);
  const [removeTarget, setRemoveTarget] = React.useState<TeamMember | null>(
    null,
  );

  /**
   * `failure` is the "We couldn't …" line for this action. The server usually
   * sends a more specific reason, so it's only used when it doesn't, or when
   * the request never came back.
   */
  const run = (
    memberId: string,
    action: () => Promise<unknown>,
    {
      success,
      description,
      failure,
    }: { success: string; description?: string; failure: string },
    onDone?: () => void,
  ) => {
    setPendingId(memberId);
    startTransition(async () => {
      try {
        const result = await action();
        if (
          result &&
          typeof result === "object" &&
          "ok" in result &&
          !result.ok
        ) {
          const message =
            (result as { message?: string }).message ?? "Try again.";
          toast.error(failure, { description: message });
        } else {
          toast.success(success, { description });
          onDone?.();
        }
      } catch (error) {
        // A dropped connection or a deploy mid-request rejects the call
        // itself. Without this the row just went quiet: no toast either way.
        console.error("[team] action failed", error);
        toast.error(failure, {
          description: "Check your connection and try again.",
        });
      } finally {
        setPendingId(null);
      }
    });
  };

  const canRole = callerRole ? canPerformTeamAction("role", callerRole) : false;
  // A Manager may only hand out and edit the non-admin roles; the server
  // enforces the same rule.
  const rolesToOffer = assignableRoleOptions(callerRole, roleOptions);
  // Every role on offer plus any one a member holds (an archived role stays on
  // its holders), for the filter.
  const filterRoles = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const option of roleOptions) byId.set(option.id, option.name);
    for (const member of members) byId.set(member.roleId, member.roleName);
    return [...byId].map(([id, name]) => ({ id, name }));
  }, [roleOptions, members]);
  const canEdit = (member: TeamMember) =>
    !member.isSelf &&
    !member.isPrimary &&
    canEditMemberWithRole(callerRole, member.role);
  const canRemove = callerRole
    ? canPerformTeamAction("remove", callerRole)
    : false;
  const canResend = callerRole
    ? canPerformTeamAction("resend", callerRole)
    : false;
  const canRevoke = callerRole
    ? canPerformTeamAction("revoke", callerRole)
    : false;
  const canStatus = callerRole
    ? canPerformTeamAction("status", callerRole)
    : false;
  // Only the owner can hand the workspace over; the database checks the same.
  const callerIsPrimary = members.some(
    (member) => member.isSelf && member.isPrimary,
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((member) => {
      if (statusFilter !== "All" && member.status !== statusFilter)
        return false;
      if (roleFilter !== "All" && member.roleId !== roleFilter) return false;
      if (
        q &&
        !member.name.toLowerCase().includes(q) &&
        !member.email.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [members, query, statusFilter, roleFilter]);

  const hasActiveFilters =
    query.trim() !== "" || statusFilter !== "All" || roleFilter !== "All";

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageMembers = filtered.slice(start, start + PAGE_SIZE);

  const isPaginated = filtered.length > PAGE_SIZE;

  const goTo = (target: number) =>
    setPage(Math.min(totalPages, Math.max(1, target)));

  const changeRole = (member: TeamMember, role: TeamRoleOption) =>
    run(
      member.id,
      () =>
        changeMemberRoleAction({
          memberId: member.id,
          role: role.base,
          roleId: role.id,
        }),
      {
        success: `${displayName(member)} is now ${roleWithArticle(role.name)}`,
        failure: `Couldn't change ${displayName(member)}'s role`,
      },
      () => setRoleTarget(null),
    );

  const removeMember = (member: TeamMember) =>
    run(
      member.id,
      () => removeMemberAction({ memberId: member.id }),
      member.status === "Invited"
        ? {
            success: `Invitation to ${member.email} revoked`,
            description: "Their invite link no longer works.",
            failure: `Couldn't revoke the invitation to ${member.email}`,
          }
        : {
            success: `${displayName(member)} removed from the team`,
            description: "They no longer have access.",
            failure: `Couldn't remove ${displayName(member)}`,
          },
      () => setRemoveTarget(null),
    );

  const transferOwnership = (member: TeamMember) =>
    run(
      member.id,
      () => transferOwnershipAction({ memberId: member.id }),
      {
        success: `${displayName(member)} now owns this workspace`,
        failure: `Couldn't transfer ownership to ${displayName(member)}`,
      },
      () => setRoleTarget(null),
    );

  const buildRowActions = (member: TeamMember): RowAction[] => {
    const actions: RowAction[] = [];

    if (member.status === "Invited") {
      if (canResend) {
        actions.push({
          label: "Resend invite",
          icon: MailPlus,
          run: () =>
            run(member.id, () => resendInviteAction({ memberId: member.id }), {
              success: `Invite resent to ${member.email}`,
              failure: `Couldn't resend the invite to ${member.email}`,
            }),
        });
      }
      if (canRevoke && canEdit(member)) {
        actions.push({
          label: "Revoke invitation",
          icon: Trash2,
          destructive: true,
          run: () => setRemoveTarget(member),
        });
      }

      return actions;
    }

    if (
      callerIsPrimary &&
      member.role === "Tenant Admin" &&
      member.status === "Active" &&
      canEdit(member)
    ) {
      actions.push({
        label: "Make primary",
        icon: Crown,
        run: () => setRoleTarget({ member, role: null, primaryOnly: true }),
      });
    }

    if (canStatus && canEdit(member)) {
      const disabled = member.status === "Disabled";
      actions.push({
        label: disabled ? "Activate member" : "Deactivate member",
        icon: disabled ? Play : Pause,
        // Disabled members don't hold a seat, so turning one back on takes
        // one. The server re-checks this; the menu only explains it.
        blockedReason:
          disabled && !hasSeatLeft(seats)
            ? "No seats available. Free a seat or upgrade."
            : undefined,
        run: () =>
          run(
            member.id,
            () =>
              changeMemberStatusAction({
                memberId: member.id,
                status: disabled ? "Active" : "Disabled",
              }),
            disabled
              ? {
                  success: `${displayName(member)} is active again`,
                  failure: `Couldn't activate ${displayName(member)}`,
                }
              : {
                  success: `${displayName(member)} deactivated`,
                  description:
                    "They have no access until you activate them again.",
                  failure: `Couldn't deactivate ${displayName(member)}`,
                },
          ),
      });
    }

    if (canRemove && canEdit(member)) {
      actions.push({
        label: "Remove member",
        icon: Trash2,
        destructive: true,
        run: () => setRemoveTarget(member),
      });
    }

    return actions;
  };

  /* ---- Cell contents, shared by the table and the narrow-screen cards ---- */

  const renderIdentity = (member: TeamMember) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-9 shrink-0">
        <AvatarImage src={member.avatarUrl ?? undefined} alt="" />
        <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-700 dark:bg-muted dark:text-slate-300">
          {getInitials(member.name, member.email)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
          <span className="truncate">{member.name}</span>
          {member.isPrimary && (
            <Badge className="h-5 shrink-0 gap-1 rounded-md border-none bg-brand-50 px-1.5 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-700/15 ring-inset dark:bg-brand-700/20 dark:text-brand-100">
              <Crown className="size-3" aria-hidden />
              Owner
            </Badge>
          )}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {member.email}
        </span>
      </div>
    </div>
  );

  const renderStatus = (member: TeamMember) => {
    const detail = statusDetail(member, now);

    return (
      <div className="flex flex-col items-start gap-1">
        <Badge
          className={cn(
            "h-6 rounded-md px-2 text-xs font-semibold",
            TEAM_STATUS_BADGE[member.status],
          )}
        >
          {member.status}
        </Badge>
        {detail && (
          // The cell doesn't wrap by default; this line may need to.
          <span className="flex items-start gap-1 text-xs whitespace-normal text-muted-foreground">
            <Clock className="mt-0.5 size-3 shrink-0" aria-hidden />
            {detail}
          </span>
        )}
      </div>
    );
  };

  const renderRole = (member: TeamMember, busy: boolean) => {
    if (!canRole || !canEdit(member)) {
      return (
        <span className="text-sm font-semibold text-foreground">
          {displayRole(member)}
        </span>
      );
    }

    return (
      <Select
        value={member.roleId}
        onValueChange={(roleId) => {
          if (roleId === member.roleId) return;
          // Confirm first. The select stays on the server value until the
          // change actually lands, so a cancelled dialog leaves the row
          // untouched.
          setRoleTarget({ member, role: roleId });
        }}
      >
        <SelectTrigger
          aria-label={`Role for ${member.name}`}
          className="min-h-10 w-full max-w-52.5 min-w-0 rounded-lg bg-card"
          disabled={busy}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          side="bottom"
          align="start"
          position="popper"
          className="p-1"
        >
          {!rolesToOffer.some((option) => option.id === member.roleId) && (
            <SelectItem
              value={member.roleId}
              disabled
              className="p-2 cursor-pointer"
            >
              {member.roleName}
            </SelectItem>
          )}
          {rolesToOffer.map((option) => (
            <SelectItem
              key={option.id}
              value={option.id}
              className="p-2 cursor-pointer"
            >
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const renderJoined = (member: TeamMember) => {
    const joined = formatAbsoluteDate(member.joinedAt);

    if (!joined) {
      // An invite that has not been accepted has no join date yet. The owner
      // row has none either, and its bare dash reads better centred in the
      // column than hanging off the left edge.
      if (member.status === "Invited") {
        return (
          <span className="text-sm text-muted-foreground">Not yet joined</span>
        );
      }

      return (
        <span className="block text-center text-sm text-muted-foreground">
          —
        </span>
      );
    }

    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium whitespace-nowrap text-foreground">
          {joined}
        </span>
      </div>
    );
  };

  /**
   * Same menu button as every other row, switched off, with the reason on
   * hover -- so a locked row explains itself instead of reading as a missing
   * action.
   */
  const renderLockedActions = (member: TeamMember, reason: string) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex rounded-lg">
            <Button
              variant="outline"
              size="icon"
              disabled
              aria-label={`Actions for ${member.name} (${reason})`}
              className={cn(DASHBOARD_ICON_BUTTON, "text-slate-400")}
            >
              <MoreHorizontalIcon />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={0} className="translate-y-0">
          {reason}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const renderActions = (member: TeamMember, busy: boolean) => {
    if (member.isSelf) {
      return renderLockedActions(member, "You can't change your own role.");
    }

    if (member.isPrimary) {
      return renderLockedActions(member, "Tenant owner cannot be updated.");
    }

    const rowActions = buildRowActions(member);

    if (
      rowActions.length === 0 &&
      callerRole === "Manager" &&
      !canEditMemberWithRole(callerRole, member.role)
    ) {
      return renderLockedActions(
        member,
        `This is ${roleWithArticle(member.roleName)}, so cannot update.`,
      );
    }

    if (rowActions.length === 0) {
      return (
        <span
          className="inline-flex size-9 items-center justify-center text-sm text-muted-foreground"
          aria-label="No actions available"
        >
          Nil
        </span>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            disabled={busy}
            aria-label={`Actions for ${member.name}`}
            className={cn(
              DASHBOARD_ICON_BUTTON,
              "text-slate-500 hover:bg-slate-50 hover:text-foreground dark:hover:bg-muted",
            )}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <TooltipProvider>
            {rowActions.map((action) => {
              const Icon = action.icon;

              if (!action.blockedReason) {
                return (
                  <DropdownMenuItem
                    key={action.label}
                    variant={action.destructive ? "destructive" : "default"}
                    disabled={busy}
                    onSelect={action.run}
                    className="p-2 cursor-pointer"
                  >
                    <Icon />
                    {action.label}
                  </DropdownMenuItem>
                );
              }

              // Not `disabled`: a disabled item takes no pointer events, so
              // its tooltip would never open. It looks and acts disabled
              // instead, and selecting it does nothing.
              return (
                <Tooltip key={action.label}>
                  <TooltipTrigger asChild>
                    <DropdownMenuItem
                      aria-disabled
                      onSelect={(event) => event.preventDefault()}
                      // Hovering focuses a menu item, which would light it
                      // up like a live action; `!` beats the base item's
                      // focus colours.
                      className="p-2 cursor-not-allowed opacity-50 focus:bg-transparent! focus:text-popover-foreground! focus:**:text-popover-foreground!"
                    >
                      <Icon />
                      {action.label}
                    </DropdownMenuItem>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    {action.blockedReason}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("All");
    setRoleFilter("All");
    setPage(1);
  };

  const emptyMessage = hasActiveFilters
    ? "No members match your filters."
    : "No team members yet.";

  return (
    <div className="flex flex-col gap-4">
      {/* One toolbar card, as on the platform tables: search first, then the
          selects and Clear. */}
      <div className={cn(DASHBOARD_CARD, "p-3")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:items-center">
          <div className="sm:col-span-2 lg:max-w-80 lg:flex-1">
            <SearchField
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="Search by name or email..."
              label="Search members"
            />
          </div>

          <FilterSelect
            label="Filter by status"
            value={statusFilter}
            className="lg:w-40 xl:w-40"
            onChange={(value) => {
              setStatusFilter(value as TeamStatus | "All");
              setPage(1);
            }}
            options={[
              { value: "All", label: "All statuses" },
              ...TEAM_STATUS_VALUES.map((status) => ({
                value: status,
                label: status,
              })),
            ]}
          />

          <FilterSelect
            label="Filter by role"
            value={roleFilter}
            className="lg:w-44 xl:w-44"
            onChange={(value) => {
              setRoleFilter(value);
              setPage(1);
            }}
            options={[
              { value: "All", label: "All roles" },
              ...filterRoles.map((role) => ({
                value: role.id,
                label: role.name,
              })),
            ]}
          />

          <Button
            type="button"
            variant="ghost"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="h-10 gap-1.5 rounded-lg px-3 font-semibold text-slate-600 hover:bg-slate-100 hover:text-foreground disabled:opacity-40 sm:col-span-2 sm:justify-self-start lg:ml-auto dark:hover:bg-muted"
          >
            <FilterX className="size-4" aria-hidden />
            Clear filters
          </Button>
        </div>
      </div>

      <div className={cn(DASHBOARD_CARD, "overflow-hidden")}>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-700/20">
            <Users className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col">
            <h2 className="font-heading text-base leading-snug font-bold tracking-tight text-foreground">
              Team members
            </h2>
            <p className="text-xs text-slate-500">
              {members.length} {members.length === 1 ? "person" : "people"} on
              your workspace.
            </p>
          </div>
        </div>

        <Table className="min-w-262 table-fixed">
          <TableHeader className="[&_tr]:border-b-0">
            <TableRow className="hover:bg-transparent">
              <TableHead className={TH}>Member</TableHead>

              <TableHead className={`${TH} w-62`}>Status</TableHead>

              <TableHead className={`${TH} w-64`}>Role</TableHead>

              <TableHead className={`${TH} w-36`}>Joined</TableHead>

              <TableHead className={`${TH} w-36 text-center`}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {pageMembers.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="px-4 py-14">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-muted">
                      <Users className="size-5" aria-hidden />
                    </span>
                    <p className="max-w-sm text-sm text-slate-500">
                      {emptyMessage}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pageMembers.map((member) => {
                const busy = isPending && pendingId === member.id;

                return (
                  <TableRow
                    key={member.id}
                    data-busy={busy || undefined}
                    className="border-border transition-colors hover:bg-slate-50/60 data-busy:opacity-60 dark:hover:bg-muted/30"
                  >
                    <TableCell className="px-4 py-3.5">
                      {renderIdentity(member)}
                    </TableCell>

                    <TableCell className="px-4 py-3.5 align-middle">
                      {renderStatus(member)}
                    </TableCell>

                    <TableCell className="px-4 py-3.5 align-middle">
                      {renderRole(member, busy)}
                    </TableCell>

                    <TableCell className="px-4 py-3.5 align-middle">
                      {renderJoined(member)}
                    </TableCell>

                    <TableCell className="px-4 py-3.5 text-center align-middle">
                      <div className="flex justify-center">
                        {renderActions(member, busy)}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-border bg-slate-50/50 px-4 py-3 text-sm text-slate-500 tabular-nums sm:flex-row dark:bg-muted/20">
          <span className="text-center sm:text-left">
            Showing{" "}
            {filtered.length === 0
              ? 0
              : `${start + 1} -${Math.min(start + PAGE_SIZE, filtered.length)}`}{" "}
            of {filtered.length} {filtered.length === 1 ? "person" : "people"}
            {hasActiveFilters ? " matching your filters" : ""}.
          </span>
          {isPaginated && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg bg-card font-semibold shadow-none"
                disabled={safePage <= 1}
                onClick={() => goTo(safePage - 1)}
              >
                <ChevronLeft />
                Previous
              </Button>
              <span className="min-w-18 text-center text-xs">
                Page {safePage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg bg-card font-semibold shadow-none"
                disabled={safePage >= totalPages}
                onClick={() => goTo(safePage + 1)}
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>
      </div>

      <ChangeRoleModal
        member={roleTarget?.member ?? null}
        initialRoleId={roleTarget?.role ?? null}
        isPending={isPending && pendingId === roleTarget?.member.id}
        onOpenChange={(open) => !open && setRoleTarget(null)}
        roles={rolesToOffer}
        onConfirm={changeRole}
        primaryOnly={roleTarget?.primaryOnly}
        onMakePrimary={callerIsPrimary ? transferOwnership : undefined}
      />

      <RemoveMemberModal
        member={removeTarget}
        isPending={isPending && pendingId === removeTarget?.id}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        onConfirm={removeMember}
      />
    </div>
  );
}
