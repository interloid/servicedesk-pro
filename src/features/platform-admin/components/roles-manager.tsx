"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Info,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";

import { ModalNotice } from "@/components/shared/modal-notice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BASE_ROLE_ACCESS,
  BASE_ROLE_LABELS,
  CUSTOM_ROLE_BASES,
  ROLE_DESCRIPTION_MAX,
  ROLE_NAME_MAX,
  type CustomRoleBase,
} from "@/features/roles/roles";
import {
  TEAM_DIALOG_CONTENT,
  TEAM_DIALOG_FOOTER,
  TEAM_DIALOG_TITLE,
  TEAM_MODAL_BUTTON,
  TEAM_MODAL_BUTTON_DANGER,
  TEAM_MODAL_BUTTON_PRIMARY,
  TEAM_MODAL_CONTROL,
} from "@/features/team/components/modal-buttons";
import { cn } from "@/lib/utils";

import {
  createPlatformRoleAction,
  deletePlatformRoleAction,
  setPlatformRoleStatusAction,
  updatePlatformRoleAction,
} from "../actions/platform-roles.actions";
import { formatNumber } from "../format";
import type { PlatformRole } from "../services/platform-roles.service";
import {
  DataTable,
  FilterTabs,
  PLATFORM_BUTTON,
  PLATFORM_ICON_BUTTON,
  PLATFORM_STAT_GRID,
  PlatformFilterBar,
  PlatformPageHeader,
  SearchField,
  type DataColumn,
} from "./platform-ui";
import { StatCard } from "./stat-card";
import { ToneBadge } from "./status-badge";

type Filter = "all" | "custom" | "system" | "archived";

type Editing = { mode: "create" } | { mode: "edit"; role: PlatformRole };

type Confirming = { kind: "archive" | "delete"; role: PlatformRole };

function isCustomBase(value: string): value is CustomRoleBase {
  return (CUSTOM_ROLE_BASES as readonly string[]).includes(value);
}

