import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAnthropicProvider } from "@/features/chatbot/providers/anthropic";
import { resolveChatbotConfig } from "@/features/chatbot/providers/config";
import { createGroqProvider } from "@/features/chatbot/providers/groq";
import {
  createOllamaProvider,
  parseArguments,
} from "@/features/chatbot/providers/ollama";
import {
  REFUSAL_REPLY,
  STEP_LIMIT_REPLY,
  stripThinking,
  type ProviderRunInput,
} from "@/features/chatbot/providers/types";
import type { ChatTool } from "@/features/chatbot/tools/types";

/** The providers only pass tools through; the real ones are tested in tools/. */
const FAKE_TOOL: ChatTool = {
  name: "list_my_tickets",
  description: "List requests.",
  inputSchema: {
    type: "object",
    properties: { state: { type: "string" } },
    required: ["state"],
    additionalProperties: false,
  },
  execute: async () => ({ content: "{}", isError: false }),
};

function runInput(overrides: Partial<ProviderRunInput> = {}): ProviderRunInput {
  return {
    system: "system prompt",
    transcript: [{ role: "user", text: "what's open?" }],
    tools: [FAKE_TOOL],
    runTool: vi.fn(async () => ({ content: '{"ok":true}', isError: false })),
    maxSteps: 6,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveChatbotConfig", () => {
  it("is off without a Claude key", () => {
    expect(resolveChatbotConfig({})).toBeNull();
    expect(resolveChatbotConfig({ ANTHROPIC_API_KEY: "  " })).toBeNull();
  });

  it("defaults to Claude Sonnet 5.5 and takes a model override", () => {
    expect(resolveChatbotConfig({ ANTHROPIC_API_KEY: "k" })).toEqual({
      provider: "anthropic",
      apiKey: "k",
      model: "claude-sonnet-5-5",
    });
    expect(
      resolveChatbotConfig({
        ANTHROPIC_API_KEY: "k",
        CHATBOT_MODEL: "claude-haiku-5-5",
      }),
    ).toMatchObject({ model: "claude-haiku-5-5" });
  });

  it("uses Ollama with defaults and needs no key", () => {
    expect(resolveChatbotConfig({ CHATBOT_PROVIDER: "ollama" })).toEqual({
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      model: "qwen3:8b",
    });
    expect(
      resolveChatbotConfig({
        CHATBOT_PROVIDER: "ollama",
        OLLAMA_BASE_URL: "http://gpu-box:11434/",
        OLLAMA_MODEL: "llama3.1",
      }),
    ).toMatchObject({ baseUrl: "http://gpu-box:11434", model: "llama3.1" });
  });
});

