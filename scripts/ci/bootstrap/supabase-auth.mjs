#!/usr/bin/env node
/**
 * Supabase Auth settings for the development project, through the Management
 * API (GET/PATCH /v1/projects/{ref}/config/auth). Run by
 * bootstrap-development.yml.
 *
 *   node scripts/ci/bootstrap/supabase-auth.mjs urls       site URL + redirect URLs
 *   node scripts/ci/bootstrap/supabase-auth.mjs templates  auth email templates
 *   node scripts/ci/bootstrap/supabase-auth.mjs hook       custom access token hook
 *   node scripts/ci/bootstrap/supabase-auth.mjs smtp       custom SMTP sender
 *   node scripts/ci/bootstrap/supabase-auth.mjs google     Google sign-in
 *   node scripts/ci/bootstrap/supabase-auth.mjs verify     all of the above, read back
 *
 * Each command PATCHes only the fields it owns, so the rest of the project's
 * auth settings (other providers, rate limits) stay as they are. URLs,
 * templates and the hook are only written when they differ; SMTP and Google
 * are always written, because their secrets can't be read back to compare.
 * `supabase config push` is not used: it pushes all of config.toml.
 *
 * Inputs (environment): SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF,
 * SUPABASE_SITE_URL (falls back to NEXT_PUBLIC_SITE_URL), SUPABASE_REDIRECT_URLS
 * (comma or newline separated); SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 * SMTP_SENDER_NAME, SMTP_ADMIN_EMAIL (falls back to FROM_EMAIL);
 * SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID, SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET.
 * Secrets never reach the log.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MANAGEMENT_API = "https://api.supabase.com/v1";

export const HOOK_URI =
  "pg-functions://postgres/public/custom_access_token_hook";

/** Template file (supabase/templates/<name>.html) -> Management API field suffix. */
export const TEMPLATES = [
  "confirmation",
  "recovery",
  "magic_link",
  "email_change",
  "invite",
];

export function parseUrlList(value) {
  return (value ?? "")
    .split(/[\n,]/)
    .map((url) => url.trim())
    .filter(Boolean);
}

/** https, or http only for localhost. Globs (`/**`) are allowed in the path. */
export function checkUrl(url) {
  if (!URL.canParse(url)) return `${url} is not a URL`;
  const { protocol, hostname } = new URL(url);
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  if (protocol === "https:" || (protocol === "http:" && local)) return null;
  return `${url} must use https`;
}

/**
 * The PATCH for the URL settings, or null when nothing changes. Existing
 * redirect URLs are kept: the list only grows.
 */
export function planUrls(current, { siteUrl, redirectUrls }) {
  const errors = [siteUrl, ...redirectUrls].map(checkUrl).filter(Boolean);
  if (!siteUrl)
    errors.unshift("SUPABASE_SITE_URL (or NEXT_PUBLIC_SITE_URL) is not set");
  if (errors.length) throw new Error(errors.join("; "));

  const existing = parseUrlList(current.uri_allow_list);
  const added = redirectUrls.filter((url) => !existing.includes(url));
  const patch = {};
  if (current.site_url !== siteUrl) patch.site_url = siteUrl;
  if (added.length) patch.uri_allow_list = [...existing, ...added].join(",");
  return { patch: Object.keys(patch).length ? patch : null, added };
}

export function checkTemplate(name, html) {
  if (!html.includes("{{ .ConfirmationURL }}")) {
    throw new Error(
      `supabase/templates/${name}.html has no {{ .ConfirmationURL }}; the link would be missing from the email.`,
    );
  }
  // Go template syntax: an unbalanced action makes Auth refuse the template.
  const opens = html.split("{{").length;
  const closes = html.split("}}").length;
  if (opens !== closes) {
    throw new Error(`supabase/templates/${name}.html has unbalanced {{ }}.`);
  }
  // A formatter wrapping inside an action ("{{\n .Email }}") is easy to miss.
  if (/\{\{[^}]*\n[^}]*\}\}/.test(html)) {
    throw new Error(
      `supabase/templates/${name}.html has a {{ }} action split across lines.`,
    );
  }
}

