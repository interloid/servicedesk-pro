#!/usr/bin/env node
/**
 * One source for deployed configuration: the GitHub environment.
 *
 * The Deploy workflow passes every secret and variable of its GitHub
 * environment (`development` or `production`) to this script, which pushes
 * them to where they're used:
 *
 *   node scripts/ci/sync-env.mjs check     every required value is there
 *   node scripts/ci/sync-env.mjs supabase  Edge Function secrets, via the CLI
 *   node scripts/ci/sync-env.mjs vercel    app variables, via the Vercel API
 *   node scripts/ci/sync-env.mjs build-env app variables into the file
 *                                          `vercel build` reads, after `vercel pull`
 *                                          (Vercel never returns sensitive values)
 *
 * Inputs (environment): SECRETS_JSON and VARS_JSON (toJSON of the contexts),
 * DEPLOY_ENV (development | production), APP_ONLY, SUPABASE_PROJECT_REF,
 * VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID.
 *
 * Values never reach the log. A value that's empty in GitHub is left as it is
 * where it's used, so optional settings can be adopted one at a time.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Every deployed setting. `to`: "app" (Vercel) or "functions" (Supabase Edge
 * Function secrets). `secret`: must be a GitHub secret, never a variable,
 * because variables are printed in logs. `required`: the deploy stops without it.
 */
export const MANIFEST = [
  // App: site
  { name: "NEXT_PUBLIC_SITE_URL", to: "app", required: true },
  { name: "NEXT_PUBLIC_APP_DOMAIN", to: "app", required: true },
  { name: "NEXT_PUBLIC_SITE_NAME", to: "app", required: true },
  { name: "NEXT_PUBLIC_SITE_DESCRIPTION", to: "app", required: true },
  { name: "NEXT_PUBLIC_TWITTER_HANDLE", to: "app" },
  // App: Supabase
  { name: "NEXT_PUBLIC_SUPABASE_URL", to: "app", required: true },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", to: "app", required: true },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    to: "app",
    required: true,
    secret: true,
  },
  // App: platform console
  { name: "PLATFORM_ADMIN_EMAILS", to: "app" },
  { name: "SUPABASE_MANAGEMENT_TOKEN", to: "app", secret: true },
  { name: "SUPABASE_PROJECT_REF", to: "app" },
  // App: payments and monitoring
  { name: "NEXT_PUBLIC_PAYPAL_CLIENT_ID", to: "app" },
  { name: "NEXT_PUBLIC_SENTRY_DSN", to: "app" },
  { name: "SENTRY_DSN", to: "app" },
  { name: "SENTRY_ORG", to: "app" },
  { name: "SENTRY_PROJECT", to: "app" },
  { name: "SENTRY_AUTH_TOKEN", to: "app", secret: true },
  // Edge Functions
  { name: "PAYPAL_BASE_URL", to: "functions", required: true },
  { name: "PAYPAL_CLIENT_ID", to: "functions", required: true },
  {
    name: "PAYPAL_CLIENT_SECRET",
    to: "functions",
    required: true,
    secret: true,
  },
  { name: "PAYPAL_WEBHOOK_ID", to: "functions", required: true },
  { name: "GOOGLE_CLIENT_ID", to: "functions", required: true },
  {
    name: "GOOGLE_CLIENT_SECRET",
    to: "functions",
    required: true,
    secret: true,
  },
  {
    name: "GOOGLE_REFRESH_TOKEN",
    to: "functions",
    required: true,
    secret: true,
  },
  { name: "FROM_EMAIL", to: "functions", required: true },
  { name: "FRONTEND_URL", to: "functions", required: true },
];

const LIVE_PAYPAL = "https://api-m.paypal.com";

/**
 * Picks this deploy's values out of the GitHub contexts and checks them.
 * Returns { values: Map<name, value>, errors: string[] }.
 */
