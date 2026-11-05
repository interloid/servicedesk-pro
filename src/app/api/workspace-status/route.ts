import { NextResponse } from "next/server";

import type { WorkspaceStatus } from "@/features/platform-admin/workspace-status";
import {
  getWorkspaceBlock,
  isMaintenanceMode,
} from "@/lib/platform-maintenance";
import { isValidTenantSlug } from "@/lib/tenancy";

/**
 * Lets an open tab find out its workspace was blocked. Says nothing that visiting
 * the workspace's own address wouldn't, so it needs no session.
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");

  if (!isValidTenantSlug(slug)) {
    return NextResponse.json({ error: "Invalid workspace." }, { status: 400 });
  }

  const [block, maintenance] = await Promise.all([
    getWorkspaceBlock(slug),
    isMaintenanceMode(),
  ]);
  const status: WorkspaceStatus = {
    block: block?.source ?? null,
    maintenance,
  };

  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
