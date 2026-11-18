import "server-only";

import { serverEnv } from "@/config/server-env";
import { createAnthropicProvider } from "@/features/chatbot/providers/anthropic";
import { resolveChatbotConfig } from "@/features/chatbot/providers/config";
import { createGroqProvider } from "@/features/chatbot/providers/groq";
import { createOllamaProvider } from "@/features/chatbot/providers/ollama";
import type { ChatProvider } from "@/features/chatbot/providers/types";

let cached: { provider: ChatProvider | null } | undefined;

/** The configured chat provider, or null when the chat is switched off. */
export function getChatProvider(): ChatProvider | null {
  if (!cached) {
    const config = resolveChatbotConfig(serverEnv);

    cached = {
      provider: !config
        ? null
        : config.provider === "ollama"
          ? createOllamaProvider(config)
          : config.provider === "groq"
            ? createGroqProvider(config)
            : createAnthropicProvider(config),
    };
  }

  return cached.provider;
}

export function isChatbotEnabled(): boolean {
  return getChatProvider() !== null;
}
