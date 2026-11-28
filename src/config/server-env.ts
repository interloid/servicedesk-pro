import "server-only";

import { z } from "zod";

/** `KEY=` in a .env file is "", which should read as unset, not as invalid. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    schema.optional(),
  );

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Comma-separated emails allowed into the /platform console.
  PLATFORM_ADMIN_EMAILS: z.string().optional(),
  // Supabase access token with Logs (Read), for /platform/logs and API traffic.
  SUPABASE_MANAGEMENT_TOKEN: z.string().optional(),
  // Only needed when NEXT_PUBLIC_SUPABASE_URL is a custom domain.
  SUPABASE_PROJECT_REF: z.string().optional(),
  // Portal chatbot. Without a usable provider the chat widget is not shown.
  CHATBOT_PROVIDER: optional(z.enum(["anthropic", "groq", "ollama"])),
  ANTHROPIC_API_KEY: optional(z.string()),
  GROQ_API_KEY: optional(z.string()),
  CHATBOT_MODEL: optional(z.string()),
  OLLAMA_BASE_URL: optional(z.url()),
  OLLAMA_MODEL: optional(z.string()),
  // Email-to-ticket (Settings -> Channels). The Gmail connection is offered
  // only when all of these are set; see docs/email-to-ticket.md.
  GOOGLE_CLIENT_ID: optional(z.string()),
  GOOGLE_CLIENT_SECRET: optional(z.string()),
  // https://<app>/api/integrations/gmail/callback, registered on the client.
  GOOGLE_REDIRECT_URI: optional(z.url()),
  // projects/<project>/topics/<topic>
  GOOGLE_PUBSUB_TOPIC: optional(
    z.string().regex(/^projects\/[^/]+\/topics\/[^/]+$/),
  ),
  // 32 bytes, base64 (openssl rand -base64 32). Same value as the Edge Functions'.
  EMAIL_ENCRYPTION_KEY: optional(z.string()),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid server environment variables:\n${JSON.stringify(
      parsed.error.flatten().fieldErrors,
      null,
      2,
    )}`,
  );
}

export const serverEnv = parsed.data;
