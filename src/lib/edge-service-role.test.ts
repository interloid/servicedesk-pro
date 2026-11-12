import { describe, expect, it } from "vitest";

// The Edge Function helper is plain TypeScript with no Deno APIs, so it is
// tested here with the app's runner.
import { isServiceRole } from "../../supabase/functions/_shared/service-role";

const KEY = "service-role-key-for-tests";

function jwt(claims: Record<string, unknown>): string {
  const part = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");

  return `${part({ alg: "HS256", typ: "JWT" })}.${part(claims)}.signature`;
}

function request(authorization?: string): Request {
  return new Request("http://localhost/functions/v1/reconcile-subscriptions", {
    method: "POST",
    headers: authorization ? { Authorization: authorization } : {},
  });
}

describe("isServiceRole", () => {
  it("accepts the service role key", () => {
    expect(isServiceRole(request(`Bearer ${KEY}`), KEY)).toBe(true);
  });

  it("accepts a token whose role claim is service_role", () => {
    expect(
      isServiceRole(request(`Bearer ${jwt({ role: "service_role" })}`), KEY),
    ).toBe(true);
  });

  it("refuses a signed-in user's token", () => {
    const token = jwt({
      role: "authenticated",
      sub: "8a6f3c1e-0000-4000-8000-000000000001",
      tenant_role: "tenant_admin",
    });

    expect(isServiceRole(request(`Bearer ${token}`), KEY)).toBe(false);
  });

  it("refuses the anon role", () => {
    expect(isServiceRole(request(`Bearer ${jwt({ role: "anon" })}`), KEY)).toBe(
      false,
    );
  });

  it("refuses a request with no token", () => {
    expect(isServiceRole(request(), KEY)).toBe(false);
  });

  it("refuses a malformed token", () => {
    expect(isServiceRole(request("Bearer not-a-jwt"), KEY)).toBe(false);
  });

  it("does not match an empty token against a missing key", () => {
    expect(isServiceRole(request("Bearer "), undefined)).toBe(false);
  });
});
