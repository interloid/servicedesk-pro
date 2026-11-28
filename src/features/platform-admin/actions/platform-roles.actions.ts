"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  CUSTOM_ROLE_BASES,
  ROLE_DESCRIPTION_MAX,
  ROLE_NAME_MAX,
} from "@/features/roles/roles";

import { requirePlatformAdmin } from "../services/platform-access";
import {
  createPlatformRole,
  deletePlatformRole,
  setPlatformRoleStatus,
  updatePlatformRole,
} from "../services/platform-roles.service";
import { userErrorMessage } from "@/lib/user-error";

type ActionResult =
  | { success: true }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

const name = z
  .string()
  .trim()
  .min(2, "Give the role a name of at least 2 characters.")
  .max(ROLE_NAME_MAX, `Keep the name under ${ROLE_NAME_MAX} characters.`)
  .regex(/[a-z]/i, "The name needs at least one letter.");

const description = z
  .string()
  .trim()
  .max(
    ROLE_DESCRIPTION_MAX,
    `Keep the description under ${ROLE_DESCRIPTION_MAX} characters.`,
  );

const baseRole = z.enum(CUSTOM_ROLE_BASES, "Pick an access level.");

const createSchema = z.object({ name, description, baseRole });

const updateSchema = z.object({
  id: z.uuid(),
  name,
  description,
  // Left out for built-in roles, whose tier is fixed.
  baseRole: baseRole.optional(),
});

const idSchema = z.object({ id: z.uuid() });

const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["active", "archived"]),
});

async function run(
  label: string,
  schema: z.ZodType,
  input: unknown,
  write: (data: never, actorId: string) => Promise<void>,
): Promise<ActionResult> {
  const admin = await requirePlatformAdmin();
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }

  try {
    await write(parsed.data as never, admin.id);
  } catch (error) {
    console.error(`[platform] role ${label} failed:`, error);

    return {
      success: false,
      message: userErrorMessage(error, `Couldn't ${label} the role.`),
    };
  }

  // audit_logs rows belong to a workspace, and a role belongs to none.
  console.info(`[platform] role ${label} by ${admin.email}`);
  revalidatePath("/platform/roles");
  // The Team pages list the active roles.
  revalidatePath("/", "layout");

  return { success: true };
}

export async function createPlatformRoleAction(
  input: unknown,
): Promise<ActionResult> {
  return run(
    "create",
    createSchema,
    input,
    (data: z.infer<typeof createSchema>, actorId) =>
      createPlatformRole(data, actorId),
  );
}

export async function updatePlatformRoleAction(
  input: unknown,
): Promise<ActionResult> {
  return run(
    "update",
    updateSchema,
    input,
    (data: z.infer<typeof updateSchema>, actorId) =>
      updatePlatformRole(data, actorId),
  );
}

export async function setPlatformRoleStatusAction(
  input: unknown,
): Promise<ActionResult> {
  return run(
    "status change",
    statusSchema,
    input,
    (data: z.infer<typeof statusSchema>, actorId) =>
      setPlatformRoleStatus(data.id, data.status, actorId),
  );
}

export async function deletePlatformRoleAction(
  input: unknown,
): Promise<ActionResult> {
  return run("delete", idSchema, input, (data: z.infer<typeof idSchema>) =>
    deletePlatformRole(data.id),
  );
}
