"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { MAX_PLAN_LIMIT, PLAN_LIMIT_TOO_BIG } from "../plan-limits";
import { requirePlatformAdmin } from "../services/platform-access";
import { updatePlatformPlan } from "../services/platform-plans.service";
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
