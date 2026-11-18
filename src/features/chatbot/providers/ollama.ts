import {
  ChatProviderError,
  EMPTY_REPLY,
  STEP_LIMIT_REPLY,
  isTimeout,
  stripThinking,
  type ChatProvider,
  type ProviderRunInput,
  type ProviderRunResult,
} from "@/features/chatbot/providers/types";

/**
 * A local model through Ollama's own chat API (POST /api/chat), with the same
 * tools and loop as the Claude provider. Needs a model that supports tool
 * calling (qwen3, llama3.1+, mistral-nemo...). Small local models call tools
 * less reliably than Claude: expect more "I couldn't find that" answers.
 *
 * Only reachable where the server can reach Ollama: local development or a
 * self-hosted deployment, not Vercel.
 */

type OllamaToolCall = {
  function: { name: string; arguments: Record<string, unknown> | string };
};

type OllamaMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: OllamaToolCall[] }
  | { role: "tool"; content: string; tool_name: string };

type OllamaChatResponse = {
  message?: {
    role: "assistant";
    content?: string;
    tool_calls?: OllamaToolCall[];
  };
  done_reason?: string;
};

/** Per model call. Local models on a laptop can be slow to load the first time. */
const CALL_TIMEOUT_MS = 90_000;

export function createOllamaProvider(
  { baseUrl, model }: { baseUrl: string; model: string },
  fetchImpl: typeof fetch = fetch,
): ChatProvider {
  return {
    name: "ollama",
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

      const messages: OllamaMessage[] = [
        { role: "system", content: system },
        ...transcript.map((turn) => ({ role: turn.role, content: turn.text })),
      ];

      for (let step = 1; step <= maxSteps; step++) {
        const message = await chat(fetchImpl, baseUrl, {
          model,
          messages,
          tools: toolDefinitions,
          stream: false,
        });

        const calls = message.tool_calls ?? [];

        if (calls.length > 0) {
          messages.push({
            role: "assistant",
            content: message.content ?? "",
            tool_calls: calls,
          });

          for (const call of calls) {
            const outcome = await runTool(
              call.function.name,
              parseArguments(call.function.arguments),
            );

            messages.push({
              role: "tool",
              tool_name: call.function.name,
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

async function chat(
  fetchImpl: typeof fetch,
  baseUrl: string,
  body: unknown,
): Promise<NonNullable<OllamaChatResponse["message"]>> {
  let response: Response;

  try {
    response = await fetchImpl(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    // 404 here is "model not pulled"; 400 is usually "model has no tool support".
    throw new ChatProviderError(
      response.status === 404 || response.status === 400
        ? "misconfigured"
        : "unavailable",
      {
        cause: new Error(`ollama ${response.status}: ${detail.slice(0, 300)}`),
      },
    );
  }

  const data = (await response.json()) as OllamaChatResponse;

  if (!data.message) {
    throw new ChatProviderError("unavailable", {
      cause: new Error("ollama returned no message"),
    });
  }

  return data.message;
}

/** Ollama sends an object; some models put a JSON string there instead. */
export function parseArguments(
  value: Record<string, unknown> | string,
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