export function loadTemplates(dir) {
  const subjects = JSON.parse(readFileSync(join(dir, "subjects.json"), "utf8"));
  return TEMPLATES.map((name) => {
    const content = readFileSync(join(dir, `${name}.html`), "utf8");
    checkTemplate(name, content);
    if (!subjects[name]) {
      throw new Error(
        `supabase/templates/subjects.json has no '${name}' subject.`,
      );
    }
    return { name, subject: subjects[name], content };
  });
}

/** The PATCH for the templates (only fields that differ), or null. */
export function planTemplates(current, templates) {
  const patch = {};
  const changed = [];
  for (const { name, subject, content } of templates) {
    const subjectKey = `mailer_subjects_${name}`;
    const contentKey = `mailer_templates_${name}_content`;
    let differs = false;
    if (current[subjectKey] !== subject) {
      patch[subjectKey] = subject;
      differs = true;
    }
    if (current[contentKey] !== content) {
      patch[contentKey] = content;
      differs = true;
    }
    if (differs) changed.push(name);
  }
  return { patch: changed.length ? patch : null, changed };
}

/**
 * The PATCH that turns the hook on, or null when it already is. A hook that is
 * on and points somewhere else is not overwritten: that is someone's
 * deliberate configuration, and replacing it would change every token's claims.
 */
export function planHook(current) {
  const enabled = current.hook_custom_access_token_enabled === true;
  const uri = current.hook_custom_access_token_uri || "";
  if (enabled && uri === HOOK_URI) return null;
  if (enabled && uri !== HOOK_URI) {
    throw new Error(
      `The custom access token hook is already enabled with ${uri}, not ${HOOK_URI}. Not changed; disable it in the dashboard first if it should be replaced.`,
    );
  }
  return {
    hook_custom_access_token_enabled: true,
    hook_custom_access_token_uri: HOOK_URI,
  };
}

/** Everything the bootstrap configured, checked against a fresh read. */
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/**
 * Splits a From header value -- `Name<addr>`, `Name <addr>`,
 * `"Name" <addr>` or a bare `addr` -- into its display name and address.
 */
export function parseFromEmail(value) {
  const text = (value ?? "").trim();
  const match = text.match(/^(.*?)\s*<\s*([^<>\s]+)\s*>$/);
  if (!match) return { name: "", address: text };
  const name = match[1]
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .trim();
  return { name, address: match[2] };
}

/**
 * The PATCH for custom SMTP. The password can't be read back to compare, so
 * the whole block is always written from GitHub, the source of truth; a
 * rotated password reaches Auth on the next run. `drift` lists the readable
 * fields that differed, for the log.
 */
export function planSmtp(current, smtp) {
  const errors = [];
  for (const [key, label] of [
    ["host", "SMTP_HOST"],
    ["port", "SMTP_PORT"],
    ["user", "SMTP_USER"],
    ["pass", "SMTP_PASS"],
    ["adminEmail", "SMTP_ADMIN_EMAIL (or FROM_EMAIL)"],
    [
      "senderName",
      "SMTP_SENDER_NAME (or a name in FROM_EMAIL, or NEXT_PUBLIC_SITE_NAME)",
    ],
  ]) {
    if (!smtp[key]) errors.push(`${label} is not set`);
  }
  if (smtp.host && /[:/\s]/.test(smtp.host)) {
    errors.push("SMTP_HOST must be a bare host name, like smtp.example.com");
  }
  const port = Number(smtp.port);
  if (smtp.port && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    errors.push(`SMTP_PORT ${smtp.port} is not a port`);
  } else if (port === 25) {
    errors.push("SMTP_PORT 25 is blocked by most providers; use 465 or 587");
  }
  if (smtp.adminEmail && !EMAIL.test(smtp.adminEmail)) {
    errors.push(`${smtp.adminEmail} is not an email address`);
  }
  if (errors.length) throw new Error(errors.join("; "));

  const patch = {
    external_email_enabled: true,
    smtp_host: smtp.host,
    smtp_port: String(port),
    smtp_user: smtp.user,
    smtp_pass: smtp.pass,
    smtp_admin_email: smtp.adminEmail,
    smtp_sender_name: smtp.senderName,
  };
  const drift = Object.keys(patch).filter(
    (key) =>
      key !== "smtp_pass" && String(current[key] ?? "") !== String(patch[key]),
  );
  return { patch, drift };
}

