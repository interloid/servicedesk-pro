import { describe, expect, it } from "vitest";

import { isInternal } from "@/features/chatbot/lib/links";

describe("isInternal", () => {
  it("accepts paths on this site", () => {
    expect(isInternal("/acme/portal/requests/123")).toBe(true);
    expect(isInternal("/acme/portal?tab=open#top")).toBe(true);
  });

  it("rejects links that leave the site", () => {
    for (const href of [
      undefined,
      "",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\\/evil.example",
      "javascript:alert(1)",
      "acme/portal",
    ]) {
      expect(isInternal(href), String(href)).toBe(false);
    }
  });
});
