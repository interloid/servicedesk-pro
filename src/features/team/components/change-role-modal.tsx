"use client";

import * as React from "react";
import { ArrowRight, Crown, Info, TriangleAlert, UserCog } from "lucide-react";

import { ModalNotice } from "@/components/shared/modal-notice";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  TEAM_DIALOG_CONTENT,
  TEAM_DIALOG_FOOTER,
  TEAM_MODAL_BUTTON,
  TEAM_MODAL_BUTTON_PRIMARY,
  TEAM_MODAL_CONTROL,
} from "@/features/team/components/modal-buttons";
import {
  DIALOG_FOOTER_BAND,
  DialogIconHeader,
  DialogSectionLabel,
} from "@/features/team/components/dialog-icon-header";
import {
  roleOptionDescription,
  type TeamMember,
  type TeamRoleOption,
} from "@/features/team/types/team";

interface ChangeRoleModalProps {
  member: TeamMember | null;
  /**
   * Role to open on. Set when the confirmation was triggered by picking a role
   * straight from the row select -- the dialog then confirms that choice
   * instead of making the admin pick it a second time.
   */
  initialRoleId?: string | null;
  primaryOnly?: boolean;
  /** The catalogue roles this caller may hand out. */
  roles: readonly TeamRoleOption[];
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (member: TeamMember, role: TeamRoleOption) => void;
  /**
   * Set only when the caller owns the workspace. Offers "Mark as primary"
   * while Tenant Admin is the chosen role, which hands ownership over.
   */
  onMakePrimary?: (member: TeamMember) => void;
}

