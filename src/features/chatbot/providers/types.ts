import type { ChatTurn } from "@/features/chatbot/chatbot";
import type { ChatTool, ToolOutcome } from "@/features/chatbot/tools";

export type ProviderRunInput = {
  system: string;
  transcript: ChatTurn[];
  tools: readonly ChatTool[];
  runTool: (name: string, input: unknown) => Promise<ToolOutcome>;
  /** Model calls allowed in one turn before giving up. */
  maxSteps: number;
};

export type ProviderRunResult = {
  /** The assistant's reply to show. Never empty. */
  text: string;
  /** "refused" and "step_limit" carry a canned reply in `text`. */
  outcome: "answered" | "refused" | "step_limit";
  /** Model calls made, for logging. */
  steps: number;
};

export interface ChatProvider {
  readonly name: "anthropic" | "groq" | "ollama";
  readonly model: string;
  run(input: ProviderRunInput): Promise<ProviderRunResult>;
}

/**
 * A provider failure the customer should hear about in plain words. `kind`
 * picks the message; the cause is logged, never shown.
 */
export class ChatProviderError extends Error {
  /** For "busy": how long the provider asked us to wait, when it said. */
  readonly retryAfterMs: number | null;

  constructor(
    readonly kind: "unavailable" | "busy" | "timeout" | "misconfigured",
    options?: { cause?: unknown; retryAfterMs?: number | null },
  ) {
    super(`chat provider ${kind}`, { cause: options?.cause });
    this.name = "ChatProviderError";
    this.retryAfterMs = options?.retryAfterMs ?? null;
  }
}

/** A fetch that gave up on AbortSignal.timeout. */
export function isTimeout(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

/**
 * Retry-After as milliseconds: seconds ("7", "1.5") or an HTTP date. Null when
 * absent or unreadable.
 */
export function parseRetryAfter(
  value: string | null | undefined,
): number | null {
  if (!value) return null;

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const at = Date.parse(value);

  return Number.isNaN(at) ? null : Math.max(0, at - Date.now());
}

/** Reasoning models can leave <think>…</think> in the reply text. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

export const REFUSAL_REPLY =
  "Sorry, I can't help with that here. If it's about one of your requests, I can look it up or draft a new one for the support team.";

export const STEP_LIMIT_REPLY =
  "Sorry, that took longer than expected. Could you try asking again, perhaps in a simpler way?";

export const EMPTY_REPLY =
  "Sorry, I didn't catch that. Could you say it another way?";
