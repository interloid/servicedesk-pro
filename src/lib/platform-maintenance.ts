/**
 * Whether maintenance mode is on, for the proxy. It runs on every request, so
 * the answer is held for a few seconds per server instance -- which is also how
 * long a change made in the console can take to reach tenants.
 *
 * Fails open: a database hiccup (or the migration not being applied yet) must
 * not lock every workspace out. The last known answer stands, else "off".
 */
const TTL_MS = 10_000;
const TIMEOUT_MS = 1_500;

let known = false;
let checkedAt = 0;
let inFlight: Promise<boolean> | null = null;

async function readMaintenanceMode(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return known;
  }

  try {
    const response = await fetch(
      `${url}/rest/v1/platform_settings?id=eq.true&select=maintenance_mode`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      return known;
    }

    const rows = (await response.json()) as Array<{
      maintenance_mode: boolean;
    }>;

    return rows[0]?.maintenance_mode ?? false;
  } catch {
    return known;
  }
}

export async function isMaintenanceMode(): Promise<boolean> {
  if (Date.now() - checkedAt < TTL_MS) {
    return known;
  }

  inFlight ??= readMaintenanceMode().then((value) => {
    known = value;
    checkedAt = Date.now();
    inFlight = null;

    return value;
  });

  return inFlight;
}

export type WorkspaceBlock = { source: "admin" | "payment" };

const blocks = new Map<string, { block: WorkspaceBlock | null; at: number }>();
const MAX_CACHED_SLUGS = 1000;

// Any address reaches this signed out, so a script sending random ones could
// otherwise cause one database query each. Past this many lookups in a window the
// last known answer stands. A flood can briefly leave a workspace not cached here
// unchecked by the proxy; the database rules still hold its data back.
const MAX_LOOKUPS_PER_WINDOW = 100;
let lookupWindowStart = 0;
let lookupsInWindow = 0;

function lookupAllowed(): boolean {
  const now = Date.now();

  if (now - lookupWindowStart >= TTL_MS) {
    lookupWindowStart = now;
    lookupsInWindow = 0;
  }

  lookupsInWindow += 1;

  return lookupsInWindow <= MAX_LOOKUPS_PER_WINDOW;
}

/**
 * Whether a workspace is blocked, with the same short per-instance cache and the
 * same fail-open rule as maintenance mode. The slug has already passed
 * isValidTenantSlug, and is encoded anyway.
 */
export async function getWorkspaceBlock(
  slug: string,
): Promise<WorkspaceBlock | null> {
  const cached = blocks.get(slug);

  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.block;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let block = cached?.block ?? null;

  if (url && key && lookupAllowed()) {
    try {
      const response = await fetch(
        `${url}/rest/v1/tenants?slug=eq.${encodeURIComponent(slug)}&select=status,block_source`,
        {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          cache: "no-store",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );

      if (response.ok) {
        const rows = (await response.json()) as Array<{
          status: string;
          block_source: string | null;
        }>;

        block =
          rows[0]?.status === "suspended"
            ? {
                source:
                  rows[0].block_source === "payment" ? "payment" : "admin",
              }
            : null;
      }
    } catch {
      // The last known answer stands.
    }
  }

  // Random slugs must not grow this without limit.
  if (blocks.size >= MAX_CACHED_SLUGS) blocks.clear();
  blocks.set(slug, { block, at: Date.now() });

  return block;
}
