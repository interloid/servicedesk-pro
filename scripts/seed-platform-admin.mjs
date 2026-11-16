/**
 * Creates the platform console operator with a password you choose, or resets
 * the password of the one that already exists. Separate from seed-tenants.mjs:
 * it touches only this one account.
 *
 *   Preview (default, reads only):
 *     PLATFORM_ADMIN_PASSWORD='...' node --env-file=.env.local \
 *       scripts/seed-platform-admin.mjs
 *
 *   Write:
 *     PLATFORM_ADMIN_PASSWORD='...' node --env-file=.env.local \
 *       scripts/seed-platform-admin.mjs --apply --project-ref <ref> \
 *       [--email admin@example.com] [--name "Platform Admin"]
 *
 * The password comes only from PLATFORM_ADMIN_PASSWORD (never a flag, so it
 * stays out of shell history and process lists) and is never printed.
 *
 * The account belongs to no workspace, so signing in lands on /platform. Its
 * email is confirmed on creation, because requirePlatformAdmin only admits
 * verified addresses. Access itself still comes from PLATFORM_ADMIN_EMAILS:
 * the email must be listed there in the environment the app runs with.
 */
import { createClient } from "@supabase/supabase-js";

const DEFAULT_EMAIL = "platform-admin@servicedesk-pro.com";
const DEFAULT_NAME = "Platform Admin";
const MIN_PASSWORD_LENGTH = 12;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const email = (flag("email") ?? DEFAULT_EMAIL).trim().toLowerCase();
const fullName = (flag("name") ?? DEFAULT_NAME).trim();
const password = process.env.PLATFORM_ADMIN_PASSWORD ?? "";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run with: node --env-file=.env.local scripts/seed-platform-admin.mjs",
  );
  process.exit(1);
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`Not an email address: ${email}`);
  process.exit(1);
}

if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(
    `Set PLATFORM_ADMIN_PASSWORD to the password to use (at least ${MIN_PASSWORD_LENGTH} characters).`,
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const hostname = new URL(url).hostname;
const projectRef = hostname.split(".")[0];
const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

/** Writes must name the project they target, so .env.local can't pick it silently. */
function requireProjectRef() {
  if (isLocal || flag("project-ref") === projectRef) return;

  console.error(
    `Refusing to write: this targets project "${projectRef}".\n` +
      `If that is intended, add --project-ref ${projectRef}`,
  );
  process.exit(1);
}

async function findUser() {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const found = data.users.find((user) => user.email === email);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
}

const listed = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .includes(email);

const existing = await findUser();

console.log(`Project: ${isLocal ? "local" : projectRef}`);
console.log(
  existing
    ? `Platform admin ${email} exists: its password will be reset.`
    : `Platform admin ${email} doesn't exist: it will be created.`,
);

if (!has("apply")) {
  console.log(
    `\nPreview only, nothing was written. To write:\n` +
      `  PLATFORM_ADMIN_PASSWORD='...' node --env-file=.env.local scripts/seed-platform-admin.mjs --apply --project-ref ${projectRef}`,
  );
  process.exit(0);
}

requireProjectRef();

let userId;
if (existing) {
  const { error } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (error) {
    console.error(`Updating ${email} failed: ${error.message}`);
    process.exit(1);
  }
  userId = existing.id;
  console.log(`  ok  password reset for ${email}`);
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) {
    console.error(`Creating ${email} failed: ${error.message}`);
    process.exit(1);
  }
  userId = data.user.id;
  console.log(`  ok  created ${email} (no workspace)`);
}

// Audit rows name their actor through public.users, so the console's own
// writes need the row even though no workspace does.
const { error: profileError } = await supabase
  .from("users")
  .upsert({ id: userId, email, full_name: fullName });
if (profileError) {
  console.error(`users ${email}: ${profileError.message}`);
  process.exit(1);
}

if (!listed) {
  console.log(
    `\nNote: ${email} isn't in PLATFORM_ADMIN_EMAILS here. Add it to that variable in the environment the app runs with, or /platform returns 404.`,
  );
}
