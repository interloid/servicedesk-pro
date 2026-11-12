import { describe, expect, it } from "vitest";

import {
  demoOutboxKindLabel,
  EMAIL_FRAME_SANDBOX,
  emailSrcDoc,
} from "./email-frame";

describe("emailSrcDoc", () => {
  it("adds the new-tab base right after an existing <head>", () => {
    const doc = emailSrcDoc(
      '<!DOCTYPE html><html><head lang="en"><title>x</title></head><body><a href="https://a.test">a</a></body></html>',
    );
    expect(doc).toBe(
      '<!DOCTYPE html><html><head lang="en"><base target="_blank"><title>x</title></head><body><a href="https://a.test">a</a></body></html>',
    );
  });

  it("wraps a fragment in a document with the base", () => {
    expect(emailSrcDoc("<div>hi</div>")).toBe(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"></head><body><div>hi</div></body></html>',
    );
  });

  it("doesn't mistake <header> for <head>", () => {
    expect(emailSrcDoc("<header>x</header>")).toContain(
      '<head><meta charset="utf-8"><base target="_blank"></head><body><header>x</header>',
    );
  });
});

describe("EMAIL_FRAME_SANDBOX", () => {
  it("never allows scripts or same-origin", () => {
    expect(EMAIL_FRAME_SANDBOX).not.toMatch(/allow-scripts|allow-same-origin/);
  });
});

describe("demoOutboxKindLabel", () => {
  it("names known kinds and passes others through", () => {
    expect(demoOutboxKindLabel("team_invitation")).toBe("Team invite");
    expect(demoOutboxKindLabel("something_new")).toBe("something_new");
  });
});
