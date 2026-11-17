import { z } from "zod";

import {
  SUPPORT_BODY_MAX,
  SUPPORT_STATUSES,
  SUPPORT_SUBJECT_MAX,
} from "./support";

const body = z
  .string()
  .trim()
  .min(1, "Write a message.")
  .max(SUPPORT_BODY_MAX, `Keep it under ${SUPPORT_BODY_MAX} characters.`);

export const createSupportRequestSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, "Add a short subject.")
    .max(
      SUPPORT_SUBJECT_MAX,
      `Keep the subject under ${SUPPORT_SUBJECT_MAX} characters.`,
    ),
  description: z
    .string()
    .trim()
    .min(10, "Describe the problem in at least 10 characters.")
    .max(SUPPORT_BODY_MAX, `Keep it under ${SUPPORT_BODY_MAX} characters.`),
  allowWorkspaceAccess: z.boolean(),
});

export type CreateSupportRequestValues = z.infer<
  typeof createSupportRequestSchema
>;

export const supportReplySchema = z.object({
  requestId: z.uuid(),
  body,
});

export const supportAccessSchema = z.object({
  requestId: z.uuid(),
  allow: z.boolean(),
});

export const supportRequestIdSchema = z.object({ requestId: z.uuid() });

export const supportStatusSchema = z.object({
  requestId: z.uuid(),
  status: z.enum(SUPPORT_STATUSES),
});
