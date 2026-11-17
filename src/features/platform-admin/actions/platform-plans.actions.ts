"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { MAX_PLAN_LIMIT, PLAN_LIMIT_TOO_BIG } from "../plan-limits";
import { requirePlatformAdmin } from "../services/platform-access";
import {
  createPlatformPlan,
  PlatformPlanError,
  setPlatformPlanActive,
  updatePlatformPlan,
} from "../services/platform-plans.service";
import { PLAN_FEATURES, UNLIMITED_SEATS, type PlanFeatureKey } from "../types";

const planSchema = z.object({
  id: z.string().uuid(),
  description: z
    .string()
    .trim()
    .max(300, "Keep the description under 300 characters."),
  seatLimit: z
    .number()
    .int("Enter a whole number.")
    .min(1, "A plan needs at least 1 seat.")
    // UNLIMITED_SEATS itself is how the form saves "No limit".
    .max(UNLIMITED_SEATS, PLAN_LIMIT_TOO_BIG),
  slaPolicies: z
    .number()
    .int("Enter a whole number.")
    .refine((value) => value === -1 || value >= 1, "Enter at least 1.")
    .refine((value) => value <= MAX_PLAN_LIMIT, PLAN_LIMIT_TOO_BIG),
  features: z.object(
    Object.fromEntries(
      PLAN_FEATURES.map(({ key }) => [key, z.boolean()]),
    ) as Record<PlanFeatureKey, z.ZodBoolean>,
  ),
});

export async function savePlatformPlanAction(input: unknown): Promise<
  | { success: true }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    }
> {
  const admin = await requirePlatformAdmin();
  const parsed = planSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updatePlatformPlan(parsed.data);
  } catch (error) {
    console.error("[platform] plan save failed:", error);

    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Couldn't save the plan.",
    };
  }

  // audit_logs rows belong to a workspace, and a plan belongs to none.
  console.info(`[platform] plan ${parsed.data.id} changed by ${admin.email}`);
  revalidatePath("/", "layout");

  return { success: true };
}

const createPlanSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter a plan name.")
    .max(40, "Keep the name under 40 characters.")
    .refine((name) => name.toLowerCase() !== "free", "Free already exists."),
  // PayPal billing plan ids look like P-0HG79944PA599763KNKX3UAI.
  code: z
    .string()
    .trim()
    .regex(/^P-[A-Z0-9]{10,}$/, "Paste the PayPal plan ID (P-…)."),
  price: z
    .number("Enter a price.")
    .positive("A new plan is paid: enter a price above 0.")
    .max(100000, "Enter a smaller price.")
    .refine(
      (value) => Math.round(value * 100) === value * 100,
      "Use at most 2 decimals.",
    ),
  description: z
    .string()
    .trim()
    .max(300, "Keep the description under 300 characters."),
  seatLimit: z
    .number()
    .int("Enter a whole number.")
    .min(1, "A plan needs at least 1 seat.")
    .max(UNLIMITED_SEATS, PLAN_LIMIT_TOO_BIG),
});

type PlanResult =
  | { success: true }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export async function createPlatformPlanAction(
  input: unknown,
): Promise<PlanResult> {
  const admin = await requirePlatformAdmin();
  const parsed = createPlanSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await createPlatformPlan(parsed.data);
  } catch (error) {
    if (error instanceof PlatformPlanError) {
      return { success: false, message: error.message };
    }

    console.error("[platform] plan create failed:", error);
    return { success: false, message: "Couldn't create the plan." };
  }

  console.info(`[platform] plan ${parsed.data.name} created by ${admin.email}`);
  revalidatePath("/", "layout");

  return { success: true };
}

const planActiveSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

/** Deprecate or show a plan. There is no delete. */
export async function setPlatformPlanActiveAction(
  input: unknown,
): Promise<PlanResult> {
  const admin = await requirePlatformAdmin();
  const parsed = planActiveSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "That plan wasn't found." };
  }

  try {
    const { name } = await setPlatformPlanActive(
      parsed.data.id,
      parsed.data.isActive,
    );
    console.info(
      `[platform] plan ${name} ${parsed.data.isActive ? "shown" : "deprecated"} by ${admin.email}`,
    );
  } catch (error) {
    if (error instanceof PlatformPlanError) {
      return { success: false, message: error.message };
    }

    console.error("[platform] plan status change failed:", error);
    return { success: false, message: "Couldn't update the plan." };
  }

  revalidatePath("/", "layout");

  return { success: true };
}
