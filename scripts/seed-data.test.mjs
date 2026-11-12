import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CUSTOMER_EMAIL_TLD,
  MAX_TENANTS,
  STAFF_EMAIL_SUFFIX,
  TENANTS,
  TICKET_PLANS,
  peopleFor,
} from "./seed-data.mjs";

const US_ZONES = new Set([
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
]);
const STATUSES = ["new", "open", "pending", "on_hold", "resolved", "closed"];

const everyone = TENANTS.flatMap((spec, i) => {
  const { staff, customers } = peopleFor(spec, i);
  return [...staff, ...customers].map((person) => ({ ...person, spec }));
});

describe("seed data stays safe", () => {
  it("never uses a deliverable email address", () => {
    for (const person of everyone) {
      expect(
        person.email.endsWith(STAFF_EMAIL_SUFFIX) ||
          person.email.endsWith(CUSTOMER_EMAIL_TLD),
        person.email,
      ).toBe(true);
    }
  });

  it("uses only phone numbers reserved for fiction (555-0100 to 555-0199)", () => {
    for (const person of everyone.filter((p) => p.phone)) {
      expect(person.phone).toMatch(/^\+1-\d{3}-555-01\d{2}$/);
    }
  });

  it("gives every account a unique email", () => {
    const emails = everyone.map((person) => person.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("gives no two people in a workspace the same name", () => {
    for (const [i, spec] of TENANTS.entries()) {
      const { staff, customers } = peopleFor(spec, i);
      const names = [...staff, ...customers].map((p) => p.fullName);
      expect(new Set(names).size, spec.key).toBe(names.length);
    }
  });
});

describe("seed data shape", () => {
  it("has a full set of US workspaces with two customers each", () => {
    expect(TENANTS).toHaveLength(MAX_TENANTS);
    expect(new Set(TENANTS.map((t) => t.key)).size).toBe(TENANTS.length);
    for (const spec of TENANTS) {
      expect(US_ZONES.has(spec.tz), spec.key).toBe(true);
      expect(spec.customers).toHaveLength(TICKET_PLANS.length);
    }
  });

  it.each(TICKET_PLANS.map((plan, i) => [i + 1, plan]))(
    "ticket set %i covers every status with valid timelines",
    (_, plan) => {
      expect(new Set(plan.map((t) => t.status))).toEqual(new Set(STATUSES));
      expect(new Set(plan.map((t) => t.subject)).size).toBe(plan.length);

      for (const ticket of plan) {
        // Every handled ticket has an agent reply first, which stamps the
        // first response; new tickets have no thread yet.
        if (ticket.status === "new") {
          expect(ticket.thread, ticket.subject).toHaveLength(0);
        } else {
          expect(ticket.thread[0]?.by, ticket.subject).toBe("agent");
        }

        // Messages happen in the past, and before the ticket was resolved.
        const lastAt = ticket.resolvedAgo
          ? ticket.age - ticket.resolvedAgo
          : ticket.age;
        for (const message of ticket.thread) {
          expect(message.at, ticket.subject).toBeGreaterThan(0);
          expect(message.at, ticket.subject).toBeLessThanOrEqual(lastAt);
        }
      }
    },
  );
});

describe("seed data matches the e2e suite", () => {
  const e2eText = (dir) =>
    readdirSync(dir, { recursive: true })
      .filter((file) => String(file).endsWith(".ts"))
      .map((file) => readFileSync(join(dir, String(file)), "utf8"))
      .join("\n");
  const e2e = e2eText(join(process.cwd(), "e2e"));

  it("every seeded account the e2e suite signs in with exists", () => {
    const emails = new Set(everyone.map((p) => p.email));
    const referenced = [
      ...e2e.matchAll(/"([a-z0-9.]+@[a-z0-9.]+\.(?:seed\.test|example))"/g),
    ]
      .map((m) => m[1])
      // A deliberately unknown account, used to test failed sign-in.
      .filter((email) => !email.startsWith("nobody@"));

    expect(referenced.length).toBeGreaterThan(0);
    for (const email of referenced) {
      expect(emails.has(email), email).toBe(true);
    }
  });

  it("the ticket subjects the e2e suite looks for are seeded", () => {
    const subjects = TICKET_PLANS[0].map((t) => t.subject);
    for (const subject of [
      "Cannot log in after password reset",
      "Dashboard loads very slowly in the morning",
      "Integration stopped syncing overnight",
    ]) {
      expect(subjects).toContain(subject);
      expect(e2e).toContain(subject.slice(0, 25));
    }
  });

  it("keeps the workspace name the sign-in test expects", () => {
    expect(TENANTS.find((t) => t.key === "cedar")?.name).toBe(
      "Cedar Health Group",
    );
  });
});
