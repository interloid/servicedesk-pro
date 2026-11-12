import "server-only";

import { getActorOrNull } from "@/features/team/services/team.service";
import { demoOutboxEnabled } from "@/lib/email/recipient-allow-list";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** How many captured emails the page lists, newest first. */
export const DEMO_OUTBOX_LIMIT = 100;

export type DemoOutboxItem = {
  id: string;
  kind: string;
  recipient: string;
  subject: string;
  linkWithheld: boolean;
  createdAt: string;
};

export type DemoOutboxEmail = DemoOutboxItem & { html: string };

/**
 * The page exists only while EMAIL_DEMO_OUTBOX is on, and only for Tenant
 * Admins: a captured email can hold a working invite link for a new admin.
 * RLS (demo_outbox_select) enforces the same rule on the data.
 */
export async function canViewDemoOutbox(): Promise<boolean> {
  if (!demoOutboxEnabled()) {
    return false;
  }

  const actor = await getActorOrNull();

  return actor?.role === "Tenant Admin";
}

/** Read through the signed-in user's client, so RLS scopes it. */
export async function listDemoOutbox(): Promise<DemoOutboxItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("demo_outbox")
    .select("id, kind, recipient, subject, link_withheld, created_at")
    .order("created_at", { ascending: false })
    .limit(DEMO_OUTBOX_LIMIT);

  if (error) {
    throw new Error(`demo outbox list failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    recipient: row.recipient,
    subject: row.subject,
    linkWithheld: row.link_withheld,
    createdAt: row.created_at,
  }));
}

export async function getDemoOutboxEmail(
  id: string,
): Promise<DemoOutboxEmail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("demo_outbox")
    .select("id, kind, recipient, subject, link_withheld, created_at, html")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`demo outbox read failed: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    kind: data.kind,
    recipient: data.recipient,
    subject: data.subject,
    linkWithheld: data.link_withheld,
    createdAt: data.created_at,
    html: data.html,
  };
}
