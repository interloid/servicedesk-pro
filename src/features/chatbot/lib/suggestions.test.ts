import { describe, expect, it } from "vitest";

import { buildSuggestions } from "@/features/chatbot/lib/suggestions";

describe("buildSuggestions", () => {
  it("offers the next page only when there is one", () => {
    expect(
      buildSuggestions(
        {
          listed: { state: "any", page: 1, total: 10, perPage: 5 },
          viewed: [],
        },
        null,
      ),
    ).toContain("Show the next page");
    expect(
      buildSuggestions(
        {
          listed: { state: "any", page: 2, total: 10, perPage: 5 },
          viewed: [],
        },
        null,
      ),
    ).not.toContain("Show the next page");
  });

  it("follows up on the request just viewed, at most three chips", () => {
    const chips = buildSuggestions({ viewed: [4, 12] }, null);

    expect(chips[0]).toBe("What's the latest on #12?");
    expect(chips.length).toBeLessThanOrEqual(3);
  });

  it("doesn't suggest the list the customer is already looking at", () => {
    expect(
      buildSuggestions(
        {
          listed: { state: "open", page: 1, total: 2, perPage: 5 },
          viewed: [],
        },
        null,
      ),
    ).not.toContain("Show my open requests");
  });

  it("offers nothing while a draft waits for confirmation", () => {
    expect(
      buildSuggestions({ viewed: [] }, { subject: "a", description: "b" }),
    ).toEqual([]);
  });
});
