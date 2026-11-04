import { UNLIMITED_SEATS } from "./types";

// Seat limits at UNLIMITED_SEATS read as "Unlimited" everywhere, so a typed limit
// has to stay below it. The same cap on SLA limits keeps them in the column's range.
export const MAX_PLAN_LIMIT = UNLIMITED_SEATS - 1;

export const PLAN_LIMIT_TOO_BIG = `Use No limit above ${MAX_PLAN_LIMIT.toLocaleString("en-US")}.`;

/** What's wrong with a limit typed into the plan form, or null if it's fine. */
export function planLimitError(text: string): string | null {
  const value = Number(text);

  if (text.trim() === "" || Number.isNaN(value)) return "Enter a number.";
  if (value > MAX_PLAN_LIMIT) return PLAN_LIMIT_TOO_BIG;
  if (value < 1) return "Enter at least 1.";
  if (!Number.isInteger(value)) return "Enter a whole number.";

  return null;
}
