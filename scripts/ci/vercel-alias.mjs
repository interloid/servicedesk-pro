#!/usr/bin/env node
/**
 * Points a fixed domain at a development deployment, via the Vercel API.
 *
 *   node scripts/ci/vercel-alias.mjs <deployment url> <domain>
 *
 * Inputs (environment): VERCEL_TOKEN, VERCEL_ORG_ID.
 *
 * Replaces `vercel alias set`, which looks up the token's user before doing
 * anything and fails with "User not found." for a team-scoped token, even
 * with --scope. The API calls below need only the team.
 *
 * Refuses a Production deployment: the alias is for development only, and a
 * development build that Vercel made Production needs a person to look at it.
 */
import { pathToFileURL } from "node:url";

/** "https://x.vercel.app/" -> "x.vercel.app" */
export function hostOf(url) {
  return url
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

export async function aliasDeployment({ url, domain, token, orgId }) {
  const team = orgId?.startsWith("team_")
    ? `?teamId=${encodeURIComponent(orgId)}`
    : "";
  const api = async (method, path, body) => {
    const res = await fetch(`https://api.vercel.com${path}${team}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
    }
    return res.json();
  };

  const host = hostOf(url);
  const deployment = await api(
    "GET",
    `/v13/deployments/${encodeURIComponent(host)}`,
  );
  if (deployment.target === "production") {
    throw new Error(
      `${host} is a Production deployment, so ${domain} was not pointed at it. ` +
        "A development deploy should be Preview: check the project's " +
        "deployments in Vercel before re-running.",
    );
  }
  await api("POST", `/v2/deployments/${deployment.id}/aliases`, {
    alias: domain,
  });
  console.log(`Aliased ${domain} -> ${host} (${deployment.id})`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [url, domain] = process.argv.slice(2);
  if (!url || !domain) {
    console.log("::error::Usage: vercel-alias.mjs <deployment url> <domain>");
    process.exit(1);
  }
  aliasDeployment({
    url,
    domain: hostOf(domain),
    token: process.env.VERCEL_TOKEN,
    orgId: process.env.VERCEL_ORG_ID,
  }).catch((error) => {
    console.log(`::error::${error.message}`);
    process.exit(1);
  });
}
