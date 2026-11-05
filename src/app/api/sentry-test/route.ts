import { requirePlatformAdmin } from "@/features/platform-admin/services/platform-access";

/**
 * Throws on purpose, to check server errors reach Sentry. Open to anyone in
 * development only: in production a public URL like this would let anybody fill
 * the Sentry quota.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    await requirePlatformAdmin();
  }

  throw new Error(`Sentry test: server error at ${new Date().toISOString()}`);
}