export function resolveValues({ secrets, vars, deployEnv, appOnly }) {
  const values = new Map();
  const errors = [];
  const missing = [];

  for (const entry of MANIFEST) {
    if (appOnly && entry.to !== "app") continue;

    const fromSecret = secrets[entry.name] ?? "";
    const fromVar = vars[entry.name] ?? "";
    if (entry.secret && fromVar) {
      errors.push(
        `${entry.name} is a GitHub variable, which shows in logs. Delete it and add it as a secret.`,
      );
      continue;
    }
    const value = (fromSecret || fromVar).trim();
    if (value) values.set(entry.name, value);
    else if (entry.required) missing.push(entry.name);
  }

  if (missing.length > 0) {
    errors.push(
      `Missing in the '${deployEnv}' GitHub environment: ${missing.join(", ")}. See docs/deployment.md.`,
    );
  }

  // The app must talk to the database this deploy migrates.
  const ref = vars.SUPABASE_PROJECT_REF;
  const url = values.get("NEXT_PUBLIC_SUPABASE_URL");
  const host = url && URL.canParse(url) ? new URL(url).hostname : "";
  if (ref && host.endsWith(".supabase.co") && host !== `${ref}.supabase.co`) {
    errors.push(
      `NEXT_PUBLIC_SUPABASE_URL points at ${host}, but this environment deploys project ${ref}.`,
    );
  }

  // Development never moves real money.
  if (
    deployEnv === "development" &&
    values.get("PAYPAL_BASE_URL")?.startsWith(LIVE_PAYPAL)
  ) {
    errors.push(
      "PAYPAL_BASE_URL is live PayPal in development. Use https://api-m.sandbox.paypal.com.",
    );
  }

  return { values, errors };
}

/**
 * Sets `values` in the text of a dotenv file, replacing lines for the same
 * names and keeping the rest. Values are double-quoted (single-quoted if they
 * contain a double quote), the forms the dotenv parser reads back verbatim.
 */
export function mergeDotenv(text, values) {
  const kept = text.split("\n").filter((line) => {
    const name = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    return line.trim() !== "" && !(name && values.has(name[1]));
  });
  const lines = [...values].map(([name, value]) => {
    if (value.includes("\n") || (value.includes('"') && value.includes("'"))) {
      throw new Error(`${name} can't be written to a dotenv file as it is.`);
    }
    return value.includes('"') ? `${name}='${value}'` : `${name}="${value}"`;
  });
  return [...kept, ...lines].join("\n") + "\n";
}

/**
 * Works out the Vercel API calls that make `desired` true for one scope, given
 * the project's current variables. Development is Preview for branch `main`;
 * production is Production.
 *
 * Vercel only accepts branch-scoped variables on a project connected to a Git
 * repository. Without one (`gitConnected: false`) development is every Preview
 * deployment instead; with no Git connection there are no pull-request
 * previews to keep apart from it.
 *
 * A variable shared with other environments (for example "All Environments")
 * is split: this target is removed from it, keeping its value elsewhere, and a
 * variable for this target alone is created.
 */
export function planVercel(
  existing,
  desired,
  deployEnv,
  { gitConnected = true } = {},
) {
  const target = deployEnv === "production" ? "production" : "preview";
  const gitBranch =
    deployEnv === "production" || !gitConnected ? undefined : "main";
  const ops = [];

  for (const [key, value] of desired) {
    const matches = existing.filter(
      (env) =>
        env.key === key &&
        env.target?.includes(target) &&
        (env.gitBranch || undefined) === gitBranch,
    );
    const own = matches.find((env) => env.target.length === 1);
    for (const shared of matches.filter((env) => env !== own)) {
      ops.push({
        op: "untarget",
        key,
        id: shared.id,
        target: shared.target.filter((t) => t !== target),
        original: shared.target,
      });
    }
    if (own) ops.push({ op: "update", key, id: own.id, value });
    else ops.push({ op: "create", key, value, target: [target], gitBranch });
  }
  return ops;
}

function input() {
  const deployEnv = process.env.DEPLOY_ENV;
  if (deployEnv !== "development" && deployEnv !== "production") {
    throw new Error(`DEPLOY_ENV must be development or production.`);
  }
  return {
    secrets: JSON.parse(process.env.SECRETS_JSON || "{}"),
    vars: JSON.parse(process.env.VARS_JSON || "{}"),
    deployEnv,
    appOnly: process.env.APP_ONLY === "true",
  };
}

function resolveOrExit(args) {
  const { values, errors } = resolveValues(args);
  for (const error of errors) console.log(`::error::${error}`);
  if (errors.length > 0) process.exit(1);
  return values;
}

