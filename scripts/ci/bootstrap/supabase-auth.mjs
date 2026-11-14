#!/usr/bin/env node
/**
 * Supabase Auth settings for a hosted project, applied on every deploy
 * (deploy.yml) and checked by bootstrap-development.yml, through the
 * Management API (GET/PATCH /v1/projects/{ref}/config/auth).
 *
 *   node scripts/ci/bootstrap/supabase-auth.mjs apply    write what differs
 *   node scripts/ci/bootstrap/supabase-auth.mjs verify   read back and check
 *
 * supabase/config.toml is the source of truth for what is switched on:
 *   [auth.hook.custom_access_token]   enabled, uri
 *   [auth.external.google]            enabled
 *   [auth.email.template.<name>]      subject, content_path
 * The per-environment values come from the GitHub environment:
 *   site URL       SUPABASE_SITE_URL (falls back to NEXT_PUBLIC_SITE_URL)
 *   redirect URLs  SUPABASE_REDIRECT_URLS (comma or newline separated; added,
 *                  never removed)
 *   Google         SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID / _SECRET
 *   SMTP           SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and optionally
 *                  SMTP_SENDER_NAME / SMTP_ADMIN_EMAIL (default: FROM_EMAIL).
 *                  Applied only when SMTP_HOST is set; without it the
 *                  project keeps Supabase's built-in sender.
 *
 * Only these fields are written, so other auth settings stay as they are.
 * `supabase config push` is not used: it would push all of config.toml,
 * including the local-only site URL, redirect list and Google nonce setting.
 * The hosted project always keeps Google's nonce check on.
 *
 * Secrets never reach the log.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MANAGEMENT_API = "https://api.supabase.com/v1";

export const HOOK_URI =
  "pg-functions://postgres/public/custom_access_token_hook";

/** Templates the Management API accepts, by config.toml section name. */
export const TEMPLATES = [
  "confirmation",
  "recovery",
  "magic_link",
  "email_change",
  "invite",
];

/**
 * Just enough TOML for supabase/config.toml: [section] headers and
 * `key = value` lines whose value is a string, boolean or number. Arrays and
 * inline tables are skipped (multi-line arrays included), comments dropped.
 * Returns { "section.name": { key: value } }.
 */