describe("anthropic provider", () => {
  const toolUse = {
    stop_reason: "tool_use",
    content: [
      { type: "thinking", thinking: "", signature: "sig" },
      {
        type: "tool_use",
        id: "call-1",
        name: "list_my_tickets",
        input: { state: "open", page: 1 },
      },
    ],
  };
  const answer = {
    stop_reason: "end_turn",
    content: [{ type: "text", text: "You have one open request, #12." }],
  };

  function clientReturning(...responses: unknown[]) {
    const create = vi.fn();
    for (const response of responses) create.mockResolvedValueOnce(response);
    return { create, client: { beta: { messages: { create } } } };
  }

  it("runs a tool and returns the answer, sending results back in one message", async () => {
    const { create, client } = clientReturning(toolUse, answer);
    const provider = createAnthropicProvider(
      { apiKey: "k", model: "claude-sonnet-5-5" },
      client as never,
    );
    const input = runInput();

    const result = await provider.run(input);

    expect(result).toEqual({
      text: "You have one open request, #12.",
      outcome: "answered",
      steps: 2,
    });
    expect(input.runTool).toHaveBeenCalledWith("list_my_tickets", {
      state: "open",
      page: 1,
    });

    const second = create.mock.calls[1][0];
    // The assistant turn goes back unchanged, thinking block included.
    expect(second.messages.at(-2)).toEqual({
      role: "assistant",
      content: toolUse.content,
    });
    expect(second.messages.at(-1)).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "call-1", content: '{"ok":true}' },
      ],
    });
  });

  it("sends strict tools, low effort and server-side fallback for Sonnet 5.5", async () => {
    const { create, client } = clientReturning(answer);
    await createAnthropicProvider(
      { apiKey: "k", model: "claude-sonnet-5-5" },
      client as never,
    ).run(runInput());

    const request = create.mock.calls[0][0];
    expect(request.model).toBe("claude-sonnet-5-5");
    expect(request.output_config).toEqual({ effort: "low" });
    expect(request.fallbacks).toBe("default");
    expect(request.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(
      request.tools.every((tool: { strict: boolean }) => tool.strict),
    ).toBe(true);
    expect(request).not.toHaveProperty("tool_choice");
  });

  it("leaves fallback off for Haiku 5.5, which has none", async () => {
    const { create, client } = clientReturning(answer);
    await createAnthropicProvider(
      { apiKey: "k", model: "claude-haiku-5-5" },
      client as never,
    ).run(runInput());

    expect(create.mock.calls[0][0]).not.toHaveProperty("fallbacks");
    expect(create.mock.calls[0][0]).not.toHaveProperty("betas");
  });

  it("answers a refusal with the canned reply", async () => {
    const { client } = clientReturning({
      stop_reason: "refusal",
      content: [],
    });
    const result = await createAnthropicProvider(
      { apiKey: "k", model: "claude-sonnet-5-5" },
      client as never,
    ).run(runInput());

    expect(result).toMatchObject({ text: REFUSAL_REPLY, outcome: "refused" });
  });

  it("stops after maxSteps tool rounds", async () => {
    const { create, client } = clientReturning(toolUse, toolUse, toolUse);
    const result = await createAnthropicProvider(
      { apiKey: "k", model: "claude-sonnet-5-5" },
      client as never,
    ).run(runInput({ maxSteps: 3 }));

    expect(result).toMatchObject({
      text: STEP_LIMIT_REPLY,
      outcome: "step_limit",
    });
    expect(create).toHaveBeenCalledTimes(3);
  });
});

