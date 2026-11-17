"use server";

import { z } from "zod";

import { requirePlatformAdmin } from "../services/platform-access";
import { listTenantInvoices } from "../services/platform-invoices.service";
import type { PlatformTenantInvoice } from "../types";

const inputSchema = z.object({ tenantId: z.uuid() });

export async function listTenantInvoicesAction(
  input: unknown,
): Promise<
  | { success: true; invoices: PlatformTenantInvoice[] }
  | { success: false; message: string }
> {
  await requirePlatformAdmin();
  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "That workspace doesn't exist." };
  }

  try {
    return {
      success: true,
      invoices: await listTenantInvoices(parsed.data.tenantId),
    };
  } catch (error) {
    console.error("[platform] listing invoices failed:", error);

    return {
      success: false,
      message: "Couldn't load this workspace's invoices.",
    };
  }
}
