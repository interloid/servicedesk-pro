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
  ShieldPlus,
  Trash2,
  TriangleAlert,
  UserCog,
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
  PLATFORM_CARD,
  PLATFORM_ICON_BUTTON,
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
        toast.error(
          role ? `Couldn't save ${role.name}` : "Couldn't create the role",
          { description: result.message },
        );
        return;
      }

      toast.success(
        role ? `${name.trim()} role updated` : `${name.trim()} role created`,
        {
          description: role
            ? "Workspaces using this role see the change right away."
            : `Workspaces can now give it to their team, with ${BASE_ROLE_LABELS[baseRole]} access.`,
        },
      );
      router.refresh();
      onClose();
    });
  }

  return (
    <>
      <DialogHeader className="flex-row items-start gap-3.5 pr-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <ShieldCheck className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <DialogTitle className={cn(TEAM_DIALOG_TITLE, "font-heading")}>
            {role ? `Edit ${role.name}` : "New role"}
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            {role?.isSystem
              ? "Built-in role. You can rename it and change its description."
              : "Workspaces can give this role to their team. It gets the access of the level you pick."}
          </DialogDescription>
        </div>
      </DialogHeader>

      <form
        id="role-form"
        className="flex flex-col gap-5"
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
          <div className="flex justify-between gap-3 text-xs">
            <span className="text-destructive">{errors.name?.[0]}</span>
            <span className="shrink-0 text-slate-400 tabular-nums">
              {name.length}/{ROLE_NAME_MAX}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="role-description"
            className="flex items-baseline justify-between text-sm font-semibold"
          >
            Description
            <span className="text-xs font-normal text-slate-400">Optional</span>
          </Label>
          <Textarea
            id="role-description"
            rows={3}
            maxLength={ROLE_DESCRIPTION_MAX}
            placeholder="What people with this role do"
            className="min-h-20 resize-none rounded-lg"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="flex justify-between gap-3 text-xs">
            <span className="text-destructive">{errors.description?.[0]}</span>
            <span className="shrink-0 text-slate-400 tabular-nums">
              {description.length}/{ROLE_DESCRIPTION_MAX}
            </span>
          </div>
        </div>

        {role?.isSystem ? (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-slate-50 px-3.5 py-3">
            <Info
              className="mt-0.5 size-4 shrink-0 text-slate-500"
              aria-hidden
            />
            <p className="text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-foreground">
                {BASE_ROLE_LABELS[role.baseRole]} access.
              </span>{" "}
              {isCustomBase(role.baseRole)
                ? BASE_ROLE_ACCESS[role.baseRole]
                : "Not a workspace team role."}
            </p>
          </div>
        ) : (
          <fieldset className="flex flex-col gap-2" disabled={tierLocked}>
            <legend className="mb-1.5 text-sm font-semibold">
              Access level
            </legend>
            <div
              role="radiogroup"
              aria-label="Access level"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {CUSTOM_ROLE_BASES.map((base) => {
                const selected = base === baseRole;
                return (
                  <button
                    key={base}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setBaseRole(base)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-brand-700/20 disabled:cursor-not-allowed",
                      selected
                        ? "border-brand-700! bg-brand-700/5"
                        : "hover:border-slate-400! hover:bg-slate-50 disabled:hover:border-border! disabled:hover:bg-transparent",
                      tierLocked && !selected && "opacity-50",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                        selected ? "border-brand-700!" : "border-slate-300!",
                      )}
                    >
                      {selected && (
                        <span className="size-1.5 rounded-full bg-brand-700" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-semibold text-foreground">
                        {BASE_ROLE_LABELS[base]}
                      </span>
                      <span className="text-xs leading-snug text-slate-500">
                        {BASE_ROLE_ACCESS[base]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {tierLocked && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Lock className="size-3.5 shrink-0" aria-hidden />
                {formatNumber(role.members)} member
                {role.members === 1 ? " holds" : "s hold"} this role, so its
                access level is fixed.
              </p>
            )}
            {errors.baseRole && (
              <p className="text-xs text-destructive">{errors.baseRole[0]}</p>
            )}
          </fieldset>
        )}
      </form>

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
        toast.error(
          isDelete
            ? `Couldn't delete ${role.name}`
            : `Couldn't archive ${role.name}`,
          { description: result.message },
        );
        return;
      }

      toast.success(
        isDelete ? `${role.name} role deleted` : `${role.name} role archived`,
        {
          description: isDelete
            ? "It's removed for good and no longer appears anywhere."
            : "Workspaces can't give it to new members. You can restore it any time.",
        },
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
        toast.error(`Couldn't restore ${role.name}`, {
          description: result.message,
        });
        return;
      }

      toast.success(`${role.name} role restored`, {
        description: "Workspaces can give it to their team again.",
      });
      router.refresh();
    });
  }

  const columns: DataColumn<PlatformRole>[] = [
    {
      key: "name",
      header: "Role",
      primary: true,
      cell: (role) => (
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              role.isSystem
                ? "bg-slate-100 text-slate-600"
                : "bg-violet-50 text-violet-600",
              role.status !== "active" && "opacity-50",
            )}
          >
            {role.isSystem ? (
              <Lock className="size-4" strokeWidth={1.75} aria-hidden />
            ) : (
              <ShieldPlus className="size-4" strokeWidth={1.75} aria-hidden />
            )}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-semibold text-foreground">{role.name}</span>
            {role.description && (
              <span
                className="line-clamp-1 text-xs text-slate-500"
                title={role.description}
              >
                {role.description}
              </span>
            )}
          </div>
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
        <span className="flex items-center gap-2 whitespace-nowrap text-slate-700">
          <ShieldCheck
            className="size-4 shrink-0 text-slate-400"
            strokeWidth={1.75}
            aria-hidden
          />
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
        <span className="inline-flex items-center justify-end gap-1.5 font-semibold tabular-nums">
          <Users
            className="size-3.5 text-slate-400"
            strokeWidth={1.75}
            aria-hidden
          />
          {formatNumber(role.members)}
        </span>
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
        eyebrow="Manage platform"
        icon={ShieldCheck}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active roles"
          value={formatNumber(counts.all)}
          icon={ShieldCheck}
          iconClassName="bg-brand-50 text-brand-700"
        />
        <StatCard
          label="Custom roles"
          value={formatNumber(counts.custom)}
          icon={ShieldPlus}
          iconClassName="bg-violet-50 text-violet-600"
        />
        <StatCard
          label="Members on custom roles"
          value={formatNumber(customMembers)}
          icon={UserCog}
          iconClassName="bg-sky-50 text-sky-600"
        />
        <StatCard
          label="Memberships"
          value={formatNumber(totalMembers)}
          hint="Across every workspace"
          icon={Users}
          iconClassName="bg-amber-50 text-amber-600"
        />
      </div>

      <div className="flex flex-col gap-4">
        {/* One toolbar: type tabs on the left, search on the right. */}
        <div
          className={cn(
            PLATFORM_CARD,
            "flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          <div className="min-w-0">
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
          </div>
          <div className="w-full sm:max-w-72">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search roles"
              label="Search roles"
            />
          </div>
        </div>

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
          className={cn(
            "max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-130",
            TEAM_DIALOG_CONTENT,
          )}
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
        <DialogContent
          className={cn(
            "max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-115",
            TEAM_DIALOG_CONTENT,
          )}
        >
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