export function ChangeRoleModal({
  member,
  initialRoleId,
  primaryOnly = false,
  roles,
  isPending,
  onOpenChange,
  onConfirm,
  onMakePrimary,
}: ChangeRoleModalProps) {
  // Radix keeps the dialog mounted while it animates closed, but the table
  // drops the target the instant it closes. Rendering off `member` alone
  // therefore emptied the box mid-animation and it flashed out as a blank
  // white sheet with nothing but the close cross in it. Keeping the last
  // target lets the dialog animate out still showing what it was showing.
  const [shown, setShown] = React.useState<{
    member: TeamMember;
    role: string;
    primaryOnly: boolean;
  } | null>(null);

  const role = member ? (initialRoleId ?? member.roleId) : null;

  if (
    member &&
    role &&
    (shown?.member.id !== member.id ||
      shown.role !== role ||
      shown.primaryOnly !== primaryOnly)
  ) {
    setShown({ member, role, primaryOnly });
  }

  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-115 ${TEAM_DIALOG_CONTENT}`}>
        {shown && (
          // Keyed by member AND opening role so the select starts on whoever
          // was just opened. One shared dialog otherwise keeps the previous
          // selection and "Update role" would quietly apply the wrong one.
          <ChangeRoleFields
            key={`${shown.member.id}:${shown.role}:${shown.primaryOnly ? "primary" : "role"}`}
            member={shown.member}
            initialRoleId={shown.role}
            primaryOnly={shown.primaryOnly}
            roles={roles}
            isPending={isPending}
            onCancel={() => onOpenChange(false)}
            onConfirm={onConfirm}
            onMakePrimary={onMakePrimary}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChangeRoleFields({
  member,
  initialRoleId,
  primaryOnly,
  roles,
  isPending,
  onCancel,
  onConfirm,
  onMakePrimary,
}: {
  member: TeamMember;
  initialRoleId: string;
  primaryOnly: boolean;
  roles: readonly TeamRoleOption[];
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (member: TeamMember, role: TeamRoleOption) => void;
  onMakePrimary?: (member: TeamMember) => void;
}) {
  const [roleId, setRoleId] = React.useState<string>(initialRoleId);
  const role = roles.find((option) => option.id === roleId) ?? null;
  // Second step of "Mark as primary": the footer asks before handing over.
  const [confirmingPrimary, setConfirmingPrimary] = React.useState(primaryOnly);
  const changed = role !== null && role.id !== member.roleId;
  // Only an active member can own the workspace, and only as a Tenant Admin.
  const canMakePrimary =
    onMakePrimary !== undefined &&
    member.status === "Active" &&
    (role?.base ?? member.role) === "Tenant Admin";
  const who = member.name || member.email;

  if (primaryOnly || confirmingPrimary) {
    return (
      <>
        <DialogIconHeader
          icon={Crown}
          tint="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
          title="Mark as primary"
          description={`Make ${who} the primary owner of this workspace?`}
        />

        <ModalNotice
          icon={TriangleAlert}
          tone="amber"
          title="What happens next"
        >
          <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-normal">
            {member.role !== "Tenant Admin" && (
              <li>{who} will become a Tenant Admin.</li>
            )}
            <li>
              {who} will own the workspace. Nobody else can change, disable or
              remove them.
            </li>
            <li>
              You stay a Tenant Admin, but other admins will be able to change
              your role or remove you.
            </li>
            <li>Only {who} can move ownership again.</li>
          </ul>
        </ModalNotice>

        <DialogFooter className={`${TEAM_DIALOG_FOOTER} ${DIALOG_FOOTER_BAND}`}>
          {!primaryOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setConfirmingPrimary(false)}
              className={TEAM_MODAL_BUTTON}
            >
              Back
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={isPending || onMakePrimary === undefined}
            onClick={() => onMakePrimary?.(member)}
            className={`${TEAM_MODAL_BUTTON} ${TEAM_MODAL_BUTTON_PRIMARY}`}
          >
            {isPending ? "Updating…" : "Confirm"}
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogIconHeader
        icon={UserCog}
        title="Change role"
        description={`Choose a new role for ${member.email || member.name}.`}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-slate-50/60 px-3.5 py-3 dark:bg-muted/30">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
          Current
        </span>
        <span className="text-sm font-semibold text-foreground">
          {member.roleName}
        </span>
        <ArrowRight className="size-3.5 shrink-0 text-slate-400" aria-hidden />
        <span className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
          New
        </span>
        <span
          className={`text-sm font-semibold ${
            changed ? "text-brand-700 dark:text-brand-300" : "text-slate-500"
          }`}
        >
          {role?.name ?? member.roleName}
        </span>
      </div>

      <div className="space-y-1.5">
        <DialogSectionLabel>New role</DialogSectionLabel>
        <Label htmlFor="change-role" className="text-sm font-semibold">
          Role
        </Label>
        <Select value={roleId} onValueChange={setRoleId}>
          <SelectTrigger
            id="change-role"
            className={`min-h-10 w-full rounded-lg ${TEAM_MODAL_CONTROL}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            side="bottom"
            align="start"
            position="popper"
            className="p-1"
          >
            {/* A role that has since been archived still shows as current. */}
            {!roles.some((option) => option.id === member.roleId) && (
              <SelectItem
                value={member.roleId}
                disabled
                className="p-2 cursor-pointer"
              >
                {member.roleName}
              </SelectItem>
            )}
            {roles.map((option) => (
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
      </div>

      {role && (
        <ModalNotice icon={Info} tone="neutral" title={role.name}>
          <span className="text-xs leading-[1.55]">
            {roleOptionDescription(role)}
            {!role.isSystem && ` Same access as ${role.base}.`}
          </span>
        </ModalNotice>
      )}

      <DialogFooter className={`${TEAM_DIALOG_FOOTER} ${DIALOG_FOOTER_BAND}`}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={onCancel}
          className={TEAM_MODAL_BUTTON}
        >
          Cancel
        </Button>
        {canMakePrimary && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => setConfirmingPrimary(true)}
            className={TEAM_MODAL_BUTTON}
          >
            <Crown className="size-4" aria-hidden />
            Mark as primary
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          disabled={isPending || !changed}
          onClick={() => role && onConfirm(member, role)}
          className={`${TEAM_MODAL_BUTTON} ${TEAM_MODAL_BUTTON_PRIMARY}`}
        >
          {isPending ? "Updating…" : "Update role"}
        </Button>
      </DialogFooter>
    </>
  );
}
