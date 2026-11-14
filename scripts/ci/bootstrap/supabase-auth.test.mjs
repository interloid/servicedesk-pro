import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  HOOK_URI,
  checkTemplate,
  createApi,
  googleCallbackUrl,
  loadTemplates,
  parseFromEmail,
  parseUrlList,
  planGoogle,
  planHook,
  planSmtp,
  planTemplates,
  planUrls,
  smtpSettings,
  verifyConfig,
} from "./supabase-auth.mjs";

const TEMPLATES_DIR = join(process.cwd(), "supabase", "templates");

describe("parseUrlList", () => {
  it("splits on commas and newlines and drops blanks", () => {
    expect(
      parseUrlList(
        "https://a.dev/**, https://b.dev\n\n http://localhost:3000/** ",
      ),
    ).toEqual([
      "https://a.dev/**",
      "https://b.dev",
      "http://localhost:3000/**",
    ]);
    expect(parseUrlList(undefined)).toEqual([]);
  });
});

describe("planUrls", () => {
  const current = {
    site_url: "http://localhost:3000",
    uri_allow_list: "https://old.example.com/**",
  };

  it("sets the site URL and adds new redirect URLs, keeping existing ones", () => {
    const { patch, added } = planUrls(current, {
      siteUrl: "https://dev.example.com",
      redirectUrls: [
        "https://dev.example.com/**",
        "https://old.example.com/**",
      ],
    });
    expect(added).toEqual(["https://dev.example.com/**"]);
    expect(patch).toEqual({
      site_url: "https://dev.example.com",
      uri_allow_list: "https://old.example.com/**,https://dev.example.com/**",
    });
  });

  it("returns no patch when everything already matches", () => {
    const { patch } = planUrls(
      {
        site_url: "https://dev.example.com",
        uri_allow_list: "https://dev.example.com/**",
      },
      {
        siteUrl: "https://dev.example.com",
        redirectUrls: ["https://dev.example.com/**"],
      },
    );
    expect(patch).toBeNull();
  });

  it("refuses plain http outside localhost, and a missing site URL", () => {
    expect(() =>
      planUrls(current, {
        siteUrl: "http://dev.example.com",
        redirectUrls: [],
      }),
    ).toThrow(/must use https/);
    expect(() => planUrls(current, { siteUrl: "", redirectUrls: [] })).toThrow(
      /SUPABASE_SITE_URL/,
    );
  });
});

describe("templates", () => {
  const templates = loadTemplates(TEMPLATES_DIR);

  it("loads every template with its subject and the confirmation link", () => {
    expect(templates.map((t) => t.name)).toEqual([
      "confirmation",
      "recovery",
      "magic_link",
      "email_change",
      "invite",
    ]);
    for (const t of templates) {
      expect(t.subject).toBeTruthy();
      expect(t.content).toContain("{{ .ConfirmationURL }}");
    }
  });

  it("rejects a template without the link or with broken template syntax", () => {
    expect(() => checkTemplate("recovery", "<p>hi</p>")).toThrow(
      /ConfirmationURL/,
    );
    expect(() =>
      checkTemplate("recovery", "{{ .ConfirmationURL }} {{ .Email"),
    ).toThrow(/unbalanced/);
    expect(() =>
      checkTemplate("recovery", "{{ .ConfirmationURL }} {{\n .Email }}"),
    ).toThrow(/split across lines/);
  });

  it("patches only the templates that differ", () => {
    const current = {};
    for (const t of templates) {
      current[`mailer_subjects_${t.name}`] = t.subject;
      current[`mailer_templates_${t.name}_content`] = t.content;
    }
    expect(planTemplates(current, templates).patch).toBeNull();

    current.mailer_templates_recovery_content = "old";
    const { patch, changed } = planTemplates(current, templates);
    expect(changed).toEqual(["recovery"]);
    expect(Object.keys(patch)).toEqual(["mailer_templates_recovery_content"]);
  });
});

describe("planHook", () => {
  it("enables a disabled hook", () => {
    expect(planHook({ hook_custom_access_token_enabled: false })).toEqual({
      hook_custom_access_token_enabled: true,
      hook_custom_access_token_uri: HOOK_URI,
    });
  });

  it("leaves an already enabled hook alone", () => {
    expect(
      planHook({
        hook_custom_access_token_enabled: true,
        hook_custom_access_token_uri: HOOK_URI,
      }),
    ).toBeNull();
  });

  it("refuses to replace a hook that points at another function", () => {
    expect(() =>
      planHook({
        hook_custom_access_token_enabled: true,
        hook_custom_access_token_uri:
          "pg-functions://postgres/public/other_hook",
      }),
    ).toThrow(/already enabled/);
  });
});

const SMTP = {
  host: "smtp.example.com",
  port: "587",
  user: "mailer",
  pass: "s3cret",
  adminEmail: "no-reply@example.com",
  senderName: "ServiceDesk Pro",
};

