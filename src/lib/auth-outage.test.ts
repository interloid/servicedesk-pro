import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { authOutageResponse, isAuthOutage } from "./auth-outage";

describe("isAuthOutage", () => {
  it("is true when Auth answered with a server error", () => {
    expect(isAuthOutage(new AuthRetryableFetchError("Bad Gateway", 502))).toBe(
      true,
    );
  });

  it("is true when Auth could not be reached", () => {
    expect(isAuthOutage(new AuthRetryableFetchError("fetch failed", 0))).toBe(
      true,
    );
  });

  it("is false when there is no session", () => {
    expect(isAuthOutage(new AuthSessionMissingError())).toBe(false);
  });

  it("is false when the token was refused", () => {
    expect(isAuthOutage(new AuthApiError("invalid JWT", 401, "bad_jwt"))).toBe(
      false,
    );
  });

  it("is false with no error", () => {
    expect(isAuthOutage(null)).toBe(false);
  });
});

describe("authOutageResponse", () => {
  it("answers a page request with a retryable 503 page", async () => {
    const response = authOutageResponse(
      new Request("https://app.test/acme/tickets", {
        headers: { accept: "text/html,application/xhtml+xml" },
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(await response.text()).toContain("Try again");
  });

  it("answers a server action or fetch with a short JSON 503", async () => {
    const response = authOutageResponse(
      new Request("https://app.test/acme/tickets", {
        method: "POST",
        headers: { accept: "text/x-component" },
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/json");
  });
});
