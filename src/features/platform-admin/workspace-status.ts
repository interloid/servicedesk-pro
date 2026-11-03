export type WorkspaceStatus = {
  block: "admin" | "payment" | null;
  maintenance: boolean;
};

/** What a workspace blocked over failed payments can still open, to pay. */
export function isBillingPath(tenantRelativePath: string): boolean {
  return ["/account/billing", "/account/plans"].some(
    (prefix) =>
      tenantRelativePath === prefix ||
      tenantRelativePath.startsWith(`${prefix}/`),
  );
}

/**
 * Whether an open page should reload so the proxy can replace it. Must agree with
 * the proxy: reloading a page it would serve again would loop forever.
 */
export function shouldLeavePage(
  status: WorkspaceStatus,
  tenantRelativePath: string,
): boolean {
  if (status.maintenance) return true;
  if (status.block === "admin") return true;

  return status.block === "payment" && !isBillingPath(tenantRelativePath);
}
