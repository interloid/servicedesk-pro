import type { MembershipRole } from "@/types/team-members";

/**
 * Roles are rows in `public.roles`, managed from /platform/roles. Every role
 * sits on one access tier (`baseRole`), the value memberships.role, the
 * tenant_role claim and the RLS policies compare against. A custom role grants
 * exactly its tier's access under its own name.
 */

export const BASE_ROLE_LABELS: Record<MembershipRole, string> = {
  platform_admin: "Platform Admin",
  tenant_admin: "Tenant Admin",
  manager: "Manager",
  agent: "Agent",
  billing_admin: "Billing Admin",
  customer: "Customer",
};

/** What a custom role may be based on. Mirrors chk_roles_custom_base. */
export const CUSTOM_ROLE_BASES = [
  "tenant_admin",
  "manager",
  "agent",
  "billing_admin",
] as const satisfies readonly MembershipRole[];

export type CustomRoleBase = (typeof CUSTOM_ROLE_BASES)[number];

/** What each tier can reach, for the console's role form. */
export const BASE_ROLE_ACCESS: Record<CustomRoleBase, string> = {
  tenant_admin: "Everything: tickets, team, settings, billing.",
  manager: "All tickets, the team (except admins) and workspace settings.",
  agent: "Tickets and customers. No team, settings or billing.",
  billing_admin: "Billing, plans, invoices and payment methods only.",
};

export const ROLE_STATUSES = ["active", "archived"] as const;

export type RoleStatus = (typeof ROLE_STATUSES)[number];

export const ROLE_NAME_MAX = 60;
export const ROLE_DESCRIPTION_MAX = 300;

export interface RoleDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  baseRole: MembershipRole;
  isSystem: boolean;
  status: RoleStatus;
  sortOrder: number;
  updatedAt: string;
}

/** "Senior Support" -> "senior_support"; the DB key pattern is ^[a-z][a-z0-9_]{1,49}$. */
export function roleKeyFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 40);

  return slug.length >= 2 ? slug : `role_${slug}`.slice(0, 40);
}
