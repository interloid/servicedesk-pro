import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type { PlatformTenantInvoice } from "../types";

/** Long enough to start a download, short enough that a copied link dies. */
const DOWNLOAD_LINK_TTL_SECS = 60;

/** storage_path is stored as "invoices/<tenant>/<file>" or "<tenant>/<file>". */
function objectPathOf(storagePath: string | null): string | null {
  return storagePath
    ? storagePath.replace(/^invoices\//, "").replace(/^\//, "")
    : null;
}

function invoiceNumberOf(row: { id: string; invoice_number: string | null }) {
  return row.invoice_number || `INV-${row.id.slice(0, 8).toUpperCase()}`;
}

/** Every invoice of one workspace, newest first. Service role: the console reads any tenant. */
export async function listTenantInvoices(
  tenantId: string,
): Promise<PlatformTenantInvoice[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("invoices")
    .select(
      "id, invoice_number, invoice_type, plan_name, amount, amount_paid, currency, status, period_start, period_end, paid_at, created_at, storage_path",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(`[platform] invoices query failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    number: invoiceNumberOf(row),
    type: row.invoice_type === "one_time" ? "one_time" : "recurring",
    plan: row.plan_name ?? "—",
    // What was paid on a paid invoice; what was billed on any other (an
    // unpaid or failed one has amount_paid 0).
    amount: Number(
      (row.status === "paid" ? row.amount_paid : null) ?? row.amount ?? 0,
    ),
    currency: row.currency || "USD",
    status: row.status,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    date: row.paid_at ?? row.created_at ?? row.period_start,
    hasPdf: Boolean(objectPathOf(row.storage_path)),
  }));
}

/**
 * A one-minute signed link that downloads the invoice PDF as
 * "<invoice number>.pdf", or null when the invoice has no stored PDF.
 */
export async function invoiceDownloadUrl(
  invoiceId: string,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("invoices")
    .select("id, invoice_number, storage_path")
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) {
    throw new Error(`[platform] invoice lookup failed: ${error.message}`);
  }

  const path = objectPathOf(row?.storage_path ?? null);

  if (!row || !path) return null;

  const { data: signed, error: signError } = await admin.storage
    .from("invoices")
    .createSignedUrl(path, DOWNLOAD_LINK_TTL_SECS, {
      download: `${invoiceNumberOf(row)}.pdf`,
    });

  if (signError || !signed?.signedUrl) {
    throw new Error(
      `[platform] signing invoice ${invoiceId} failed: ${signError?.message ?? "no URL"}`,
    );
  }

  return signed.signedUrl;
}
