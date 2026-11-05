import { expect, test } from "@playwright/test";

test("the app under test uses the local database, not a hosted one", async ({
  request,
}) => {
  const response = await request.get("/login");
  const policy = response.headers()["content-security-policy"] ?? "";

  expect(policy).toContain("http://127.0.0.1:55321");
  expect(policy).not.toContain(".supabase.co");
});

test("home page leads to sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/help desk/i);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page
    .getByRole("banner")
    .getByRole("link", { name: /log in|sign in/i })
    .click();
  await expect(page).toHaveURL(/\/login$/);
});

test("responses carry the security headers", async ({ request }) => {
  const headers = (await request.get("/")).headers();

  expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["content-security-policy"]).toContain("form-action 'self'");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("robots and sitemap are served", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("Disallow: /api/");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain("<urlset");
});

test("an unknown path is treated as a workspace and asks for sign in", async ({
  page,
}) => {
  await page.goto("/this/page/does/not/exist");

  await expect(
    page.getByRole("heading", { name: "Sign in to your workspace" }),
  ).toBeVisible();
});
