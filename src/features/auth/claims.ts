import type { SupabaseClient } from "@supabase/supabase-js";

import { isMembershipRole, type MembershipRole } from "@/types/team-members";

export type TenantClaims = {
  tenantId: string | null;
  tenantSlug: string | null;
  tenantRole: MembershipRole | null;
  /** Platform support's email when this session is an impersonation. */
  impersonatedBy: string | null;
};

export const EMPTY_TENANT_CLAIMS: TenantClaims = {
  tenantId: null,
  tenantSlug: null,
  tenantRole: null,
  impersonatedBy: null,
};

export async function getTenantClaims(
  supabase: SupabaseClient,
): Promise<TenantClaims | null> {
  const { data, error } = await supabase.auth.getClaims();

  if (error) {
    console.error("[auth] claims lookup failed:", error.message);
    return null;
  }

  return readTenantClaims(data?.claims);
}

export function readTenantClaims(claims: unknown): TenantClaims {
  if (!claims || typeof claims !== "object") {
    return EMPTY_TENANT_CLAIMS;
  }

  const record = claims as Record<string, unknown>;
  const role = record.tenant_role;

  return {
    tenantId: typeof record.tenant_id === "string" ? record.tenant_id : null,
    tenantSlug:
      typeof record.tenant_slug === "string" ? record.tenant_slug : null,
    tenantRole: isMembershipRole(role) ? role : null,
    impersonatedBy:
      typeof record.impersonated_by === "string" && record.impersonated_by
        ? record.impersonated_by
        : null,
  };
}
