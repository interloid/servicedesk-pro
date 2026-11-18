import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestClientInfo } from "@/lib/request-context";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterMs: number;
  /** Hits in the current window, this one included. */
  count: number;
  /** When the current window ends (epoch ms). */
  resetAt: number;
};

// Fallback only: used while the rate_limit_hit migration is missing or the
// database can't be reached. Each server instance has its own copy.
const buckets = new Map<string, Bucket>();

const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  if (buckets.size <= MAX_TRACKED_KEYS) {
    return;
  }

  const excess = buckets.size - MAX_TRACKED_KEYS;
  let dropped = 0;

  for (const key of buckets.keys()) {
    buckets.delete(key);
    if (++dropped >= excess) break;
  }
}

/** The caller's address, as the audit log records it. */
export async function clientKey(): Promise<string> {
  const { ip } = await requestClientInfo();

  return ip ?? "unknown";
}

function memoryHit(key: string, cost: number, windowMs: number) {
  const now = Date.now();

  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const fresh = { count: cost, resetAt: now + windowMs };
    buckets.set(key, fresh);

    return fresh;
  }

  bucket.count += cost;

  return bucket;
}

async function sharedHit(
  key: string,
  cost: number,
  windowMs: number,
): Promise<Bucket | null> {
  try {
    const { data, error } = await createSupabaseAdminClient()
      .rpc("rate_limit_hit", {
        p_key: key,
        p_cost: cost,
        p_window_ms: windowMs,
      })
      .single<{ hits: number; reset_at: string }>();

    if (error || !data) {
      // PGRST202: the migration isn't applied yet. Anything else is logged,
      // but a limiter outage shouldn't lock everyone out of signing in.
      if (error?.code !== "PGRST202") {
        console.error("[rate-limit] shared counter failed:", error?.message);
      }

      return null;
    }

    return { count: data.hits, resetAt: new Date(data.reset_at).getTime() };
  } catch (error) {
    console.error("[rate-limit] shared counter failed:", error);

    return null;
  }
}

/**
 * Counts `cost` hits (default one) against `key` and says whether the caller
 * is still within `limit` for the current window. Counts live in the
 * database so every server instance shares them.
 */
export async function rateLimit(
  key: string,
  {
    limit,
    windowMs,
    cost = 1,
  }: { limit: number; windowMs: number; cost?: number },
): Promise<RateLimitResult> {
  const spend = Math.max(1, cost);
  const bucket =
    (await sharedHit(key, spend, windowMs)) ?? memoryHit(key, spend, windowMs);

  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterMs: Math.max(0, bucket.resetAt - Date.now()),
      count: bucket.count,
      resetAt: bucket.resetAt,
    };
  }

  return {
    allowed: true,
    retryAfterMs: 0,
    count: bucket.count,
    resetAt: bucket.resetAt,
  };
}

/**
 * The hits counted so far against `key` in its current window, without adding
 * one -- for showing a quota before it is spent. `resetAt` is null when the key
 * has no live window (nothing counted yet, or the window has ended).
 */
export async function peekRateLimit(
  key: string,
): Promise<{ count: number; resetAt: number | null }> {
  const now = Date.now();

  try {
    // rate_limit_buckets is only ever written through rate_limit_hit, so it
    // is not in the generated table types (database.types.ts). The client is
    // untyped for this one read, so the row is checked at runtime instead: a
    // renamed column fails loudly here rather than reading as "nothing used".
    const { data, error } = await (
      createSupabaseAdminClient() as unknown as SupabaseClient
    )
      .from("rate_limit_buckets")
      .select("count, reset_at")
      .eq("key", key)
      .maybeSingle<unknown>();

    if (error) {
      console.error("[rate-limit] peek failed:", error.message);
    } else if (data === null) {
      return { count: 0, resetAt: null };
    } else if (isBucketRow(data)) {
      const resetAt = new Date(data.reset_at).getTime();

      return resetAt > now
        ? { count: data.count, resetAt }
        : { count: 0, resetAt: null };
    } else {
      console.error("[rate-limit] peek read an unexpected row:", data);
    }
  } catch (error) {
    console.error("[rate-limit] peek failed:", error);
  }

  // Fall back to this instance's own counter, as rateLimit does.
  const bucket = buckets.get(key);

  return bucket && bucket.resetAt > now
    ? { count: bucket.count, resetAt: bucket.resetAt }
    : { count: 0, resetAt: null };
}

function isBucketRow(row: unknown): row is { count: number; reset_at: string } {
  return (
    typeof row === "object" &&
    row !== null &&
    typeof (row as { count?: unknown }).count === "number" &&
    typeof (row as { reset_at?: unknown }).reset_at === "string"
  );
}
