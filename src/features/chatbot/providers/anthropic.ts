import Anthropic from "@anthropic-ai/sdk";

import {
  ChatProviderError,
  EMPTY_REPLY,
  parseRetryAfter,
  REFUSAL_REPLY,
  STEP_LIMIT_REPLY,
  type ChatProvider,
  type ProviderRunInput,
  type ProviderRunResult,
} from "@/features/chatbot/providers/types";

/**
 * Models that accept server-side refusal fallback. If one of these declines a
 * request, the API retries it on an earlier model within the same call. Other
 * models (Claude Haiku 5.5 among them) reject the parameter, so it is only sent
 * to these.
 */
const SERVER_FALLBACK_MODELS = new Set([
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-fable-5-2",
  "claude-fable-5-1",
]);

type AnthropicClient = Pick<Anthropic, "beta">;

/**
 * Claude through the Messages API with a hand-written tool loop. The loop is
 * written out (not the SDK's tool runner) so the same tool definitions in
 * tools.ts serve every provider.
 *
 * Each turn starts from the plain-text transcript, so nothing from an earlier
 * turn (thinking blocks included) is replayed; within the turn the history is
 * only ever appended to.
 */
export function createAnthropicProvider(
  { apiKey, model }: { apiKey: string; model: string },
  client: AnthropicClient = new Anthropic({
    apiKey,
    maxRetries: 2,
    timeout: 60_000,
  }),
): ChatProvider {
  return {
    name: "anthropic",
    model,
    async run({
      system,
      transcript,
      tools,
      runTool,
      maxSteps,
    }: ProviderRunInput): Promise<ProviderRunResult> {
      const toolDefinitions: Anthropic.Beta.BetaTool[] = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
        strict: true,
      }));

      const messages: Anthropic.Beta.BetaMessageParam[] = transcript.map(
        (turn) => ({ role: turn.role, content: turn.text }),
      );

      const fallback = SERVER_FALLBACK_MODELS.has(model)
        ? {
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default" as const,
          }
        : {};

      for (let step = 1; step <= maxSteps; step++) {
        let response: Anthropic.Beta.BetaMessage;

        try {
          response = await client.beta.messages.create({
            model,
            max_tokens: 16_000,
            // Chat: low effort keeps replies quick and thinking short.
            output_config: { effort: "low" },
            system: [
              {
                type: "text",
                text: system,
                cache_control: { type: "ephemeral" },
              },
            ],
            tools: toolDefinitions,
            messages,
            ...fallback,
          });
        } catch (error) {
          throw toProviderError(error);
        }

        if (response.stop_reason === "refusal") {
          return { text: REFUSAL_REPLY, outcome: "refused", steps: step };
        }

        if (
          response.stop_reason === "tool_use" ||
          response.stop_reason === "pause_turn"
        ) {
          // The whole content goes back, thinking blocks included and unchanged.
          messages.push({ role: "assistant", content: response.content });
        }

        if (response.stop_reason === "pause_turn") {
          continue;
        }

        if (response.stop_reason === "tool_use") {
          const calls = response.content.filter(
            (block): block is Anthropic.Beta.BetaToolUseBlock =>
              block.type === "tool_use",
          );

          // All results go back in one user message.
          const results = await Promise.all(
            calls.map(
              async (
                call,
              ): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
                const outcome = await runTool(call.name, call.input);

                return {
                  type: "tool_result",
                  tool_use_id: call.id,
                  content: outcome.content,
                  ...(outcome.isError ? { is_error: true } : {}),
                };
              },
            ),
          );

          messages.push({ role: "user", content: results });
          continue;
        }

        // end_turn, max_tokens, stop_sequence: whatever text there is.
        const text = response.content
          .filter(
            (block): block is Anthropic.Beta.BetaTextBlock =>
              block.type === "text",
          )
          .map((block) => block.text)
          .join("\n")
          .trim();

        return { text: text || EMPTY_REPLY, outcome: "answered", steps: step };
      }

      return { text: STEP_LIMIT_REPLY, outcome: "step_limit", steps: maxSteps };
    },
  };
}

function toProviderError(error: unknown): ChatProviderError {
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError ||
    error instanceof Anthropic.NotFoundError ||
    error instanceof Anthropic.BadRequestError
  ) {
    return new ChatProviderError("misconfigured", { cause: error });
  }

  if (
    error instanceof Anthropic.RateLimitError ||
    error instanceof Anthropic.InternalServerError
  ) {
    return new ChatProviderError("busy", {
      cause: error,
      retryAfterMs: parseRetryAfter(error.headers?.get("retry-after")),
    });
  }

  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new ChatProviderError("timeout", { cause: error });
  }

  return new ChatProviderError("unavailable", { cause: error });
}
