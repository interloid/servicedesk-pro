import type { z } from "zod";

import type { ToolOutcome } from "@/features/chatbot/tools/types";

/** A successful result: the value as JSON for the model. */
export const ok = (value: unknown): ToolOutcome => ({
  content: JSON.stringify(value),
  isError: false,
});

export const fail = (message: string): ToolOutcome => ({
  content: message,
  isError: true,
});

export function invalidInput(error: z.ZodError): ToolOutcome {
  return fail(
    `Invalid input: ${error.issues
      .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
      .join("; ")}`,
  );
}

export const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max)}…` : text;

/** "2026-11-16": short (tokens are the free tier's tightest limit) and unambiguous. */
export const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);
