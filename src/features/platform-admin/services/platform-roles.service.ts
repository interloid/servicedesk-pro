import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMembershipRole } from "@/types/team-members";

import {
  roleKeyFromName,
  type CustomRoleBase,
  type RoleDefinition,
  type RoleStatus,
} from "@/features/roles/roles";

export type PlatformRole = RoleDefinition & {
  /** Memberships holding this role, in every workspace, any status. */
  members: number;
};

type RoleRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  base_role: string;
  is_system: boolean;
  status: string;
  sort_order: number;
  updated_at: string;
};

const ROLE_COLUMNS =
  "id, key, name, description, base_role, is_system, status, sort_order, updated_at";

/** Postgres raises these from the roles triggers and constraints. */
function roleErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    return "A role with that name already exists.";
  }

  // guard_roles() and apply_membership_role() raise readable messages.
  if (error.code === "42501" || error.code === "23514") {
    return error.message;
  }

  if (error.code === "23503") {
    return "This role is still held by members, so it can't be deleted. Archive it instead.";
  }

  return "Couldn't save the role.";
}

function toRole(row: RoleRow): RoleDefinition {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    baseRole: isMembershipRole(row.base_role) ? row.base_role : "agent",
    isSystem: row.is_system,
    status: row.status === "archived" ? "archived" : "active",
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

export async function getPlatformRoles(): Promise<PlatformRole[]> {
  const admin = createSupabaseAdminClient();
  const roles = await admin
    .from("roles")
    .select(ROLE_COLUMNS)
    .order("sort_order")
    .order("name")
    .returns<RoleRow[]>();

  if (roles.error) {
    throw new Error(`[platform] roles query failed: ${roles.error.message}`);
  }

  const rows = roles.data ?? [];

  // Counted by the database: the API returns at most 1,000 rows.
  const usage = await Promise.all(
    rows.map((row) =>
      admin
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("role_id", row.id),
    ),
  );
  const failed = usage.find((result) => result.error);

  if (failed?.error) {
    throw new Error(`[platform] role usage failed: ${failed.error.message}`);
  }

  return rows.map((row, index) => ({
    ...toRole(row),
    members: usage[index].count ?? 0,
  }));
}

/** A key not already taken: "senior_agent", then "senior_agent_2", … */
async function freeKey(name: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const base = roleKeyFromName(name);
  const { data, error } = await admin
    .from("roles")
    .select("key")
    .like("key", `${base}%`);

  if (error) {
    throw new Error(`Couldn't check role names: ${error.message}`);
  }

  const taken = new Set((data ?? []).map((row) => row.key));

  if (!taken.has(base)) return base;

  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}_${n}`;
    if (!taken.has(candidate)) return candidate;
  }

  throw new Error("Couldn't find a free key for that role name.");
}

export async function createPlatformRole(
  input: {
    name: string;
    description: string;
    baseRole: CustomRoleBase;
  },
  actorId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("roles").insert({
    key: await freeKey(input.name),
    name: input.name,
    description: input.description,
    base_role: input.baseRole,
    is_system: false,
    // After the built-in staff roles, before Customer and Platform Admin.
    sort_order: 50,
    created_by: actorId,
    updated_by: actorId,
  });

  if (error) {
    throw new Error(roleErrorMessage(error));
  }
}

/**
 * A built-in role's name and description can change; its tier can't (the
 * guard_roles trigger enforces it). A custom role's tier only while nobody
 * holds it.
 */
export async function updatePlatformRole(
  input: {
    id: string;
    name: string;
    description: string;
    baseRole?: CustomRoleBase;
  },
  actorId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("roles")
    .update({
      name: input.name,
      description: input.description,
      ...(input.baseRole ? { base_role: input.baseRole } : {}),
      updated_by: actorId,
    })
    .eq("id", input.id)
    .select("id");

  if (error) {
    throw new Error(roleErrorMessage(error));
  }

  if (!data?.length) {
    throw new Error("That role no longer exists.");
  }
}

/** Archived roles stay on whoever holds them, but can't be handed out. */
export async function setPlatformRoleStatus(
  id: string,
  status: RoleStatus,
  actorId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("roles")
    .update({ status, updated_by: actorId })
    .eq("id", id)
    .eq("is_system", false)
    .select("id");

  if (error) {
    throw new Error(roleErrorMessage(error));
  }

  if (!data?.length) {
    throw new Error("Built-in roles can't be archived.");
  }
}

/** Only a custom role nobody holds; the FK refuses anything else. */
export async function deletePlatformRole(id: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("roles")
    .delete()
    .eq("id", id)
    .eq("is_system", false)
    .select("id");

  if (error) {
    throw new Error(roleErrorMessage(error));
  }

  if (!data?.length) {
    throw new Error("Built-in roles can't be deleted.");
  }
}
