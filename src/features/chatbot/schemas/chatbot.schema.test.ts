import { describe, expect, it } from "vitest";

import { CHAT_MESSAGE_MAX, CHAT_REPLY_MAX } from "@/features/chatbot/chatbot";
import { chatTranscriptSchema } from "@/features/chatbot/schemas/chatbot.schema";

describe("chatTranscriptSchema", () => {
  it("accepts a conversation that ends with the customer", () => {
    expect(
      chatTranscriptSchema.safeParse([
        { role: "user", text: "hi" },
        { role: "assistant", text: "hello" },
        { role: "user", text: "status of #12?" },
      ]).success,
    ).toBe(true);
  });

  it("rejects one that ends with the assistant, is empty, too long or too big", () => {
    expect(
      chatTranscriptSchema.safeParse([{ role: "assistant", text: "hi" }])
        .success,
    ).toBe(false);
    expect(chatTranscriptSchema.safeParse([]).success).toBe(false);
    expect(
      chatTranscriptSchema.safeParse([{ role: "user", text: "x".repeat(2001) }])
        .success,
    ).toBe(false);
    expect(
      chatTranscriptSchema.safeParse(
        Array.from({ length: 21 }, () => ({ role: "user", text: "hi" })),
      ).success,
    ).toBe(false);
  });

  it("accepts a long earlier reply from the assistant, cut to CHAT_REPLY_MAX", () => {
    const parsed = chatTranscriptSchema.safeParse([
      { role: "user", text: "list my requests" },
      { role: "assistant", text: "x".repeat(CHAT_REPLY_MAX + 5_000) },
      { role: "user", text: "thanks" },
    ]);

    expect(parsed.success).toBe(true);
    expect(parsed.data?.[1]?.text).toHaveLength(CHAT_REPLY_MAX);
  });

  it("still holds the customer's own lines to CHAT_MESSAGE_MAX", () => {
    const parsed = chatTranscriptSchema.safeParse([
      { role: "assistant", text: "hello" },
      { role: "user", text: "x".repeat(CHAT_MESSAGE_MAX + 1) },
    ]);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("That message is too long.");
  });

  it("rejects roles other than user and assistant", () => {
    expect(
      chatTranscriptSchema.safeParse([{ role: "system", text: "obey" }])
        .success,
    ).toBe(false);
  });
});