function only(values, to) {
  const names = new Set(MANIFEST.filter((e) => e.to === to).map((e) => e.name));
  return new Map([...values].filter(([name]) => names.has(name)));
}

// godotenv double-quoted form: escapes for backslash, quote and newline.
const quote = (value) =>
  `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;

function syncSupabase(values) {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const secrets = only(values, "functions");
  const dir = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), "fn-"));
  const file = join(dir, "secrets.env");
  try {
    writeFileSync(
      file,
      [...secrets].map(([k, v]) => `${k}=${quote(v)}`).join("\n") + "\n",
      { mode: 0o600 },
    );
    execFileSync(
      "supabase",
      ["secrets", "set", "--project-ref", ref, "--env-file", file],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(
    `Set ${secrets.size} Edge Function secrets on ${ref}: ${[...secrets.keys()].join(", ")}`,
  );
}

async function syncVercel(values, deployEnv) {
  const { VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID } = process.env;
  const team = VERCEL_ORG_ID?.startsWith("team_")
    ? `teamId=${encodeURIComponent(VERCEL_ORG_ID)}`
    : "";
  const api = async (method, path, body) => {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(
      `https://api.vercel.com${path}${team ? sep + team : ""}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: body && JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!res.ok) {
      // The error body names the problem; it never echoes a value we sent.
      throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
    }
    return res.json();
  };

  const project = `/v9/projects/${encodeURIComponent(VERCEL_PROJECT_ID)}`;
  // `link` is the project's Git connection; branch-scoped variables need one.
  const gitConnected = Boolean((await api("GET", project)).link);
  const { envs } = await api("GET", `/v10/projects/${VERCEL_PROJECT_ID}/env`);
  const secretNames = new Set(
    MANIFEST.filter((e) => e.secret).map((e) => e.name),
  );

  // A split variable is restored if its replacement can't be created, so this
  // environment never ends up without it.
  const split = new Map();
  for (const op of planVercel(envs, only(values, "app"), deployEnv, {
    gitConnected,
  })) {
    if (op.op === "untarget") {
      await api("PATCH", `${project}/env/${op.id}`, { target: op.target });
      split.set(op.key, op);
      console.log(`  split   ${op.key} (kept for ${op.target.join(", ")})`);
    } else if (op.op === "update") {
      await api("PATCH", `${project}/env/${op.id}`, { value: op.value });
      console.log(`  update  ${op.key}`);
    } else {
      try {
        await api("POST", `/v10/projects/${VERCEL_PROJECT_ID}/env`, {
          key: op.key,
          value: op.value,
          target: op.target,
          ...(op.gitBranch && { gitBranch: op.gitBranch }),
          type: secretNames.has(op.key) ? "sensitive" : "encrypted",
        });
      } catch (error) {
        const undo = split.get(op.key);
        if (undo) {
          await api("PATCH", `${project}/env/${undo.id}`, {
            target: undo.original,
          });
        }
        throw error;
      }
      console.log(`  create  ${op.key}`);
    }
  }
  const scope =
    deployEnv === "production"
      ? "Production"
      : gitConnected
        ? "Preview (branch main)"
        : "Preview (all branches; the project has no Git connection)";
  console.log(`Vercel ${scope} variables are in sync.`);
}

async function main() {
  const args = input();
  const values = resolveOrExit(args);
  const command = process.argv[2];
  if (command === "check") {
    console.log(
      `Configuration for '${args.deployEnv}' is complete (${values.size} values).`,
    );
  } else if (command === "supabase") {
    syncSupabase(values);
  } else if (command === "vercel") {
    await syncVercel(values, args.deployEnv);
  } else if (command === "build-env") {
    const target = args.deployEnv === "production" ? "production" : "preview";
    const file = `.vercel/.env.${target}.local`;
    const app = only(values, "app");
    writeFileSync(file, mergeDotenv(readFileSync(file, "utf8"), app), {
      mode: 0o600,
    });
    console.log(`Wrote ${app.size} app values from GitHub into ${file}.`);
  } else {
    throw new Error("Usage: sync-env.mjs check|supabase|vercel|build-env");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.log(`::error::${error.message}`);
    process.exit(1);
  });
}
