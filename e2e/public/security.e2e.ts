import { expect, test } from "@playwright/test";

function scriptSrc(policy: string | undefined): string {
  return (
    policy?.split("; ").find((part) => part.startsWith("script-src ")) ?? ""
  );
}

test.describe("content security policy", () => {
  for (const path of ["/", "/login", "/setup", "/forgot-password"]) {
    test(`${path} runs only scripts carrying this response's nonce`, async ({
      request,
    }) => {
      const response = await request.get(path);
      const policy = scriptSrc(response.headers()["content-security-policy"]);
      const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];

      expect(policy).toContain("'strict-dynamic'");
      expect(policy).not.toContain("'unsafe-inline'");
      expect(nonce).toBeTruthy();

      const scripts = (await response.text()).match(/<script\b[^>]*>/g) ?? [];

      expect(scripts.length).toBeGreaterThan(0);
      for (const tag of scripts) {
        if (tag.includes('type="application/ld+json"')) continue;
        expect(tag).toContain(`nonce="${nonce}"`);
      }
    });
  }

  test("each response gets a new nonce", async ({ request }) => {
    const policies = await Promise.all(
      [1, 2].map(async () =>
        scriptSrc(
          (await request.get("/login")).headers()["content-security-policy"],
        ),
      ),
    );

    expect(policies[0]).not.toBe(policies[1]);
  });

  test("an unknown page still gets a nonce", async ({ request }) => {
    const response = await request.get("/sign-in/does/not/exist", {
      maxRedirects: 5,
    });
    const nonce = /'nonce-([^']+)'/.exec(
      response.headers()["content-security-policy"] ?? "",
    )?.[1];

    expect(await response.text()).toContain(`nonce="${nonce}"`);
  });

  test("the browser blocks injected markup and nothing of ours", async ({
    page,
  }) => {
    const violations: string[] = [];

    page.on("console", (message) => {
      if (message.text().includes("Content Security Policy")) {
        violations.push(message.text());
      }
    });

    await page.goto("/login", { waitUntil: "networkidle" });
    expect(violations).toEqual([]);

    // What a stored or reflected XSS would put in the page, under the real header.
    await page.route("**/login", async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        "</body>",
        `<script>window.__script = 1</script>
         <img src="/missing.png" onerror="window.__handler = 1"></body>`,
      );

      await route.fulfill({ response, body });
    });
    await page.goto("/login", { waitUntil: "networkidle" });

    expect(await page.evaluate(() => "__script" in window)).toBe(false);
    expect(await page.evaluate(() => "__handler" in window)).toBe(false);
    expect(violations).toHaveLength(2);

    // The app's own scripts still ran: the form hydrated and reacts.
    await expect(page.getByLabel("Email")).toBeEditable();
  });

  test("static files carry a policy of their own", async ({ request }) => {
    const policy = (await request.get("/robots.txt")).headers()[
      "content-security-policy"
    ];

    expect(policy).toContain("default-src 'none'");
    expect(policy).not.toContain("nonce");
  });
});

test.describe("cross-origin access", () => {
  test("static files name this origin, pages name none", async ({
    request,
    baseURL,
  }) => {
    const robots = await request.get("/robots.txt");

    expect(robots.headers()["access-control-allow-origin"]).toBe(baseURL);

    const html = await (await request.get("/login")).text();
    const chunk = /<script\b[^>]*\bsrc="(\/_next\/static\/[^"]+)"/.exec(html)?.[1];
    const asset = await request.get(chunk ?? "");

    expect(asset.ok()).toBe(true);
    expect(asset.headers()["access-control-allow-origin"]).toBe(baseURL);
    expect(asset.headers()["content-security-policy"]).toContain(
      "default-src 'none'",
    );

    for (const path of ["/", "/login"]) {
      const page = await request.get(path);

      expect(page.headers()["access-control-allow-origin"]).toBeUndefined();
    }
  });
});

test.describe("cross-site requests", () => {
  // No action with this id exists. Next.js turns a foreign origin away with a 500
  // before looking it up, so the same-site request is the control.
  const action = { "next-action": "0".repeat(42) };

  test("a server action from another site is refused", async ({
    request,
    baseURL,
  }) => {
    const host = new URL(baseURL ?? "").host;

    const foreign = await request.post("/forgot-password", {
      headers: { ...action, origin: "https://evil.example", host },
      data: "[]",
    });
    const sameSite = await request.post("/forgot-password", {
      headers: { ...action, origin: baseURL ?? "", host },
      data: "[]",
    });

    expect(foreign.status()).toBe(500);
    expect(sameSite.status()).not.toBe(500);
  });
});

test.describe("caching", () => {
  for (const path of ["/", "/login", "/setup"]) {
    test(`${path} may not be stored`, async ({ request }) => {
      const header = (await request.get(path)).headers()["cache-control"];

      expect(header).toContain("no-store");
      expect(header).not.toContain("public");
    });
  }
});

test.describe("redirects", () => {
  test("the platform console sends a signed-out visitor away with no page", async ({
    request,
  }) => {
    const response = await request.get("/platform", { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("/login");
    expect((await response.body()).length).toBeLessThan(1000);
  });
});

test("the remember parameter is not reflected into the page", async ({
  request,
}) => {
  const html = await (await request.get("/login?remember=zapprobe")).text();

  expect(html).not.toMatch(/<[^>]+value="zapprobe"/);
});