/**
 * The PATCH that enables Google sign-in. Same as SMTP: the secret can't be
 * compared, so it is always written. The nonce check stays on in a hosted
 * project (config.toml turns it off for the local Auth container only).
 */
export function planGoogle(current, google) {
  const errors = [];
  if (!google.clientId) {
    errors.push("SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID is not set");
  } else if (!google.clientId.endsWith(".apps.googleusercontent.com")) {
    errors.push(
      "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID must be a Google OAuth web client id (…apps.googleusercontent.com)",
    );
  }
  if (!google.secret)
    errors.push("SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET is not set");
  if (errors.length) throw new Error(errors.join("; "));

  const patch = {
    external_google_enabled: true,
    external_google_client_id: google.clientId,
    external_google_secret: google.secret,
    external_google_skip_nonce_check: false,
  };
  const drift = Object.keys(patch).filter(
    (key) => key !== "external_google_secret" && current[key] !== patch[key],
  );
  return { patch, drift };
}

/** The OAuth redirect URI to register on the Google client. */
export function googleCallbackUrl(projectRef) {
  return `https://${projectRef}.supabase.co/auth/v1/callback`;
}

export function verifyConfig(
  current,
  { siteUrl, redirectUrls, templates, smtp, google },
) {
  const errors = [];
  if (smtp) {
    const { drift } = planSmtp(current, smtp);
    for (const key of drift) errors.push(`${key} differs`);
  }
  if (google) {
    const { drift } = planGoogle(current, google);
    for (const key of drift) errors.push(`${key} differs`);
  }
  if (current.site_url !== siteUrl)
    errors.push(`site_url is ${current.site_url}`);
  const allow = parseUrlList(current.uri_allow_list);
  for (const url of redirectUrls) {
    if (!allow.includes(url)) errors.push(`redirect URL ${url} is missing`);
  }
  if (planHook(current) !== null)
    errors.push("the access token hook is not enabled");
  const { changed } = planTemplates(current, templates);
  for (const name of changed)
    errors.push(`the ${name} template differs from supabase/templates`);
  return errors;
}

export function sha(text) {
  return createHash("sha256")
    .update(text ?? "")
    .digest("hex")
    .slice(0, 12);
}

export function createApi({ token, projectRef, fetchImpl = fetch }) {
  const path = `${MANAGEMENT_API}/projects/${projectRef}/config/auth`;
  async function request(method, body) {
    const response = await fetchImpl(path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        `Management API ${method} config/auth failed: HTTP ${response.status}${data.message ? ` (${data.message})` : ""}`,
      );
    }
    return data;
  }
  return {
    get: () => request("GET"),
    patch: (body) => request("PATCH", body),
  };
}

function settings() {
  return {
    siteUrl: (
      process.env.SUPABASE_SITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      ""
    ).trim(),
    redirectUrls: parseUrlList(process.env.SUPABASE_REDIRECT_URLS),
  };
}

export function smtpSettings(source = process.env) {
  const env = (name) => (source[name] ?? "").trim();
  // The Edge Functions' sender doubles as the auth sender unless overridden.
  const from = parseFromEmail(env("FROM_EMAIL"));
  return {
    host: env("SMTP_HOST"),
    port: env("SMTP_PORT"),
    user: env("SMTP_USER"),
    pass: source.SMTP_PASS ?? "",
    adminEmail: parseFromEmail(env("SMTP_ADMIN_EMAIL")).address || from.address,
    senderName:
      env("SMTP_SENDER_NAME") || from.name || env("NEXT_PUBLIC_SITE_NAME"),
  };
}

