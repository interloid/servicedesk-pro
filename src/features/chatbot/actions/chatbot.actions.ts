"use server";

import * as Sentry from "@sentry/nextjs";

import {
  CHAT_DAILY_LIMIT,
  type ChatReply,
  type ChatTurn,
  type ChatUsage,
} from "@/features/chatbot/chatbot";
import { getChatProvider } from "@/features/chatbot/providers";
import { chatTranscriptSchema } from "@/features/chatbot/schemas/chatbot.schema";
import { ChatProviderError } from "@/features/chatbot/providers/types";
import {
  providerErrorMessage,
  runChat,
} from "@/features/chatbot/services/chat.service";
import type { PortalResult } from "@/features/portal/portal";
import { getPortalIdentity } from "@/features/portal/services/portal.service";
import { peekRateLimit, rateLimit } from "@/lib/rate-limit";

/**
 * Per customer (their sign-in), not per IP. Each message is two or three model
 * calls against a provider limit that every customer shares -- on Groq's free
 * tier, about 450 messages a day for the whole portal -- so one customer must
 * not be able to use it up: a burst limit, plus a daily one.
 *
 * The burst limit counts every attempt, so retrying can't flood the provider.
 * The daily allowance -- the number the customer sees -- counts only messages
 * that got an answer: a busy or failed provider costs them nothing.
 */
const BURST_LIMIT = { limit: 20, windowMs: 10 * 60_000 };
const DAY_LIMIT = { limit: CHAT_DAILY_LIMIT, windowMs: 24 * 60 * 60_000 };

const burstKey = (userId: string) => `portal:chat:burst:${userId}`;
const dayKey = (userId: string) => `portal:chat:day:${userId}`;

function toUsage(count: number, resetAt: number | null): ChatUsage {
  return {
    used: Math.min(count, CHAT_DAILY_LIMIT),
    limit: CHAT_DAILY_LIMIT,
    resetsAt: resetAt ? new Date(resetAt).toISOString() : null,
  };
}

/**
 * The signed-in customer's allowance, read without spending any of it -- for
 * the meter when the chat opens.
 */
export async function getChatUsageAction(
  slug: string,
): Promise<PortalResult<ChatUsage>> {
  const identity = await getPortalIdentity(slug);

  if (!identity) {
    return {
      success: false,
      code: "not_signed_in",
      message: "Your session has expired. Sign in again.",
    };
  }

  const { count, resetAt } = await peekRateLimit(dayKey(identity.userId));

  return { success: true, data: toUsage(count, resetAt) };
}

function waitText(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));

  if (minutes < 90) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * The portal chat's only entry point. Creating a request is NOT done here: the
 * reply may carry a draft, and the widget confirms it via submitRequestAction.
 */
export async function sendChatMessageAction(
  slug: string,
  transcript: ChatTurn[],
): Promise<PortalResult<ChatReply>> {
  const parsed = chatTranscriptSchema.safeParse(transcript);

  if (!parsed.success) {
    return {
      success: false,
      code: "validation",
      message: parsed.error.issues[0]?.message ?? "That message can't be sent.",
    };
  }

  const identity = await getPortalIdentity(slug);

  if (!identity) {
    return {
      success: false,
      code: "not_signed_in",
      message: "Your session has expired. Sign in again.",
    };
  }

  const provider = getChatProvider();

  if (!provider) {
    return {
      success: false,
      code: "unknown",
      message: "The assistant isn't available right now.",
    };
  }

  const burst = await rateLimit(burstKey(identity.userId), BURST_LIMIT);

  if (!burst.allowed) {
    return {
      success: false,
      code: "rate_limited",
      message: `You've sent a lot of messages. Try again in ${waitText(burst.retryAfterMs)}.`,
    };
  }

  const today = await peekRateLimit(dayKey(identity.userId));

  if (today.count >= CHAT_DAILY_LIMIT) {
    return {
      success: false,
      code: "rate_limited",
      message: `You've reached today's limit for the assistant. Try again in ${waitText(
        (today.resetAt ?? Date.now()) - Date.now(),
      )}, or raise a request from New request.`,
    };
  }

  try {
    const reply = await runChat({
      provider,
      identity,
      slug,
      transcript: parsed.data,
    });

    // Answered, so it counts against today's allowance.
    const spent = await rateLimit(dayKey(identity.userId), DAY_LIMIT);

    return {
      success: true,
      data: { ...reply, usage: toUsage(spent.count, spent.resetAt) },
    };
  } catch (error) {
    if (error instanceof ChatProviderError) {
      // Busy and timeouts are expected on a free tier: logged, not reported.
      if (error.kind === "busy" || error.kind === "timeout") {
        console.warn(`[chatbot] ${provider.name} ${error.kind}:`, error.cause);
      } else {
        Sentry.captureException(error, {
          tags: { feature: "portal-chat", provider: provider.name },
        });
        console.error("[chatbot] turn failed:", error.cause ?? error);
      }

      return {
        success: false,
        code: error.kind === "busy" ? "rate_limited" : "unknown",
        message: providerErrorMessage(error),
      };
    }

    Sentry.captureException(error, {
      tags: { feature: "portal-chat", provider: provider.name },
    });
    console.error("[chatbot] turn failed:", error);

    return {
      success: false,
      code: "unknown",
      message: "Something went wrong. Try again in a moment.",
    };
  }
}
