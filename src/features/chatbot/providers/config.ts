/**
 * Which model answers the portal chat, decided from the environment. Pure so
 * it can be tested without a server environment.
 *
 *   CHATBOT_PROVIDER=anthropic (default) needs ANTHROPIC_API_KEY.
 *     CHATBOT_MODEL: claude-sonnet-5-5 (default) or claude-haiku-5-5 (cheapest).
 *   CHATBOT_PROVIDER=groq needs GROQ_API_KEY (free tier, rate-limited).
 *     CHATBOT_MODEL: openai/gpt-oss-120b (default) or any Groq model with tool use.
 *   CHATBOT_PROVIDER=ollama runs a local model.
 *     OLLAMA_BASE_URL (default http://localhost:11434), OLLAMA_MODEL (default qwen3:8b).
 *
 * null means the chat is off, and the portal hides the widget.
 */

export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5-5";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const DEFAULT_OLLAMA_MODEL = "qwen3:8b";

export type ChatbotConfig =
  | { provider: "anthropic"; apiKey: string; model: string }
  | { provider: "groq"; apiKey: string; model: string }
  | { provider: "ollama"; baseUrl: string; model: string };

export type ChatbotEnv = {
  CHATBOT_PROVIDER?: "anthropic" | "groq" | "ollama";
  ANTHROPIC_API_KEY?: string;
  GROQ_API_KEY?: string;
  CHATBOT_MODEL?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
};

export function resolveChatbotConfig(env: ChatbotEnv): ChatbotConfig | null {
  const model = env.CHATBOT_MODEL?.trim() || undefined;

  if (env.CHATBOT_PROVIDER === "ollama") {
    return {
      provider: "ollama",
      baseUrl: (env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL).replace(
        /\/+$/,
        "",
      ),
      model: env.OLLAMA_MODEL?.trim() || model || DEFAULT_OLLAMA_MODEL,
    };
  }

  if (env.CHATBOT_PROVIDER === "groq") {
    const groqKey = env.GROQ_API_KEY?.trim();

    return groqKey
      ? {
          provider: "groq",
          apiKey: groqKey,
          model: model ?? DEFAULT_GROQ_MODEL,
        }
      : null;
  }

  const apiKey = env.ANTHROPIC_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  return {
    provider: "anthropic",
    apiKey,
    model: model ?? DEFAULT_CLAUDE_MODEL,
  };
}
