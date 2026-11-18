import "server-only";

import { draftTicket } from "@/features/chatbot/tools/draft-ticket";
import { getMyProfile } from "@/features/chatbot/tools/get-my-profile";
import { getPortalGuide } from "@/features/chatbot/tools/get-portal-guide";
import { getTicket } from "@/features/chatbot/tools/get-ticket";
import { fail } from "@/features/chatbot/tools/helpers";
import { listMyTickets } from "@/features/chatbot/tools/list-my-tickets";
import type {
  ChatTool,
  ToolContext,
  ToolOutcome,
} from "@/features/chatbot/tools/types";

export type {
  ChatTool,
  ToolContext,
  ToolInputSchema,
  ToolOutcome,
  ToolsSeen,
} from "@/features/chatbot/tools/types";

/**
 * The only things the assistant can do. Each tool is written once here and
 * offered to whichever model provider is configured.
 *
 * Every tool acts as the signed-in customer: the identity comes from the
 * session (ToolContext), never from the model's input, and the services they
 * call filter by tenant and requester. Nothing here writes to the database --
 * draft_ticket only records a draft, which the customer confirms through the
 * normal submit action.
 */

export const CHAT_TOOLS: readonly ChatTool[] = [
  listMyTickets,
  getTicket,
  draftTicket,
  getPortalGuide,
  getMyProfile,
];

/**
 * Runs a tool call from the model. An unknown name is answered with an error
 * listing the real names (models sometimes vary the letter case) instead of
 * failing the turn, and a tool that throws becomes an error result.
 */
export async function runTool(
  ctx: ToolContext,
  name: string,
  input: unknown,
  tools: readonly ChatTool[] = CHAT_TOOLS,
): Promise<ToolOutcome> {
  const tool =
    tools.find((candidate) => candidate.name === name) ??
    tools.find(
      (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
    );

  if (!tool) {
    return fail(
      `Unknown tool "${name}". Available tools: ${tools
        .map((candidate) => candidate.name)
        .join(", ")}.`,
    );
  }

  try {
    return await tool.execute(ctx, input);
  } catch (error) {
    console.error(`[chatbot] tool ${tool.name} failed:`, error);
    return fail("The help desk could not answer that just now.");
  }
}
