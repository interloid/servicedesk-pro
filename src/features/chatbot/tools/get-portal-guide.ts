import "server-only";

import { z } from "zod";

import {
  GUIDE_TOPICS,
  portalGuide,
  type GuideTopic,
} from "@/features/chatbot/lib/portal-guide";
import { invalidInput, ok } from "@/features/chatbot/tools/helpers";
import type { ChatTool } from "@/features/chatbot/tools/types";
import {
  getFirstResponseTarget,
  getPortalSupportHours,
} from "@/features/portal/services/portal.service";

export const guideInput = z.object({ topic: z.enum(GUIDE_TOPICS) });

export const getPortalGuide: ChatTool = {
  name: "get_portal_guide",
  description:
    "Explain this support portal and how to use it: what customers can do here, raising and tracking requests, statuses, attachments, sign-in and profile, support hours and response times, and what this assistant can and can't do. " +
    "Use it for any question about the portal, the support service or the assistant itself, instead of answering from memory. " +
    "Topics: overview (everything at a glance), requests, account, support (hours, response times, who to ask), assistant.",
  inputSchema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        enum: [...GUIDE_TOPICS],
        description: "Which part of the guide to read.",
      },
    },
    required: ["topic"],
    additionalProperties: false,
  },
  async execute(ctx, input) {
    const parsed = guideInput.safeParse(input);

    if (!parsed.success) {
      return invalidInput(parsed.error);
    }

    const topic: GuideTopic = parsed.data.topic;
    const { tenant, customer } = ctx.identity;
    const needsFacts = topic === "overview" || topic === "support";

    // The same hours and target the portal footer and New request form show
    // this customer. A failed lookup only drops the line.
    const [hours, firstResponse] = needsFacts
      ? await Promise.all([
          getPortalSupportHours(tenant.id, customer.id).catch(() => null),
          getFirstResponseTarget(tenant.id, customer.id).catch(() => null),
        ])
      : [null, null];

    return ok(
      portalGuide(topic, {
        workspace: tenant.name,
        supportHours: hours?.hours ?? null,
        firstResponse,
      }),
    );
  },
};
