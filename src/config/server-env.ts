import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Comma-separated emails allowed into the /platform console.
  PLATFORM_ADMIN_EMAILS: z.string().optional(),
  // Supabase access token with Logs (Read), for /platform/logs and API traffic.
  SUPABASE_MANAGEMENT_TOKEN: z.string().optional(),
  // Only needed when NEXT_PUBLIC_SUPABASE_URL is a custom domain.
  SUPABASE_PROJECT_REF: z.string().optional(),
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
