import "server-only";

import { z } from "zod";

import { day, invalidInput, ok } from "@/features/chatbot/tools/helpers";
import type { ChatTool } from "@/features/chatbot/tools/types";
import {
  PORTAL_STATE_LABEL,
  portalRequestPath,
} from "@/features/portal/portal";
import { listPortalRequests } from "@/features/portal/services/portal.service";

export const listInput = z.object({
  state: z.enum(["any", "open", "waiting_on_you", "resolved"]),
  page: z.number().int().min(1).max(100),
});

export const listMyTickets: ChatTool = {
  name: "list_my_tickets",
  description:
    "List the signed-in customer's own support requests, most recently updated first, five per page. " +
    'Use it when the customer asks about their requests in general ("what\'s open?", "any updates?"). ' +
    "state filters by the portal status: open (being worked on), waiting_on_you (the team needs the customer's reply), resolved, or any. " +
    "Returns total so you can tell the customer when there are more pages, and a url for each request to link to.",
  inputSchema: {
    type: "object",
    properties: {
      state: {
        type: "string",
        enum: ["any", "open", "waiting_on_you", "resolved"],
        description: "Which requests to list.",
      },
      page: {
        type: "integer",
        description: "Page number, starting at 1.",
      },
    },
    required: ["state", "page"],
    additionalProperties: false,
  },
  async execute(ctx, input) {
    const parsed = listInput.safeParse(input);

    if (!parsed.success) {
      return invalidInput(parsed.error);
    }

    const { state, page } = parsed.data;
    const result = await listPortalRequests(ctx.identity, {
      state: state === "any" ? undefined : state,
      sort: "updated",
      page,
    });

    ctx.seen.listed = {
      state,
      page: result.page,
      total: result.total,
      perPage: result.perPage,
    };

    const requests = result.requests.map((request) => ({
      number: request.number,
      subject: request.subject,
      status: PORTAL_STATE_LABEL[request.state],
      updated: day(request.updatedAt),
      teamHasReplied: request.hasTeamReply,
      url: portalRequestPath(ctx.slug, request.id),
    }));

    return ok({
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      requests,
    });
  },
};