describe("planSmtp", () => {
  it("writes the full SMTP block, password included", () => {
    const { patch, drift } = planSmtp({}, SMTP);
    expect(patch).toEqual({
      external_email_enabled: true,
      smtp_host: "smtp.example.com",
      smtp_port: "587",
      smtp_user: "mailer",
      smtp_pass: "s3cret",
      smtp_admin_email: "no-reply@example.com",
      smtp_sender_name: "ServiceDesk Pro",
    });
    expect(drift).not.toContain("smtp_pass");
    expect(drift).toContain("smtp_host");
  });

  it("reports no drift when the readable fields already match", () => {
    const { patch } = planSmtp({}, SMTP);
    const current = { ...patch, smtp_pass: undefined, smtp_port: 587 };
    expect(planSmtp(current, SMTP).drift).toEqual([]);
  });

  it("lists every missing or bad value", () => {
    expect(() => planSmtp({}, { ...SMTP, pass: "", senderName: "" })).toThrow(
      /SMTP_PASS is not set; SMTP_SENDER_NAME \(or/,
    );
    expect(() => planSmtp({}, { ...SMTP, port: "25" })).toThrow(/465 or 587/);
    expect(() => planSmtp({}, { ...SMTP, host: "smtp://x" })).toThrow(
      /bare host/,
    );
    expect(() => planSmtp({}, { ...SMTP, adminEmail: "nope" })).toThrow(
      /not an email/,
    );
  });
});

describe("parseFromEmail / smtpSettings", () => {
  it("splits every From form", () => {
    expect(parseFromEmail("Servicedesk<servicedeskpro26@gmail.com>")).toEqual({
      name: "Servicedesk",
      address: "servicedeskpro26@gmail.com",
    });
    expect(parseFromEmail("ServiceDesk Pro <a@b.co>")).toEqual({
      name: "ServiceDesk Pro",
      address: "a@b.co",
    });
    expect(parseFromEmail('"ServiceDesk, Inc" <a@b.co>')).toEqual({
      name: "ServiceDesk, Inc",
      address: "a@b.co",
    });
    expect(parseFromEmail("a@b.co")).toEqual({ name: "", address: "a@b.co" });
  });

  it("takes the sender from FROM_EMAIL unless overridden", () => {
    const base = {
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "587",
      SMTP_USER: "servicedeskpro26@gmail.com",
      SMTP_PASS: "app-password",
      FROM_EMAIL: "Servicedesk<servicedeskpro26@gmail.com>",
      NEXT_PUBLIC_SITE_NAME: "ServiceDesk Pro",
    };
    const { patch } = planSmtp({}, smtpSettings(base));
    expect(patch.smtp_admin_email).toBe("servicedeskpro26@gmail.com");
    expect(patch.smtp_sender_name).toBe("Servicedesk");

    const overridden = smtpSettings({
      ...base,
      SMTP_ADMIN_EMAIL: "no-reply@example.com",
      SMTP_SENDER_NAME: "Support",
    });
    expect(overridden).toMatchObject({
      adminEmail: "no-reply@example.com",
      senderName: "Support",
    });

    expect(
      smtpSettings({ ...base, FROM_EMAIL: "servicedeskpro26@gmail.com" })
        .senderName,
    ).toBe("ServiceDesk Pro");
  });

  it("rejects a From header passed as the address", () => {
    expect(() =>
      planSmtp({}, { ...SMTP, adminEmail: "Servicedesk<a@b.co>" }),
    ).toThrow(/not an email/);
  });
});

describe("planGoogle", () => {
  const google = {
    clientId: "123-abc.apps.googleusercontent.com",
    secret: "GOCSPX-secret",
  };

  it("enables Google with the nonce check on", () => {
    const { patch } = planGoogle({}, google);
    expect(patch).toEqual({
      external_google_enabled: true,
      external_google_client_id: google.clientId,
      external_google_secret: google.secret,
      external_google_skip_nonce_check: false,
    });
  });

  it("reports drift on readable fields only", () => {
    const current = {
      external_google_enabled: true,
      external_google_client_id: google.clientId,
      external_google_skip_nonce_check: false,
    };
    expect(planGoogle(current, google).drift).toEqual([]);
    expect(
      planGoogle({ ...current, external_google_enabled: false }, google).drift,
    ).toEqual(["external_google_enabled"]);
  });

  it("refuses a missing secret or a non-Google client id", () => {
    expect(() => planGoogle({}, { ...google, secret: "" })).toThrow(
      /GOOGLE_SECRET is not set/,
    );
    expect(() => planGoogle({}, { ...google, clientId: "abc" })).toThrow(
      /apps.googleusercontent.com/,
    );
  });

  it("names the callback URL to register with Google", () => {
    expect(googleCallbackUrl("abcdefghijklmnopqrst")).toBe(
      "https://abcdefghijklmnopqrst.supabase.co/auth/v1/callback",
    );
  });
});

describe("verifyConfig", () => {
  it("lists everything that doesn't match", () => {
    const errors = verifyConfig(
      {
        site_url: "https://x.dev",
        uri_allow_list: "",
        hook_custom_access_token_enabled: false,
      },
      {
        siteUrl: "https://dev.example.com",
        redirectUrls: ["https://dev.example.com/**"],
        templates: [{ name: "recovery", subject: "s", content: "c" }],
      },
    );
    expect(errors).toHaveLength(4);
  });
});

describe("createApi", () => {
  it("sends the token and reports failures without the body", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthorized" }),
    }));
    const api = createApi({
      token: "sbp_secret",
      projectRef: "abcdefghijklmnopqrst",
      fetchImpl,
    });
    await expect(api.get()).rejects.toThrow("HTTP 401 (Unauthorized)");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      "https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/config/auth",
    );
    expect(init.headers.Authorization).toBe("Bearer sbp_secret");
  });
});
