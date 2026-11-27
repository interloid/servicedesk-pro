import type { CSSProperties } from "react";

/**
 * One look for every Recharts chart in the platform console. Recharts takes
 * plain colour strings, so these mirror the design tokens in globals.css
 * (brand teal #0f766e = --brand-accent, slate borders and text).
 */
export const CHART_COLORS = {
  primary: "#0f766e",
  primarySoft: "#99f6e4",
  danger: "#dc2626",
  dangerSoft: "#fecaca",
  grid: "#eef2f6",
  cursor: "#f1f5f9",
  tick: "#64748b",
  text: "#0f172a",
} as const;

export const CHART_TICK = { fill: CHART_COLORS.tick, fontSize: 11 };

export const CHART_TOOLTIP_STYLE: CSSProperties = {
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 24px -8px rgba(15, 23, 42, 0.18)",
  fontSize: 12,
  padding: "8px 10px",
};

export const CHART_TOOLTIP_LABEL: CSSProperties = {
  color: CHART_COLORS.text,
  fontWeight: 600,
  marginBottom: 2,
};

export const CHART_TOOLTIP_ITEM: CSSProperties = { color: CHART_COLORS.text };
