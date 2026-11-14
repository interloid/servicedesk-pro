import { NextRequest } from "next/server";
import {
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// What supabase.auth.getUser() answers in each test.
const auth = vi.hoisted(() => ({
  getUser: undefined as unknown as () => Promise<unknown>,
}));

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_APP_DOMAIN = "localhost:3000";
  process.env.NEXT_PUBLIC_SITE_NAME = "ServiceDesk";
  process.env.NEXT_PUBLIC_SITE_DESCRIPTION = "Help desk";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: () => auth.getUser(),
      getClaims: async () => ({ data: null, error: null }),
    },
  }),
}));

vi.mock("@/lib/platform-maintenance", () => ({
  isMaintenanceMode: async () => false,
  getWorkspaceBlock: async () => null,
}));

const { proxy } = await import("./proxy");

function pageRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { accept: "text/html" },
  });
}

describe("proxy when Supabase Auth is down (LOAD-001)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it.each(["/acme/tickets", "/platform"])(
    "answers %s with a retryable 503 instead of a sign-in redirect",
    async (path) => {
      auth.getUser = async () => ({
        data: { user: null },
        error: new AuthRetryableFetchError("Internal Server Error", 500),
      });

      const response = await proxy(pageRequest(path));

      expect(response.status).toBe(503);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("retry-after")).toBe("5");
    },
  );

  it("still redirects to sign-in when there is no session", async () => {
    auth.getUser = async () => ({
      data: { user: null },
      error: new AuthSessionMissingError(),
    });

    const response = await proxy(pageRequest("/acme/tickets"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/acme/login");
  });

  it("still serves public pages during an outage", async () => {
    auth.getUser = async () => ({
      data: { user: null },
      error: new AuthRetryableFetchError("fetch failed", 0),
    });

    const response = await proxy(pageRequest("/acme/login"));

    expect(response.status).not.toBe(503);
  });
});
