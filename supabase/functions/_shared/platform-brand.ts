import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type PlatformBrand = { platformName: string; supportEmail: string };

const FALLBACK: PlatformBrand = {
  platformName: "ServiceDesk",
  supportEmail: "support@servicedesk.com",
};

const CACHE_MS = 60_000;
let cached: { at: number; brand: PlatformBrand } | null = null;

/**
 * The name and support address set in /platform/settings. A failed read falls back
 * rather than throwing: a branding lookup must never stop an email, an invoice or
 * a checkout.
 */
export async function getPlatformBrand(
  // deno-lint-ignore no-explicit-any
  admin: SupabaseClient<any, any, any>, // eslint-disable-line @typescript-eslint/no-explicit-any -- esm.sh client generics differ per call site
): Promise<PlatformBrand> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.brand;

  try {
    const { data, error } = await admin
      .from("platform_settings")
      .select("platform_name, support_email")
      .eq("id", true)
      .maybeSingle();

    if (error || !data) return cached?.brand ?? FALLBACK;

    const brand = {
      platformName: data.platform_name || FALLBACK.platformName,
      supportEmail: data.support_email || FALLBACK.supportEmail,
    };

    cached = { at: Date.now(), brand };

    return brand;
  } catch {
    return cached?.brand ?? FALLBACK;
  }
}
