import { z } from "zod";

import {
  CHAT_HISTORY_MAX,
  CHAT_MESSAGE_MAX,
  CHAT_REPLY_MAX,
} from "@/features/chatbot/chatbot";

/**
 * The transcript as it arrives from the browser. It is untrusted: a caller can
 * write anything into it, including "assistant" lines. That is acceptable
 * because it only shapes this customer's own conversation -- every tool reads
 * the session's identity, and creating a request still goes through the normal
 * submit action.
 *
 * Only the customer's lines are held to CHAT_MESSAGE_MAX. Earlier assistant
 * replies are the model's own output and can be longer; they are cut to
 * CHAT_REPLY_MAX rather than refused, so one long answer can't stop the
 * customer sending anything else.
 */
const userTurn = z.object({
  role: z.literal("user"),
  text: z
    .string()
    .trim()
    .min(1)
    .max(CHAT_MESSAGE_MAX, "That message is too long."),
});

const assistantTurn = z.object({
  role: z.literal("assistant"),
  text: z
    .string()
    .trim()
    .min(1)
    .transform((text) => text.slice(0, CHAT_REPLY_MAX)),
});

export const chatTranscriptSchema = z
  .array(z.discriminatedUnion("role", [userTurn, assistantTurn]))
  .min(1)
  .max(CHAT_HISTORY_MAX)
  .refine((turns) => turns.at(-1)?.role === "user", {
    message: "The last message must be the customer's.",
  });