describe("groq provider", () => {
  const reply = (message: unknown, status = 200) =>
    new Response(JSON.stringify({ choices: [{ message }] }), { status });

  it("is configured by CHATBOT_PROVIDER=groq and needs a key", () => {
    expect(resolveChatbotConfig({ CHATBOT_PROVIDER: "groq" })).toBeNull();
    expect(
      resolveChatbotConfig({ CHATBOT_PROVIDER: "groq", GROQ_API_KEY: "gsk" }),
    ).toEqual({
      provider: "groq",
      apiKey: "gsk",
      model: "openai/gpt-oss-120b",
    });
  });

  it("runs tool calls with string arguments and returns the answer", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        reply({
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "get_ticket", arguments: '{"number":12}' },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(reply({ content: "#12 is open." }));
    const input = runInput();

    const result = await createGroqProvider(
      { apiKey: "gsk", model: "openai/gpt-oss-120b" },
      fetchImpl,
    ).run(input);

    expect(result).toMatchObject({ text: "#12 is open.", steps: 2 });
    expect(input.runTool).toHaveBeenCalledWith("get_ticket", { number: 12 });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe("Bearer gsk");

    const second = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(second.messages.at(-1)).toEqual({
      role: "tool",
      tool_call_id: "call_1",
      content: '{"ok":true}',
    });
  });

  it("maps limits to busy with Groq's wait, and a bad key to misconfigured", async () => {
    const provider = (response: Response) =>
      createGroqProvider(
        { apiKey: "gsk", model: "m" },
        vi.fn().mockResolvedValue(response),
      ).run(runInput());

    await expect(
      provider(
        new Response("{}", { status: 429, headers: { "retry-after": "7" } }),
      ),
    ).rejects.toMatchObject({ kind: "busy", retryAfterMs: 7_000 });
    await expect(
      provider(new Response("{}", { status: 413 })),
    ).rejects.toMatchObject({ kind: "busy" });
    await expect(
      provider(new Response("{}", { status: 401 })),
    ).rejects.toMatchObject({ kind: "misconfigured" });
  });

  it("retries a malformed tool call once", async () => {
    const toolUseFailed = () =>
      new Response(JSON.stringify({ error: { code: "tool_use_failed" } }), {
        status: 400,
      });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(toolUseFailed())
      .mockResolvedValueOnce(reply({ content: "Hi!" }));

    const result = await createGroqProvider(
      { apiKey: "gsk", model: "m" },
      fetchImpl,
    ).run(runInput());

    expect(result.text).toBe("Hi!");
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const twice = vi
      .fn()
      .mockResolvedValueOnce(toolUseFailed())
      .mockResolvedValueOnce(toolUseFailed());
    await expect(
      createGroqProvider({ apiKey: "gsk", model: "m" }, twice).run(runInput()),
    ).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("reports a timeout as a timeout", async () => {
    const timeout = Object.assign(new Error("timed out"), {
      name: "TimeoutError",
    });

    await expect(
      createGroqProvider(
        { apiKey: "gsk", model: "m" },
        vi.fn().mockRejectedValue(timeout),
      ).run(runInput()),
    ).rejects.toMatchObject({ kind: "timeout" });
  });

  it("asks gpt-oss for low reasoning effort only", async () => {
    const fetchFor = () => vi.fn().mockResolvedValue(reply({ content: "ok" }));

    const oss = fetchFor();
    await createGroqProvider(
      { apiKey: "gsk", model: "openai/gpt-oss-120b" },
      oss,
    ).run(runInput());
    expect(JSON.parse(oss.mock.calls[0][1].body).reasoning_effort).toBe("low");

    const qwen = fetchFor();
    await createGroqProvider(
      { apiKey: "gsk", model: "qwen/qwen3.8-27b" },
      qwen,
    ).run(runInput());
    expect(JSON.parse(qwen.mock.calls[0][1].body)).not.toHaveProperty(
      "reasoning_effort",
    );
  });
});

describe("ollama provider", () => {
  function fetchReturning(...messages: unknown[]) {
    const fetchImpl = vi.fn();
    for (const message of messages) {
      fetchImpl.mockResolvedValueOnce(
        new Response(JSON.stringify({ message }), { status: 200 }),
      );
    }
    return fetchImpl;
  }

  it("runs tool calls and strips <think> from the reply", async () => {
    const fetchImpl = fetchReturning(
      {
        role: "assistant",
        content: "",
        tool_calls: [
          { function: { name: "get_ticket", arguments: { number: 12 } } },
        ],
      },
      {
        role: "assistant",
        content: "<think>look it up</think>#12 is waiting on you.",
      },
    );
    const input = runInput();

    const result = await createOllamaProvider(
      { baseUrl: "http://localhost:11434", model: "qwen3:8b" },
      fetchImpl,
    ).run(input);

    expect(result).toMatchObject({
      text: "#12 is waiting on you.",
      outcome: "answered",
      steps: 2,
    });
    expect(input.runTool).toHaveBeenCalledWith("get_ticket", { number: 12 });

    const second = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(second.messages[0]).toEqual({
      role: "system",
      content: "system prompt",
    });
    expect(second.messages.at(-1)).toEqual({
      role: "tool",
      tool_name: "get_ticket",
      content: '{"ok":true}',
    });
  });

  it("reports a missing model as misconfigured", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("model not found", { status: 404 }));

    await expect(
      createOllamaProvider(
        { baseUrl: "http://localhost:11434", model: "nope" },
        fetchImpl,
      ).run(runInput()),
    ).rejects.toMatchObject({ kind: "misconfigured" });
  });

  it("parses string arguments and thinking tags defensively", () => {
    expect(parseArguments('{"number":5}')).toEqual({ number: 5 });
    expect(parseArguments("not json")).toEqual({});
    expect(stripThinking("<think>a\nb</think> hi ")).toBe("hi");
  });
});
