import "server-only";

import { ok } from "@/features/chatbot/tools/helpers";
import type { ChatTool } from "@/features/chatbot/tools/types";

export const getMyProfile: ChatTool = {
  name: "get_my_profile",
  description:
    "Return the signed-in customer's own profile as the portal holds it: name, email, company and whether a profile photo is set. " +
    'Use it when they ask about their own details ("what\'s my name?", "which email am I signed in with?").',
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  async execute(ctx) {
    // The session's own customer row -- what the portal menu already shows
    // them. No ids, nothing about anyone else.
    const { customer, tenant } = ctx.identity;

    ctx.profile = {
      name: customer.fullName,
      email: customer.email,
      company: customer.company,
      initials: customer.initials,
      avatarUrl: customer.avatarUrl,
    };

    return ok({
      name: customer.fullName,
      email: customer.email,
      company: customer.company ?? "not set",
      profilePhoto: customer.avatarUrl ? "set" : "not set",
      portal: `${tenant.name} support portal`,
      howToChange:
        "Name, company and photo: Profile in the menu at the top right. Email: raise a request.",
      shownToCustomer:
        "These details and the photo appear as a profile card under your reply; don't repeat them, say one short sentence.",
    });
  },
};
