import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { createClient } from "@supabase/supabase-js";

const stack = parseEnv(readFileSync(".e2e/stack.env", "utf8"));

// playwright.config.ts has already refused anything but a local stack, and this
// file is the only source of the key, so a test can't read a hosted database.
const db = createClient(
  stack.E2E_SUPABASE_URL ?? "",
  stack.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/** The id of a seeded ticket raised by this customer, for access checks. */
export async function ticketIdOf(customerEmail: string): Promise<string> {
  const { data, error } = await db
    .from("tickets")
    .select("id, customers!tickets_requester_customer_id_fkey!inner(email)")
    .eq("customers.email", customerEmail)
    .limit(1)
    .single();

  if (error)
    throw new Error(`No ticket for ${customerEmail}: ${error.message}`);

  return data.id;
}

export async function resetRateLimits(): Promise<void> {
  const { error } = await db
    .from("rate_limit_buckets")
    .delete()
    .not("key", "is", null);

  if (error) throw new Error(`Could not reset rate limits: ${error.message}`);
}

/** A seeded ticket by subject, so a screenshot always shows the same one. */
export async function seededTicketId(
  customerEmail: string,
  subject: string,
): Promise<string> {
  const { data, error } = await db
    .from("tickets")
    .select("id, customers!tickets_requester_customer_id_fkey!inner(email)")
    .eq("customers.email", customerEmail)
    .eq("subject", subject)
    .single();

  if (error) throw new Error(`No ticket "${subject}": ${error.message}`);

  return data.id;
}

export async function customerIdOf(email: string): Promise<string> {
  const { data, error } = await db
    .from("customers")
    .select("id")
    .eq("email", email)
    .single();

  if (error) throw new Error(`No customer ${email}: ${error.message}`);

  return data.id;
}

export async function defaultSlaPolicyId(tenantSlug: string): Promise<string> {
  const { data, error } = await db
    .from("sla_policies")
    .select("id, tenants!inner(slug)")
    .eq("tenants.slug", tenantSlug)
    .limit(1)
    .single();

  if (error) throw new Error(`No policy on ${tenantSlug}: ${error.message}`);

  return data.id;
}
