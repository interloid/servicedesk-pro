"use client";

import { useEffect } from "react";

import { shouldLeavePage, type WorkspaceStatus } from "../workspace-status";

const CHECK_MS = 20_000;

/**
 * The proxy only sees new requests, so a tab already open would carry on looking
 * normal after its workspace is blocked. This asks now and then and, if so,
 * reloads, which lets the proxy show the blocked or maintenance screen.
 *
 * Not on mount: a check straight after a reload could disagree with the proxy's
 * few seconds of cache and reload again.
 */
export function WorkspaceStatusWatcher({ slug }: { slug: string }) {
  useEffect(() => {
    async function check() {
      if (document.hidden) return;

      try {
        const response = await fetch(
          `/api/workspace-status?slug=${encodeURIComponent(slug)}`,
          { cache: "no-store" },
        );

        if (!response.ok) return;

        const status = (await response.json()) as WorkspaceStatus;
        const prefix = `/${slug}`;
        const { pathname } = window.location;
        const relative =
          pathname === prefix || pathname.startsWith(`${prefix}/`)
            ? pathname.slice(prefix.length) || "/"
            : pathname;

        if (shouldLeavePage(status, relative)) {
          window.location.reload();
        }
      } catch {
        // Offline or a hiccup: the next check tries again.
      }
    }

    const timer = setInterval(check, CHECK_MS);

    document.addEventListener("visibilitychange", check);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [slug]);

  return null;
}
