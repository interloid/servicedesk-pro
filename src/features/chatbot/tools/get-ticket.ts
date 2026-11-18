import "server-only";

import { z } from "zod";

import { clip, day, invalidInput, ok } from "@/features/chatbot/tools/helpers";
import type { ChatTool } from "@/features/chatbot/tools/types";
import {
  PORTAL_STATE_LABEL,
  portalRequestPath,
} from "@/features/portal/portal";
import {
  findPortalRequestIdByNumber,
  getPortalRequest,
} from "@/features/portal/services/portal.service";

export const getInput = z.object({
  number: z.number().int().min(1),
});

/** How much of a thread goes back to the model: the latest few messages. */
const THREAD_TAIL = 5;

/** Download cards per request; the request page has the rest. */
const MAX_ATTACHMENT_CARDS = 8;

/** Portal attachment links are signed for an hour; a little margin here. */
const ATTACHMENT_LINK_MS = 55 * 60_000;

export const getTicket: ChatTool = {
  name: "get_ticket",
  description:
    "Look up one of the customer's own requests by its number (the customer may write it as #1042) " +
    "and return its status, description, the latest public messages and the files attached to it. " +
    "Use it whenever the customer asks about a specific request, even if you looked it up earlier, so the status is current.",
  inputSchema: {
    type: "object",
    properties: {
      number: {
        type: "integer",
        description: "The request number, without the #.",
      },
    },
    required: ["number"],
    additionalProperties: false,
  },
  async execute(ctx, input) {
    const parsed = getInput.safeParse(input);

    if (!parsed.success) {
      return invalidInput(parsed.error);
    }

    const id = await findPortalRequestIdByNumber(
      ctx.identity,
      parsed.data.number,
    );
    const request = id ? await getPortalRequest(ctx.identity, id) : null;

    if (!request) {
      // Same answer for "does not exist" and "belongs to someone else".
      return ok({
        found: false,
        message: `No request #${parsed.data.number} on this customer's account.`,
      });
    }

    if (request.number !== null) {
      ctx.seen.viewed.push(request.number);
    }

    const url = portalRequestPath(ctx.slug, request.id);
    const files = request.messages.flatMap((message) =>
      message.attachments.map((attachment) => ({
        attachment,
        from: message.authorType === "customer" ? "customer" : "support",
        at: day(message.createdAt),
      })),
    );
    const expiresAt = new Date(Date.now() + ATTACHMENT_LINK_MS).toISOString();

    // Newest first. The links go to the widget only; the model gets names.
    for (const { attachment } of [...files]
      .reverse()
      .slice(0, MAX_ATTACHMENT_CARDS)) {
      ctx.attachments.push({
        name: attachment.name,
        size: attachment.size,
        mime: attachment.mime,
        url: attachment.url,
        expiresAt,
        requestNumber: request.number,
        requestUrl: url,
      });
    }

    return ok({
      found: true,
      number: request.number,
      subject: request.subject,
      status: PORTAL_STATE_LABEL[request.state],
      url,
      created: day(request.createdAt),
      updated: day(request.updatedAt),
      resolved: day(request.resolvedAt),
      description: clip(request.description, 1_000),
      totalMessages: request.messages.length,
      latestMessages: request.messages.slice(-THREAD_TAIL).map((message) => ({
        from:
          message.authorType === "customer"
            ? "customer"
            : message.authorType === "agent"
              ? `support (${message.authorName})`
              : "system",
        at: day(message.createdAt),
        body: clip(message.body, 500),
      })),
      // Names only. The customer sees each file as a download card under
      // your reply.
      files: files.map(({ attachment, from, at }) => ({
        name: attachment.name,
        sizeKb: Math.max(1, Math.round(attachment.size / 1024)),
        from,
        at,
      })),
    });
  },
};
