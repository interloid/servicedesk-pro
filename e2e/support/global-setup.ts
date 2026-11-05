import { resetRateLimits } from "./db";

/** Sign-in attempts are counted in the database, so they outlive a test run. */
export default async function globalSetup(): Promise<void> {
  await resetRateLimits();
}
