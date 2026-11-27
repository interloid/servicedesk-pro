"use client";

import { useEffect } from "react";

/**
 * Opens the question a link points at (#question-id on a topic page), so a
 * "Popular questions" link lands on its answer rather than on a closed row.
 * The questions are plain <details>; this only sets `open` on the one in the
 * address bar, on arrival and when the hash changes.
 */
export function PortalHelpQuestionOpener() {
  useEffect(() => {
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;

      const details = document.getElementById(id)?.querySelector("details");
      if (details) details.open = true;
    };

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return null;
}
