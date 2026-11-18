import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHAT_DAILY_LIMIT } from "@/features/chatbot/chatbot";
import { ChatProviderError } from "@/features/chatbot/providers/types";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const mocks = vi.hoisted(() => ({
  getPortalIdentity: vi.fn(),
  getChatProvider: vi.fn(),
  runChat: vi.fn(),
  rateLimit: vi.fn(),
  peekRateLimit: vi.fn(),
}));

vi.mock("@/features/portal/services/portal.service", () => ({
  getPortalIdentity: mocks.getPortalIdentity,
}));
vi.mock("@/features/chatbot/providers", () => ({
  getChatProvider: mocks.getChatProvider,
}));
vi.mock("@/features/chatbot/services/chat.service", async (original) => ({
  ...(await original<
    typeof import("@/features/chatbot/services/chat.service")
  >()),
  runChat: mocks.runChat,
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  peekRateLimit: mocks.peekRateLimit,
}));

const { sendChatMessageAction } =
  await import("@/features/chatbot/actions/chatbot.actions");

const transcript = [{ role: "user" as const, text: "any updates?" }];
const resetAt = Date.now() + 60 * 60_000;
const dayCalls = () =>
  mocks.rateLimit.mock.calls.filter(([key]) => String(key).includes(":day:"));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.getPortalIdentity.mockResolvedValue({ userId: "user-1" });
  mocks.getChatProvider.mockReturnValue({ name: "groq", model: "m" });
  mocks.peekRateLimit.mockResolvedValue({ count: 3, resetAt });
  mocks.rateLimit.mockImplementation(async (key: string) => ({
    allowed: true,
    retryAfterMs: 0,
    count: key.includes(":day:") ? 4 : 1,
    resetAt,
  }));
});

describe("sendChatMessageAction daily allowance", () => {
  it("counts a message that was answered", async () => {
    mocks.runChat.mockResolvedValue({
      reply: "Nothing new.",
      draft: null,
      suggestions: [],
      attachments: [],
      profile: null,
    });

    const result = await sendChatMessageAction("acme", transcript);

    expect(result.success).toBe(true);
    expect(dayCalls()).toHaveLength(1);
    expect(result.success && result.data.usage.used).toBe(4);
  });

  it("does not count a message the provider failed to answer", async () => {
    mocks.runChat.mockRejectedValue(new ChatProviderError("busy"));

    const result = await sendChatMessageAction("acme", transcript);

    expect(result.success).toBe(false);
    expect(dayCalls()).toHaveLength(0);
  });

  it("refuses once today's allowance is used, without calling the model", async () => {
    mocks.peekRateLimit.mockResolvedValue({ count: CHAT_DAILY_LIMIT, resetAt });

    const result = await sendChatMessageAction("acme", transcript);

    expect(result).toMatchObject({ success: false, code: "rate_limited" });
    expect(mocks.runChat).not.toHaveBeenCalled();
  });
});
