import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { shortCached } from "./short-cache";

import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  type PlatformAnalytics,
} from "../types";

type AnalyticsResult =
  | { available: true; data: PlatformAnalytics }
  | { available: false; missing: boolean };

export function getPlatformAnalytics(
  range: AnalyticsRange,
): Promise<AnalyticsResult> {
  return shortCached(
    `analytics:${range}`,
    () => readAnalytics(range),
    (result) => result.available,
  );
}

async function readAnalytics(range: AnalyticsRange): Promise<AnalyticsResult> {
  const from = new Date(
    Date.now() - ANALYTICS_RANGES[range].days * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await createSupabaseAdminClient().rpc(
    "platform_analytics",
    { p_from: from },
  );

  if (error) {
    if (error.code !== "PGRST202") {
      console.error("[platform] analytics failed:", error.message);
    }

    return { available: false, missing: error.code === "PGRST202" };
  }

  return { available: true, data: data as PlatformAnalytics };
}
