"use server";

import { revalidatePath } from "next/cache";

import { getSessionTenantSlug } from "@/features/tenancy/services/tenant-resolver";
import { TENANT_ROUTES, tenantPath } from "@/lib/tenancy";

import {
  createSupportRequestSchema,
  supportAccessSchema,
  supportReplySchema,
  supportRequestIdSchema,
} from "./schemas";
import {
  closeMySupportRequest,
  createSupportRequest,
  replyAsTenant,
  setWorkspaceAccess,
  SupportError,
} from "./services/support.service";

export type SupportActionResult<T = undefined> =
  | { ok: true; data?: T }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

type Failure = Extract<SupportActionResult, { ok: false }>;

function failure(error: unknown, fallback: string): Failure {
  if (error instanceof SupportError) {
    return { ok: false, message: error.message };
  }

  console.error(`[support] ${fallback}`, error);

  return { ok: false, message: `${fallback} Try again in a moment.` };
}

async function revalidateSupport() {
  const slug = await getSessionTenantSlug();

  if (slug) {
    revalidatePath(tenantPath(slug, TENANT_ROUTES.SUPPORT.HOME), "layout");
  }

  revalidatePath("/platform/tenants");
}

export async function createSupportRequestAction(
  values: unknown,
): Promise<SupportActionResult<{ id: string; number: string }>> {
  const parsed = createSupportRequestSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const data = await createSupportRequest(parsed.data);
    await revalidateSupport();
    return { ok: true, data };
  } catch (error) {
    return failure(error, "We couldn't send your request.");
  }
}

export async function replySupportRequestAction(
  values: unknown,
): Promise<SupportActionResult> {
  const parsed = supportReplySchema.safeParse(values);

  if (!parsed.success) {
    return { ok: false, message: "Write a message first." };
  }

  try {
    await replyAsTenant(parsed.data.requestId, parsed.data.body);
    await revalidateSupport();
    return { ok: true };
  } catch (error) {
    return failure(error, "We couldn't send your reply.");
  }
}

export async function setSupportAccessAction(
  values: unknown,
): Promise<SupportActionResult> {
  const parsed = supportAccessSchema.safeParse(values);

  if (!parsed.success) {
    return { ok: false, message: "That isn't a change we can make." };
  }

  try {
    await setWorkspaceAccess(parsed.data.requestId, parsed.data.allow);
    await revalidateSupport();
    return { ok: true };
  } catch (error) {
    return failure(error, "We couldn't update workspace access.");
  }
}

export async function closeSupportRequestAction(
  values: unknown,
): Promise<SupportActionResult> {
  const parsed = supportRequestIdSchema.safeParse(values);

  if (!parsed.success) {
    return { ok: false, message: "That request doesn't exist." };
  }

  try {
    await closeMySupportRequest(parsed.data.requestId);
    await revalidateSupport();
    return { ok: true };
  } catch (error) {
    return failure(error, "We couldn't close the request.");
  }
}
