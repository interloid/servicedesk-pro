import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { portalRequestSchema } from "@/features/portal/schemas/portal.schema";

vi.mock("server-only", () => ({}));
vi.mock("@/features/portal/services/portal.service", () => ({}));

const { CHAT_TOOLS } = await import("@/features/chatbot/tools");
const { getInput } = await import("@/features/chatbot/tools/get-ticket");
const { listInput } = await import("@/features/chatbot/tools/list-my-tickets");
const { guideInput } =
  await import("@/features/chatbot/tools/get-portal-guide");

/**
 * Each tool describes its input twice: a hand-written JSON Schema for the
 * model (kept to the subset strict tool use accepts, so no length or number
 * limits) and a Zod schema that checks what the model sends. They must agree
 * on the fields, which are required and the allowed values, or the model is
 * told to send input the tool then rejects.
 */
const ZOD_INPUTS: Record<string, z.ZodType | null> = {
  list_my_tickets: listInput,
  get_ticket: getInput,
  draft_ticket: portalRequestSchema,
  get_portal_guide: guideInput,
  get_my_profile: null,
};

type JsonObjectSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
};

const enumOf = (field: unknown): unknown[] | undefined =>
  typeof field === "object" && field !== null && "enum" in field
    ? (field.enum as unknown[])
    : undefined;

function shape(schema: JsonObjectSchema) {
  const properties = Object.entries(schema.properties ?? {});

  return {
    fields: properties.map(([name]) => name).sort(),
    required: [...(schema.required ?? [])].sort(),
    enums: Object.fromEntries(
      properties
        .filter(([, field]) => enumOf(field))
        .map(([name, field]) => [name, [...(enumOf(field) ?? [])].sort()]),
    ),
  };
}

describe("tool input schemas", () => {
  it("covers every tool", () => {
    expect(CHAT_TOOLS.map((tool) => tool.name).sort()).toEqual(
      Object.keys(ZOD_INPUTS).sort(),
    );
  });

  for (const tool of CHAT_TOOLS) {
    it(`${tool.name}: the model's schema matches the Zod check`, () => {
      const zodInput = ZOD_INPUTS[tool.name];
      const expected = zodInput
        ? shape(z.toJSONSchema(zodInput, { io: "input" }) as JsonObjectSchema)
        : { fields: [], required: [], enums: {} };

      expect(shape(tool.inputSchema)).toEqual(expected);
    });
  }
});
