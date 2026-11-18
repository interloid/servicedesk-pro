import "server-only";

import { invalidInput, ok } from "@/features/chatbot/tools/helpers";
import type { ChatTool } from "@/features/chatbot/tools/types";
import { portalRequestSchema } from "@/features/portal/schemas/portal.schema";

export const draftTicket: ChatTool = {
  name: "draft_ticket",
  description:
    "Prepare a new support request for the customer to review. This does NOT create the request: " +
    "the customer sees the draft with Confirm and Edit buttons and creates it themselves. " +
    "Call it once you understand the problem; call it again with revised text if the customer asks for changes.",
  inputSchema: {
    type: "object",
    properties: {
      subject: {
        type: "string",
        description:
          "A short, specific summary of the problem, under 80 characters.",
      },
      description: {
        type: "string",
        description:
          "The details the customer gave: what is happening, where, since when, error messages, steps already tried. Written in the customer's voice.",
      },
    },
    required: ["subject", "description"],
    additionalProperties: false,
  },
  async execute(ctx, input) {
    // The same rules as the New request form, so a draft that passes here
    // also passes submitRequestAction when the customer confirms it.
    const parsed = portalRequestSchema.safeParse(input);

    if (!parsed.success) {
      return invalidInput(parsed.error);
    }

    ctx.draft = parsed.data;

    return ok({
      status: "shown_to_customer",
      note: "Not created yet. Ask the customer to review the draft and press Confirm.",
    });
  },
};
