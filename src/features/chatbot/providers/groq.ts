import {
  ChatProviderError,
  EMPTY_REPLY,
  STEP_LIMIT_REPLY,
  isTimeout,
  parseRetryAfter,
  stripThinking,
  type ChatProvider,
  type ProviderRunInput,
  type ProviderRunResult,
} from "@/features/chatbot/providers/types";

/**
 * Open models hosted by Groq, through its chat-completions endpoint, with the
 * same tools and loop as the other providers.
 *
 * Groq's free tier is limited per account and per model -- shared by every
 * customer using the chat, not per customer. Measured on this project's key
 * (Nov 2026): 1,000 requests a day and 8,000 tokens a minute per model. One
 * customer message is two or three requests of roughly 800-1,500 tokens each,
 * so expect about three messages a minute across the whole portal. The
 * per-customer limits in chatbot.actions.ts stop one customer using it all.
 */

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const CALL_TIMEOUT_MS = 45_000;
/** Replies are short; a low cap also keeps each request's token estimate low. */
const MAX_COMPLETION_TOKENS = 1_024;

type GroqToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type GroqMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: GroqToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type GroqAssistantMessage = {
  content?: string | null;
  tool_calls?: GroqToolCall[];
};

type GroqResponse = {
  choices?: { finish_reason?: string; message?: GroqAssistantMessage }[];
};

type GroqErrorBody = { error?: { code?: string; message?: string } };

export function createGroqProvider(
  { apiKey, model }: { apiKey: string; model: string },
  fetchImpl: typeof fetch = fetch,
): ChatProvider {
  // gpt-oss reasons before answering; "low" keeps those hidden tokens -- which
  // count against the per-minute limit -- to a handful for chat.
  const reasoning = model.startsWith("openai/gpt-oss")
    ? { reasoning_effort: "low" }
    : {};

  return {
    name: "groq",
    model,
    async run({
      system,
      transcript,
      tools,
      runTool,
      maxSteps,
    }: ProviderRunInput): Promise<ProviderRunResult> {
      const toolDefinitions = tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));

      const messages: GroqMessage[] = [
        { role: "system", content: system },
        ...transcript.map((turn) => ({ role: turn.role, content: turn.text })),
      ];

      for (let step = 1; step <= maxSteps; step++) {
        const message = await complete(fetchImpl, apiKey, {
          model,
          messages,
          tools: toolDefinitions,
          tool_choice: "auto",
          max_completion_tokens: MAX_COMPLETION_TOKENS,
          ...reasoning,
        });

        const calls = message.tool_calls ?? [];

        if (calls.length > 0) {
          messages.push({
            role: "assistant",
            content: message.content ?? null,
            tool_calls: calls,
          });

          for (const call of calls) {
            const outcome = await runTool(
              call.function.name,
              parseJson(call.function.arguments),
            );

            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: outcome.isError
                ? `Error: ${outcome.content}`
                : outcome.content,
            });
          }

          continue;
        }

        const text = stripThinking(message.content ?? "");

        return { text: text || EMPTY_REPLY, outcome: "answered", steps: step };
      }

      return { text: STEP_LIMIT_REPLY, outcome: "step_limit", steps: maxSteps };
    },
  };
}

/**
 * One chat-completions call. A malformed tool call from the model (Groq's
 * `tool_use_failed`) is retried once, since a second sample usually gets it
 * right; every other failure becomes a ChatProviderError.
 */
async function complete(
  fetchImpl: typeof fetch,
  apiKey: string,
  body: unknown,
  attempt = 1,
): Promise<GroqAssistantMessage> {
  let response: Response;

  try {
    response = await fetchImpl(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ChatProviderError(isTimeout(error) ? "timeout" : "unavailable", {
      cause: error,
    });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const code = errorCode(detail);
    const cause = new Error(
      `groq ${response.status}${code ? ` ${code}` : ""}: ${detail.slice(0, 300)}`,
    );

    if (
      response.status === 400 &&
      code === "tool_use_failed" &&
      attempt === 1
    ) {
      return complete(fetchImpl, apiKey, body, attempt + 1);
    }

    switch (response.status) {
      case 401:
      case 403:
      case 404:
        // Bad or revoked key, or a model this account can't use.
        throw new ChatProviderError("misconfigured", { cause });
      case 413:
      case 429:
        // 429: a request or token limit. 413: this one request needs more
        // tokens than the per-minute limit has left.
        throw new ChatProviderError("busy", {
          cause,
          retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
        });
      default:
        throw new ChatProviderError("unavailable", { cause });
    }
  }

  const data = (await response.json().catch(() => null)) as GroqResponse | null;
  const message = data?.choices?.[0]?.message;

  if (!message) {
    throw new ChatProviderError("unavailable", {
      cause: new Error("groq returned no message"),
    });
  }

  return message;
}

function errorCode(body: string): string | undefined {
  try {
    return (JSON.parse(body) as GroqErrorBody).error?.code;
  } catch {
    return undefined;
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
