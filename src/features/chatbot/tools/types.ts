import type {
  ChatAttachment,
  ChatDraft,
  ChatProfile,
} from "@/features/chatbot/chatbot";
import type { PortalIdentity } from "@/features/portal/portal";

/**
 * The shape every assistant tool shares. A tool is written once and offered to
 * whichever model provider is configured (see providers/).
 */

export type ToolContext = {
  identity: PortalIdentity;
  slug: string;
  /** Set by draft_ticket; the last draft of the turn wins. */
  draft: ChatDraft | null;
  /** What the tools looked up this turn, for follow-up suggestions. */
  seen: ToolsSeen;
  /** Files on requests get_ticket opened, for download cards in the widget. */
  attachments: ChatAttachment[];
  /** Set by get_my_profile, for the profile card in the widget. */
  profile: ChatProfile | null;
};

export type ToolsSeen = {
  /** The last list_my_tickets call. */
  listed?: {
    state: "any" | "open" | "waiting_on_you" | "resolved";
    page: number;
    total: number;
    perPage: number;
  };
  /** Numbers of requests that get_ticket found. */
  viewed: number[];
};

export type ToolOutcome = { content: string; isError: boolean };

/** JSON Schema for the tool input, in the subset strict tool use accepts. */
export type ToolInputSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
};

export type ChatTool = {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  execute: (ctx: ToolContext, input: unknown) => Promise<ToolOutcome>;
};
