/**
 * The card shell every Reports panel uses: the dashboards' shared card (border,
 * hairline shadow, no ring) with the panel padding. The skeletons mirror the
 * real cards box for box, so both read it from here: a padding change made in
 * one place and missed in the other would make the page jump when the data
 * lands.
 */
export const REPORT_CARD =
  "gap-0 rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-0";

/** The KPI row: two across from sm, three at xl, all five on wide screens. */
export const REPORT_STAT_GRID =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5";
