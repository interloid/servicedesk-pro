import { describe, expect, it } from "vitest";

import { PLAN_LIMIT_TOO_BIG, planLimitError } from "./plan-limits";

describe("planLimitError", () => {
  it("accepts whole numbers in range", () => {
    expect(planLimitError("1")).toBeNull();
    expect(planLimitError("999998")).toBeNull();
  });

  it("rejects a limit that would read as unlimited, or is far too big", () => {
    expect(planLimitError("999999")).toBe(PLAN_LIMIT_TOO_BIG);
    expect(planLimitError("2112121212121")).toBe(PLAN_LIMIT_TOO_BIG);
  });

  it("rejects empty, zero, negative and fractional limits", () => {
    expect(planLimitError("")).toBe("Enter a number.");
    expect(planLimitError("0")).toBe("Enter at least 1.");
    expect(planLimitError("-5")).toBe("Enter at least 1.");
    expect(planLimitError("1.5")).toBe("Enter a whole number.");
  });
});