export function parseToml(text) {
  const sections = {};
  let current = (sections[""] = {});
  let skippingArray = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (skippingArray) {
      if (line.startsWith("]")) skippingArray = false;
      continue;
    }
    if (!line || line.startsWith("#")) continue;
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) {
      current = sections[header[1].trim()] ??= {};
      continue;
    }
    const pair = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.*)$/);
    if (!pair) continue;
    const [, key, rest] = pair;
    if (rest.startsWith("[")) {
      if (!rest.includes("]")) skippingArray = true;
      continue;
    }
    const string = rest.match(/^"((?:[^"\\]|\\.)*)"/);
    if (string) {
      current[key] = string[1].replace(/\\(["\\])/g, "$1");
    } else if (/^(true|false)\b/.test(rest)) {
      current[key] = rest.startsWith("true");
    } else if (/^-?\d+(\.\d+)?\b/.test(rest)) {
      current[key] = Number(rest.match(/^-?\d+(\.\d+)?/)[0]);
    }
  }
  return sections;
}

/** The auth settings config.toml asks for. `root` is the repository root. */
export function readAuthConfig(root) {
  const config = parseToml(
    readFileSync(join(root, "supabase", "config.toml"), "utf8"),
  );
  const hook = config["auth.hook.custom_access_token"] ?? {};
  return {
    hook: { enabled: hook.enabled === true, uri: hook.uri ?? HOOK_URI },
    google: { enabled: config["auth.external.google"]?.enabled === true },
    templates: loadTemplates(root, config),
  };
}

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

/**
 * Every [auth.email.template.<name>] in config.toml, with its file read and
 * checked. content_path is relative to the repository root, as the CLI
 * reads it.
 */
export function loadTemplates(root, config) {
  const prefix = "auth.email.template.";
  return Object.entries(config)
    .filter(([section]) => section.startsWith(prefix))
    .map(([section, values]) => {
      const name = section.slice(prefix.length);
      if (!TEMPLATES.includes(name)) {
        throw new Error(
          `config.toml [${section}]: '${name}' is not a template Supabase Auth sends.`,
        );
      }
      if (!values.subject || !values.content_path) {
        throw new Error(
          `config.toml [${section}] needs both subject and content_path.`,
        );
      }
      const content = readFileSync(join(root, values.content_path), "utf8");
      checkTemplate(name, content);
      return { name, subject: values.subject, content };
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
export function planHook(current, wanted = HOOK_URI) {
  const enabled = current.hook_custom_access_token_enabled === true;
  const uri = current.hook_custom_access_token_uri || "";
  if (enabled && uri === wanted) return null;
  if (enabled && uri !== wanted) {
    throw new Error(
      `The custom access token hook is already enabled with ${uri}, not ${wanted}. Not changed; disable it in the dashboard first if it should be replaced.`,
    );
  }
  return {
    hook_custom_access_token_enabled: true,
    hook_custom_access_token_uri: wanted,
  };
}

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

/** Everything `apply` writes, checked against a fresh read. */
export function verifyConfig(
  current,
  { siteUrl, redirectUrls, templates, smtp, google, hook },
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
  if (hook?.enabled) {
    try {
      if (planHook(current, hook.uri) !== null)
        errors.push("the access token hook is not enabled");
    } catch (error) {
      errors.push(error.message);
    }
  }
  const { changed } = planTemplates(current, templates);
  for (const name of changed)
    errors.push(`the ${name} template differs from supabase/templates`);
  return errors;
}

/**
 * One PATCH for everything config.toml and the environment ask for, plus a
 * line per change for the log. SMTP and Google are always included when
 * they apply, because their secrets can't be read back to compare.
 */
export function planAuth(current, wanted) {
  const patch = {};
  const log = [];
  const warnings = [];

  const urls = planUrls(current, wanted);
  if (urls.patch) Object.assign(patch, urls.patch);
  if (urls.patch?.site_url) log.push(`set     site_url = ${wanted.siteUrl}`);
  for (const url of urls.added) log.push(`add     redirect ${url}`);

  const templates = planTemplates(current, wanted.templates);
  if (templates.patch) Object.assign(patch, templates.patch);
  for (const t of wanted.templates.filter((t) =>
    templates.changed.includes(t.name),
  )) {
    log.push(`update  ${t.name} template (sha256 ${sha(t.content)})`);
  }

  if (wanted.hook.enabled) {
    const hook = planHook(current, wanted.hook.uri);
    if (hook) {
      Object.assign(patch, hook);
      log.push(`enable  custom access token hook -> ${wanted.hook.uri}`);
    }
  }

  if (wanted.smtp) {
    const smtp = planSmtp(current, wanted.smtp);
    Object.assign(patch, smtp.patch);
    log.push(
      smtp.drift.length
        ? `set     SMTP ${wanted.smtp.host}:${smtp.patch.smtp_port} as ${wanted.smtp.senderName} <${wanted.smtp.adminEmail}>`
        : `ok      SMTP ${wanted.smtp.host}:${smtp.patch.smtp_port} (password re-applied)`,
    );
    if (/(^|\.)(gmail|googlemail)\.com$/.test(wanted.smtp.host)) {
      warnings.push(
        "Gmail SMTP is meant for personal mail: it needs an app password and caps daily sends. Fine for development; use a transactional provider for production.",
      );
    }
  } else {
    warnings.push(
      "SMTP_HOST is not set, so auth emails use Supabase's built-in sender (a few per hour, team members only).",
    );
  }

  if (wanted.google) {
    const google = planGoogle(current, wanted.google);
    Object.assign(patch, google.patch);
    log.push(
      google.drift.length
        ? "enable  Google sign-in"
        : "ok      Google sign-in (secret re-applied)",
    );
  }

  return { patch: Object.keys(patch).length ? patch : null, log, warnings };
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

/** What to apply: config.toml for what is on, the environment for values. */
export function wantedAuth(root, env = process.env) {
  const config = readAuthConfig(root);
  const trim = (name) => (env[name] ?? "").trim();
  const smtp = trim("SMTP_HOST") ? smtpSettings(env) : null;
  return {
    siteUrl: trim("SUPABASE_SITE_URL") || trim("NEXT_PUBLIC_SITE_URL"),
    redirectUrls: parseUrlList(env.SUPABASE_REDIRECT_URLS),
    templates: config.templates,
    hook: config.hook,
    smtp,
    google: config.google.enabled
      ? {
          clientId: trim("SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID"),
          secret: env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET ?? "",
        }
      : null,
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

async function main() {
  const command = process.argv[2];
  const token = process.env.SUPABASE_ACCESS_TOKEN ?? "";
  const projectRef = process.env.SUPABASE_PROJECT_REF ?? "";
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is not set.");
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error("SUPABASE_PROJECT_REF is missing or malformed.");
  }
  const api = createApi({ token, projectRef });
  const wanted = wantedAuth(process.cwd());

  if (command === "apply") {
    const { patch, log, warnings } = planAuth(await api.get(), wanted);
    for (const warning of warnings) console.log(`::warning::${warning}`);
    if (patch) await api.patch(patch);
    for (const line of log) console.log(`  ${line}`);
    if (!log.length)
      console.log("Auth settings already match; nothing changed.");
    if (wanted.google) {
      console.log(
        `  Google OAuth client must list this authorized redirect URI: ${googleCallbackUrl(projectRef)}`,
      );
    }
    await check(api, wanted);
  } else if (command === "verify") {
    await check(api, wanted);
  } else {
    throw new Error("Usage: supabase-auth.mjs apply|verify");
  }
}

async function check(api, wanted) {
  const errors = verifyConfig(await api.get(), wanted);
  if (errors.length) {
    throw new Error(`Auth settings check failed: ${errors.join("; ")}`);
  }
  const on = [
    "site URL",
    "redirect URLs",
    "templates",
    wanted.hook.enabled && "access token hook",
    wanted.smtp && "SMTP",
    wanted.google && "Google sign-in",
  ].filter(Boolean);
  console.log(`Auth settings verified: ${on.join(", ")}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.log(`::error::${error.message}`);
    process.exit(1);
  });
}
