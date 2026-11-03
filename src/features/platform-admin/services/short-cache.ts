import "server-only";

const CACHE_MS = 60_000;
const MAX_ENTRIES = 50;

const entries = new Map<string, { at: number; value: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Holds a slow console query's result for a minute, so repeated refreshes don't
 * re-run it. Failures aren't kept: `keep` decides what is worth holding. In memory,
 * so query text from the database health page isn't written to disk.
 */
export async function shortCached<T>(
  key: string,
  read: () => Promise<T>,
  keep: (value: T) => boolean,
): Promise<T> {
  const cached = entries.get(key);

  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.value as T;
  }

  const running = inFlight.get(key);

  if (running) return running as Promise<T>;

  const request = read()
    .then((value) => {
      if (keep(value)) {
        if (entries.size >= MAX_ENTRIES) entries.clear();
        entries.set(key, { at: Date.now(), value });
      }

      return value;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, request);

  return request;
}