function RoleFormDialog({
  editing,
  onClose,
}: {
  editing: Editing;
  onClose: () => void;
}) {
  const router = useRouter();
  const role = editing.mode === "edit" ? editing.role : null;
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [baseRole, setBaseRole] = useState<CustomRoleBase>(
    role && isCustomBase(role.baseRole) ? role.baseRole : "agent",
  );
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>(
    {},
  );
  const [isSaving, startSaving] = useTransition();

  // A tier is fixed on built-in roles, and on custom roles once held.
  const tierLocked = role !== null && (role.isSystem || role.members > 0);

  function save() {
    startSaving(async () => {
      const result = role
        ? await updatePlatformRoleAction({
            id: role.id,
            name,
            description,
            ...(tierLocked ? {} : { baseRole }),
          })
        : await createPlatformRoleAction({ name, description, baseRole });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }

      toast.success(
        role ? `${name.trim()} saved.` : `${name.trim()} role created.`,
      );
      router.refresh();
      onClose();
    });
  }

  return (
    <>
      <DialogHeader className="pr-6">
        <DialogTitle className={TEAM_DIALOG_TITLE}>
          {role ? `Edit ${role.name}` : "New role"}
        </DialogTitle>
        <DialogDescription>
          {role?.isSystem
            ? "Built-in role. You can rename it and change its description."
            : "Workspaces can give this role to team members. It has the same access as the level you pick."}
        </DialogDescription>
      </DialogHeader>

      <form
        id="role-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role-name" className="text-sm font-semibold">
            Name
          </Label>
          <Input
            id="role-name"
            value={name}
            maxLength={ROLE_NAME_MAX}
            placeholder="e.g. Senior Agent"
            className={cn("rounded-lg", TEAM_MODAL_CONTROL)}
            aria-invalid={Boolean(errors.name)}
            onChange={(event) => {
              setName(event.target.value);
              setErrors((current) => ({ ...current, name: undefined }));
            }}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role-description" className="text-sm font-semibold">
            Description
          </Label>
          <Textarea
            id="role-description"
            rows={3}
            maxLength={ROLE_DESCRIPTION_MAX}
            placeholder="What people with this role do"
            className="resize-none"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description[0]}</p>
          )}
        </div>

        {!role?.isSystem && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-base" className="text-sm font-semibold">
              Access level
            </Label>
            <Select
              value={baseRole}
              disabled={tierLocked}
              onValueChange={(value) => {
                if (isCustomBase(value)) setBaseRole(value);
              }}
            >
              <SelectTrigger
                id="role-base"
                className={cn("w-full rounded-lg", TEAM_MODAL_CONTROL)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                side="bottom"
                align="start"
                position="popper"
                className="p-1"
              >
                {CUSTOM_ROLE_BASES.map((base) => (
                  <SelectItem
                    key={base}
                    value={base}
                    className="cursor-pointer p-2"
                  >
                    Same as {BASE_ROLE_LABELS[base]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.baseRole && (
              <p className="text-xs text-destructive">{errors.baseRole[0]}</p>
            )}
          </div>
        )}
      </form>

      <ModalNotice
        icon={tierLocked && !role?.isSystem ? Lock : Info}
        tone="neutral"
        title={`${BASE_ROLE_LABELS[role?.isSystem ? role.baseRole : baseRole]} access`}
      >
        <span className="text-xs leading-[1.55]">
          {isCustomBase(role?.isSystem ? role.baseRole : baseRole)
            ? BASE_ROLE_ACCESS[
                (role?.isSystem ? role.baseRole : baseRole) as CustomRoleBase
              ]
            : "Not a workspace team role."}
          {tierLocked && !role?.isSystem && (
            <>
              {" "}
              {formatNumber(role.members)} member
              {role.members === 1 ? " holds" : "s hold"} this role, so its
              access level is fixed.
            </>
          )}
        </span>
      </ModalNotice>

      <DialogFooter className={cn(TEAM_DIALOG_FOOTER, "flex-row")}>
        <Button
          type="button"
          variant="outline"
          className={cn(TEAM_MODAL_BUTTON, "flex-1 sm:flex-none")}
          disabled={isSaving}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="role-form"
          className={cn(
            TEAM_MODAL_BUTTON,
            TEAM_MODAL_BUTTON_PRIMARY,
            "flex-1 sm:flex-none",
          )}
          disabled={isSaving || name.trim().length < 2}
        >
          {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {role ? "Save role" : "Create role"}
        </Button>
      </DialogFooter>
    </>
  );
}

function ConfirmDialog({
  confirming,
  onClose,
}: {
  confirming: Confirming;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { kind, role } = confirming;
  const isDelete = kind === "delete";

  function confirm() {
    startTransition(async () => {
      const result = isDelete
        ? await deletePlatformRoleAction({ id: role.id })
        : await setPlatformRoleStatusAction({
            id: role.id,
            status: "archived",
          });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(
        isDelete ? `${role.name} deleted.` : `${role.name} archived.`,
      );
      router.refresh();
      onClose();
    });
  }

  return (
    <>
      <DialogHeader className="pr-6">
        <DialogTitle className={TEAM_DIALOG_TITLE}>
          {isDelete ? `Delete ${role.name}?` : `Archive ${role.name}?`}
        </DialogTitle>
        <DialogDescription>
          {isDelete
            ? "Nobody holds this role. It will be removed for good."
            : "Workspaces will no longer be able to give out this role."}
        </DialogDescription>
      </DialogHeader>

      <ModalNotice
        icon={TriangleAlert}
        tone={isDelete ? "danger" : "neutral"}
        title="What happens next"
      >
        <span className="text-xs leading-[1.55]">
          {isDelete
            ? "This can't be undone. Create the role again if you need it later."
            : role.members > 0
              ? `${formatNumber(role.members)} member${role.members === 1 ? " keeps" : "s keep"} this role and its access until a workspace admin changes it. You can restore it at any time.`
              : "You can restore it at any time."}
        </span>
      </ModalNotice>

      <DialogFooter className={cn(TEAM_DIALOG_FOOTER, "flex-row")}>
        <Button
          type="button"
          variant="outline"
          className={cn(TEAM_MODAL_BUTTON, "flex-1 sm:flex-none")}
          disabled={isPending}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className={cn(
            TEAM_MODAL_BUTTON,
            isDelete ? TEAM_MODAL_BUTTON_DANGER : TEAM_MODAL_BUTTON_PRIMARY,
            "flex-1 sm:flex-none",
          )}
          disabled={isPending}
          onClick={confirm}
        >
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {isDelete ? "Delete role" : "Archive role"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function RolesManager({ roles }: { roles: PlatformRole[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [isRestoring, startRestoring] = useTransition();

  const counts = useMemo(
    () => ({
      all: roles.filter((role) => role.status === "active").length,
      custom: roles.filter((r) => !r.isSystem && r.status === "active").length,
      system: roles.filter((role) => role.isSystem).length,
      archived: roles.filter((role) => role.status === "archived").length,
    }),
    [roles],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    return roles.filter((role) => {
      if (filter === "archived" && role.status !== "archived") return false;
      if (filter !== "archived" && role.status === "archived") return false;
      if (filter === "custom" && role.isSystem) return false;
      if (filter === "system" && !role.isSystem) return false;

      return (
        !q ||
        role.name.toLowerCase().includes(q) ||
        role.description.toLowerCase().includes(q) ||
        BASE_ROLE_LABELS[role.baseRole].toLowerCase().includes(q)
      );
    });
  }, [roles, filter, query]);

  const totalMembers = roles.reduce((sum, role) => sum + role.members, 0);
  const customMembers = roles
    .filter((role) => !role.isSystem)
    .reduce((sum, role) => sum + role.members, 0);

  function restore(role: PlatformRole) {
    startRestoring(async () => {
      const result = await setPlatformRoleStatusAction({
        id: role.id,
        status: "active",
      });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(`${role.name} restored.`);
      router.refresh();
    });
  }

  const columns: DataColumn<PlatformRole>[] = [
    {
      key: "name",
      header: "Role",
      primary: true,
      cell: (role) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold text-foreground">{role.name}</span>
          {role.description && (
            <span className="text-xs text-muted-foreground">
              {role.description}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (role) =>
        role.isSystem ? (
          <ToneBadge tone="muted">Built-in</ToneBadge>
        ) : (
          <ToneBadge tone="violet">Custom</ToneBadge>
        ),
    },
    {
      key: "access",
      header: "Access level",
      cell: (role) => (
        <span className="whitespace-nowrap">
          {BASE_ROLE_LABELS[role.baseRole]}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (role) =>
        role.status === "active" ? (
          <ToneBadge tone="green">Active</ToneBadge>
        ) : (
          <ToneBadge tone="muted">Archived</ToneBadge>
        ),
    },
    {
      key: "members",
      header: "Members",
      align: "right",
      cell: (role) => (
        <span className="tabular-nums">{formatNumber(role.members)}</span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (role) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={PLATFORM_ICON_BUTTON}
              aria-label={`Actions for ${role.name}`}
              disabled={isRestoring}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              className="cursor-pointer p-2"
              onSelect={() => setEditing({ mode: "edit", role })}
            >
              <Pencil className="size-4" aria-hidden />
              Edit
            </DropdownMenuItem>
            {!role.isSystem &&
              (role.status === "active" ? (
                <DropdownMenuItem
                  className="cursor-pointer p-2"
                  onSelect={() => setConfirming({ kind: "archive", role })}
                >
                  <Archive className="size-4" aria-hidden />
                  Archive
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="cursor-pointer p-2"
                  onSelect={() => restore(role)}
                >
                  <ArchiveRestore className="size-4" aria-hidden />
                  Restore
                </DropdownMenuItem>
              ))}
            {!role.isSystem && role.members === 0 && (
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer p-2"
                onSelect={() => setConfirming({ kind: "delete", role })}
              >
                <Trash2 className="size-4" aria-hidden />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PlatformPageHeader
        title="Roles"
        description="The roles workspaces can give their team. Each role has the access of one built-in level."
        action={
          <Button
            className={cn(
              PLATFORM_BUTTON,
              "w-full gap-1.5 bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 sm:w-auto",
            )}
            onClick={() => setEditing({ mode: "create" })}
          >
            <Plus className="size-4" aria-hidden />
            New role
          </Button>
        }
      />

      <div className={PLATFORM_STAT_GRID}>
        <StatCard
          label="Active roles"
          value={formatNumber(counts.all)}
          icon={ShieldCheck}
        />
        <StatCard
          label="Custom roles"
          value={formatNumber(counts.custom)}
          icon={Plus}
          iconClassName="bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
        />
        <StatCard
          label="Members on custom roles"
          value={formatNumber(customMembers)}
          icon={Users}
          iconClassName="bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
        />
        <StatCard
          label="Memberships"
          value={formatNumber(totalMembers)}
          hint="Across every workspace"
          icon={Users}
          iconClassName="bg-muted text-muted-foreground"
        />
      </div>

      <div className="flex flex-col gap-4">
        <PlatformFilterBar
          tabs={
            <FilterTabs
              label="Filter roles"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: counts.all },
                { value: "custom", label: "Custom", count: counts.custom },
                { value: "system", label: "Built-in", count: counts.system },
                {
                  value: "archived",
                  label: "Archived",
                  count: counts.archived,
                },
              ]}
            />
          }
          search={
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search roles"
              label="Search roles"
            />
          }
        />

        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(role) => role.id}
          empty={
            filter === "archived"
              ? "No archived roles."
              : "No roles match your search."
          }
        />
      </div>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent
          onOpenAutoFocus={(event) => event.preventDefault()}
          className={cn("sm:max-w-115", TEAM_DIALOG_CONTENT)}
        >
          {editing && (
            <RoleFormDialog
              key={editing.mode === "edit" ? editing.role.id : "new"}
              editing={editing}
              onClose={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <DialogContent className={cn("sm:max-w-115", TEAM_DIALOG_CONTENT)}>
          {confirming && (
            <ConfirmDialog
              key={`${confirming.kind}:${confirming.role.id}`}
              confirming={confirming}
              onClose={() => setConfirming(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
