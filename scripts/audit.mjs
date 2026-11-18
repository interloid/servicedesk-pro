#!/usr/bin/env node
// Runs `npm audit` on production dependencies and fails on any high or
// critical advisory, except the ones listed in ACCEPTED below.
//
// Every accepted advisory needs a reason and an expiry date. Once a date
// passes the advisory fails the audit again, so it gets looked at again.
// Remove an entry as soon as an upstream fix lands.
import { execFileSync } from "node:child_process";

const ACCEPTED = [
  {
    id: "GHSA-fc5q-39xc-vjpf",
    package: "picomatch",
    expires: "2027-01-31",
    reason:
      "No patched picomatch exists (<=4.0.7 affected, 4.0.7 is latest). The only " +
      "production path is @sentry/nextjs -> @rollup/plugin-commonjs, which runs at " +
      "build time with glob patterns from our own config, never from user input. " +
      "npm's suggested fix downgrades @sentry/nextjs to 8.x.",
  },
];

const FAIL_LEVELS = new Set(["high", "critical"]);
const today = new Date().toISOString().slice(0, 10);

let raw;
try {
  raw = execFileSync("npm", ["audit", "--omit=dev", "--json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  // npm audit exits non-zero when it finds anything; the JSON is still on stdout.
  raw = err.stdout;
  if (!raw) throw err;
}

const report = JSON.parse(raw);
if (report.error) {
  console.error("npm audit failed:", report.error.summary ?? report.error);
  process.exit(1);
}

// Advisory objects in `via` are the root causes; string entries only point at
// other vulnerable packages, so collecting the objects covers everything.
const advisories = new Map();
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via !== "object") continue;
    const id = via.url?.split("/").pop();
    advisories.set(id, { id, ...via });
  }
}

const failing = [];
for (const adv of advisories.values()) {
  if (!FAIL_LEVELS.has(adv.severity)) continue;
  const accepted = ACCEPTED.find(
    (a) => a.id === adv.id && a.package === adv.name,
  );
  if (accepted && accepted.expires >= today) {
    console.warn(
      `accepted until ${accepted.expires}: ${adv.id} ${adv.name} (${adv.severity}) ${adv.title}`,
    );
    continue;
  }
  failing.push({ ...adv, expired: Boolean(accepted) });
}

if (failing.length === 0) {
  console.log(
    "No unaccepted high or critical advisories in production dependencies.",
  );
  process.exit(0);
}

console.error("\nHigh or critical advisories in production dependencies:");
for (const adv of failing) {
  const note = adv.expired ? " [acceptance expired]" : "";
  console.error(
    `  ${adv.severity} ${adv.name} ${adv.range}: ${adv.title}${note}\n    ${adv.url}`,
  );
}
process.exit(1);
