"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { inviteCustomerSchema } from "@/features/customers/schemas/customers";
import {
  CustomerInviteError,
  type CustomerInviteFailure,
  inviteCustomer,
  inviteExistingCustomer,
  setCustomerPortalAccess,
} from "@/features/customers/services/customer-invite.service";
import { getSessionTenantSlug } from "@/features/tenancy/services/tenant-resolver";
import { inviteNotEmailedNotice } from "@/lib/email/recipient-allow-list";
import { TENANT_ROUTES, tenantPath } from "@/lib/tenancy";

export type InviteCustomerResult =
  /** `notice`: shown instead of the usual toast (e.g. email held back). */
  | { ok: true; notice?: string }
  | {
      ok: false;
      failureCode: CustomerInviteFailure | "validation";
      message: string;
    };

export async function inviteCustomerAction(
  values: unknown,
): Promise<InviteCustomerResult> {
  const parsed = inviteCustomerSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      failureCode: "validation",
      message: "Check the highlighted fields and try again.",
    };
  }

  let emailed: boolean;

  try {
    emailed = await inviteCustomer(parsed.data);
  } catch (error) {
    return toFailure(
      error,
      "We couldn't send that invite. Try again in a moment.",
    );
  }

  await revalidateCustomers();

  return emailed
    ? { ok: true }
    : { ok: true, notice: inviteNotEmailedNotice(parsed.data.email) };
}

/** The list and every customer page under it (`layout` covers the detail). */
async function revalidateCustomers() {
  const slug = await getSessionTenantSlug();

  if (slug) {
    revalidatePath(tenantPath(slug, TENANT_ROUTES.CUSTOMERS), "layout");
  }
}

function toFailure(error: unknown, fallback: string): InviteCustomerResult {
  if (error instanceof CustomerInviteError) {
    return { ok: false, failureCode: error.code, message: error.message };
  }

  console.error("[customers] action failed", error);

  return { ok: false, failureCode: "unknown", message: fallback };
}

const customerAccessSchema = z.object({
  customerId: z.uuid(),
  enabled: z.boolean(),
});

/** Disable or re-enable a customer's portal access. Tenant Admin only. */
export async function setCustomerAccessAction(
  values: unknown,
): Promise<InviteCustomerResult> {
  const parsed = customerAccessSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      failureCode: "validation",
      message: "That isn't a customer we can update.",
    };
  }

  try {
    await setCustomerPortalAccess(parsed.data.customerId, parsed.data.enabled);
  } catch (error) {
    return toFailure(error, "We couldn't change their access. Try again.");
  }

  await revalidateCustomers();

  return { ok: true };
}

/** Invite a customer already on the list, or resend a pending invite. */
export async function inviteExistingCustomerAction(
  values: unknown,
): Promise<InviteCustomerResult> {
  const parsed = z.object({ customerId: z.uuid() }).safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      failureCode: "validation",
      message: "That isn't a customer we can invite.",
    };
  }

  let emailed: boolean;

  try {
    emailed = await inviteExistingCustomer(parsed.data.customerId);
  } catch (error) {
    return toFailure(error, "We couldn't send that invite. Try again.");
  }

  await revalidateCustomers();

  return emailed
    ? { ok: true }
    : { ok: true, notice: inviteNotEmailedNotice() };
}
