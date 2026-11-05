import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

import { createArgosReporterOptions } from "@argos-ci/playwright/reporter";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const DIST_DIR = ".next-e2e";

function readEnvFile(path: string): Record<string, string | undefined> {
  try {
    return parseEnv(readFileSync(resolve(path), "utf8"));
  } catch {
    return {};
  }
}

const stack = readEnvFile(".e2e/stack.env");
const supabaseUrl = stack.E2E_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error("No E2E stack found. Run: npm run e2e:stack");
}
if (!["127.0.0.1", "localhost"].includes(new URL(supabaseUrl).hostname)) {
  throw new Error(`Refusing to test against non-local ${supabaseUrl}.`);
}

// Next.js fills any variable missing from the process from .env.local, which
// holds live keys. Blanking every name it or .env.example lists stops that, so
// the app under test has no way to reach a hosted service.
const blanked = Object.fromEntries(
  [".env.example", ".env.local"]
    .flatMap((file) => Object.keys(readEnvFile(file)))
    .filter((name) => name !== "NODE_ENV")
    .map((name) => [name, ""]),
);

// Uploads only with CI set, which `npm run test:visual` does. Checked here so a
// missing token stops the run now, not after every test has finished.
const argosToken =
  process.env.ARGOS_TOKEN || readEnvFile(".env.local").ARGOS_TOKEN;
if (argosToken) {
  process.env.ARGOS_TOKEN = argosToken;
} else if (process.env.CI) {
  throw new Error("Missing ARGOS_TOKEN. Add it to .env.local.");
}

const appEnv: Record<string, string> = {
  ...blanked,
  E2E_DIST_DIR: DIST_DIR,
  NEXT_PUBLIC_SITE_URL: BASE_URL,
  NEXT_PUBLIC_SITE_NAME: "ServiceDesk",
  NEXT_PUBLIC_SITE_DESCRIPTION: "ServiceDesk end-to-end test build",
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.E2E_SUPABASE_ANON_KEY ?? "",
  SUPABASE_SERVICE_ROLE_KEY: stack.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "",
  SESSION_SECRET: "e2e-session-secret-e2e-session-secret",
  PLATFORM_ADMIN_EMAILS: "admin@juniper.seed.test",
  SUBDOMAIN_ROUTING_AVAILABLE: "false",
};

// E2E_SKIP_BUILD=1 reuses the last build, for repeat runs with no app changes.
const startServer = `npx next start -p ${PORT}`;

export default defineConfig({
  testDir: "e2e",
  // Not *.spec.ts: `vitest run` would collect those and fail on them.
  testMatch: "**/*.e2e.ts",
  globalSetup: "./e2e/support/global-setup.ts",
  outputDir: ".e2e/results",
  // Local Auth opens a database connection per request. More workers run the
  // container out of ports, and its 500s then read as signed-out users.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    process.env.CI ? ["dot"] : ["list"],
    ["html", { outputFolder: ".e2e/report", open: "never" }],
    // Uploads only on CI, or with CI=true: local renders aren't the baseline.
    [
      "@argos-ci/playwright/reporter",
      createArgosReporterOptions({ uploadToArgos: !!process.env.CI }),
    ],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    // Reduce text rendering differences between machines.
    launchOptions: {
      args: ["--disable-lcd-text", "--font-render-hinting=none"],
    },
  },
  projects: [
    { name: "public", testMatch: "public/**/*.e2e.ts" },
    { name: "setup", testMatch: "setup/**/*.e2e.ts" },
    {
      name: "signed-in",
      testMatch: "signed-in/**/*.e2e.ts",
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD
      ? startServer
      : `npx next build && ${startServer}`,
    url: `${BASE_URL}/login`,
    env: appEnv,
    timeout: 300_000,
    // Never reuse: a server already on this port may be wired to live data.
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
});
