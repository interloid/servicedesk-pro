import "server-only";

import type { ChatReply, ChatTurn } from "@/features/chatbot/chatbot";
import { buildSystemPrompt } from "@/features/chatbot/lib/prompt";
import { buildSuggestions } from "@/features/chatbot/lib/suggestions";
import {
  ChatProviderError,
  type ChatProvider,
} from "@/features/chatbot/providers/types";
import {
  CHAT_TOOLS,
  runTool,
  type ToolContext,
} from "@/features/chatbot/tools";
import type { PortalIdentity } from "@/features/portal/portal";

/** Model calls per customer message: a lookup or two, then the answer. */
const MAX_STEPS = 6;

/**
 * Turns of history sent to the model. Every model call re-sends them, and
 * tokens per minute is the tightest free-tier limit; the model can always look
 * a request up again.
 */
const MODEL_HISTORY = 12;

/**
 * One customer message: the model reads the conversation, calls tools as the
 * signed-in customer, and answers. Any draft it prepared and any requests it
 * looked up come back alongside the reply for the widget to render.
 */
export async function runChat({
  provider,
  identity,
  slug,
  transcript,
}: {
  provider: ChatProvider;
  identity: PortalIdentity;
  slug: string;
  transcript: ChatTurn[];
}): Promise<Omit<ChatReply, "usage">> {
  const ctx: ToolContext = {
    identity,
    slug,
    draft: null,
    seen: { viewed: [] },
    attachments: [],
    profile: null,
  };

  const startedAt = Date.now();

  const result = await provider.run({
    system: buildSystemPrompt(identity.tenant.name),
    transcript: fromFirstUserTurn(transcript.slice(-MODEL_HISTORY)),
    tools: CHAT_TOOLS,
    runTool: (name, input) => runTool(ctx, name, input),
    maxSteps: MAX_STEPS,
  });

  console.info(
    `[chatbot] ${provider.name}/${provider.model} ${result.outcome} in ${
      result.steps
    } step(s), ${Date.now() - startedAt}ms`,
  );

  // A refused turn shows no draft, even if one was made on the way.
  const draft = result.outcome === "refused" ? null : ctx.draft;

  return {
    reply: result.text,
    draft,
    suggestions: buildSuggestions(ctx.seen, draft),
    attachments: result.outcome === "refused" ? [] : ctx.attachments,
    profile: result.outcome === "refused" ? null : ctx.profile,
  };
}

/**
 * Model APIs want the conversation to open with the user. Trimming history to
 * the last N turns can leave an assistant line first; it is dropped.
 */
export function fromFirstUserTurn(transcript: ChatTurn[]): ChatTurn[] {
  const first = transcript.findIndex((turn) => turn.role === "user");
  return first === -1 ? [] : transcript.slice(first);
}

export function providerErrorMessage(error: ChatProviderError): string {
  switch (error.kind) {
    case "busy": {
      const seconds = error.retryAfterMs
        ? Math.max(1, Math.ceil(error.retryAfterMs / 1000))
        : null;

      return seconds && seconds <= 120
        ? `The assistant is busy right now. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`
        : "The assistant is busy right now. Try again in a minute.";
    }
    case "timeout":
      return "The assistant took too long to answer. Try again.";
    case "misconfigured":
      return "The assistant isn't available right now. You can still raise a request from New request.";
    default:
      return "The assistant couldn't be reached. Try again in a moment.";
  }
}