function googleSettings() {
  return {
    clientId: (
      process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID ?? ""
    ).trim(),
    secret: process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET ?? "",
  };
}

async function main() {
  const command = process.argv[2];
  const token = process.env.SUPABASE_ACCESS_TOKEN ?? "";
  const projectRef = process.env.SUPABASE_PROJECT_REF ?? "";
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is not set.");
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error("SUPABASE_PROJECT_REF is missing or malformed.");
  }
  const api = createApi({ token, projectRef });
  const templatesDir = join(process.cwd(), "supabase", "templates");

  if (command === "urls") {
    const { siteUrl, redirectUrls } = settings();
    const { patch, added } = planUrls(await api.get(), {
      siteUrl,
      redirectUrls,
    });
    if (!patch) {
      console.log("Site URL and redirect URLs already set; nothing changed.");
      return;
    }
    await api.patch(patch);
    if (patch.site_url) console.log(`  set     site_url = ${siteUrl}`);
    for (const url of added) console.log(`  add     redirect ${url}`);
  } else if (command === "templates") {
    const templates = loadTemplates(templatesDir);
    const { patch, changed } = planTemplates(await api.get(), templates);
    if (!patch) {
      console.log(
        "Email templates already match supabase/templates; nothing changed.",
      );
      return;
    }
    await api.patch(patch);
    for (const { name, content } of templates.filter((t) =>
      changed.includes(t.name),
    )) {
      console.log(`  update  ${name} template (sha256 ${sha(content)})`);
    }
  } else if (command === "hook") {
    const patch = planHook(await api.get());
    if (patch) {
      await api.patch(patch);
      console.log(`  enable  custom access token hook -> ${HOOK_URI}`);
    } else {
      console.log("Custom access token hook already enabled; nothing changed.");
    }
    if (planHook(await api.get()) !== null) {
      throw new Error("The hook still reads as disabled after the update.");
    }
  } else if (command === "smtp") {
    const smtp = smtpSettings();
    const { patch, drift } = planSmtp(await api.get(), smtp);
    if (/(^|\.)gmail\.com$|(^|\.)googlemail\.com$/.test(smtp.host)) {
      console.log(
        "::warning::Gmail SMTP is meant for personal mail: it needs an app password and caps daily sends. Fine for development; use a transactional provider for production.",
      );
    }
    await api.patch(patch);
    console.log(
      drift.length
        ? `  set     SMTP ${smtp.host}:${patch.smtp_port} as ${smtp.senderName} <${smtp.adminEmail}> (changed: ${drift.join(", ")})`
        : `  ok      SMTP ${smtp.host}:${patch.smtp_port}; password re-applied from GitHub`,
    );
  } else if (command === "google") {
    const { patch, drift } = planGoogle(await api.get(), googleSettings());
    await api.patch(patch);
    console.log(
      drift.length
        ? `  enable  Google sign-in (changed: ${drift.join(", ")})`
        : "  ok      Google sign-in enabled; secret re-applied from GitHub",
    );
    console.log(
      `  The Google OAuth client must list this authorized redirect URI: ${googleCallbackUrl(projectRef)}`,
    );
  } else if (command === "verify") {
    const errors = verifyConfig(await api.get(), {
      ...settings(),
      templates: loadTemplates(templatesDir),
      smtp: smtpSettings(),
      google: googleSettings(),
    });
    if (errors.length)
      throw new Error(`Auth settings check failed: ${errors.join("; ")}`);
    console.log(
      "Auth settings verified: site URL, redirect URLs, templates, hook, SMTP, Google sign-in.",
    );
  } else {
    throw new Error(
      "Usage: supabase-auth.mjs urls|templates|hook|smtp|google|verify",
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.log(`::error::${error.message}`);
    process.exit(1);
  });
}
