import type { ChatDraft } from "@/features/chatbot/chatbot";
import type { ToolsSeen } from "@/features/chatbot/tools";

/**
 * Follow-up chips under a reply, worked out from what the tools looked up --
 * not asked of the model, so they cost no tokens and are never made up.
 * At most three; none while a draft is waiting, since its card has the actions.
 */
export function buildSuggestions(
  seen: ToolsSeen,
  draft: ChatDraft | null,
): string[] {
  if (draft) {
    return [];
  }

  const suggestions: string[] = [];
  const { listed, viewed } = seen;

  if (listed && listed.page * listed.perPage < listed.total) {
    suggestions.push("Show the next page");
  }

  if (viewed.length > 0) {
    suggestions.push(`What's the latest on #${viewed.at(-1)}?`);
  }

  if (listed?.state !== "waiting_on_you") {
    suggestions.push("What's waiting on me?");
  }

  if (listed?.state !== "open") {
    suggestions.push("Show my open requests");
  }

  suggestions.push("Report a new problem");

  return [...new Set(suggestions)].slice(0, 3);
}
