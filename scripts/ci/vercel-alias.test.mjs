import { afterEach, describe, expect, it, vi } from "vitest";

import { aliasDeployment, hostOf } from "./vercel-alias.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("hostOf", () => {
  it("strips the scheme and any path", () => {
    expect(hostOf("https://app-abc-team.vercel.app/\n")).toBe(
      "app-abc-team.vercel.app",
    );
    expect(hostOf("dev.example.com")).toBe("dev.example.com");
  });
});

describe("aliasDeployment", () => {
  afterEach(() => vi.unstubAllGlobals());

  const args = {
    url: "https://app-abc-team.vercel.app",
    domain: "dev.example.com",
    token: "t",
    orgId: "team_1",
  };

  it("looks up the deployment, then assigns the alias in the team", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ id: "dpl_1", target: null }))
      .mockResolvedValueOnce(json({ uid: "a", alias: "dev.example.com" }));
    vi.stubGlobal("fetch", fetch);

    await aliasDeployment(args);

    expect(fetch.mock.calls.map(([url, init]) => [init.method, url])).toEqual([
      [
        "GET",
        "https://api.vercel.com/v13/deployments/app-abc-team.vercel.app?teamId=team_1",
      ],
      [
        "POST",
        "https://api.vercel.com/v2/deployments/dpl_1/aliases?teamId=team_1",
      ],
    ]);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      alias: "dev.example.com",
    });
  });

  it("refuses a Production deployment", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ id: "dpl_1", target: "production" }));
    vi.stubGlobal("fetch", fetch);

    await expect(aliasDeployment(args)).rejects.toThrow(/Production/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports an API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ error: { code: "forbidden" } }, 403)),
    );
    await expect(aliasDeployment(args)).rejects.toThrow(/403/);
  });
});
