import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatAttachment, ChatProfile } from "@/features/chatbot/chatbot";
import { GUIDE_TOPICS, portalGuide } from "@/features/chatbot/lib/portal-guide";

vi.mock("server-only", () => ({}));

const service = vi.hoisted(() => ({
  listPortalRequests: vi.fn(),
  findPortalRequestIdByNumber: vi.fn(),
  getPortalRequest: vi.fn(),
  createPortalRequest: vi.fn(),
  getPortalSupportHours: vi.fn(),
  getFirstResponseTarget: vi.fn(),
}));

vi.mock("@/features/portal/services/portal.service", () => service);

const { runTool } = await import("@/features/chatbot/tools");

const identity = {
  tenant: { id: "tenant-1", slug: "acme", name: "Acme" },
  customer: {
    id: "customer-1",
    fullName: "Ada Lovelace",
    email: "ada@x.io",
    company: null,
    initials: "AL",
    avatarUrl: null,
  },
  userId: "user-1",
} as unknown as Parameters<typeof runTool>[0]["identity"];

const newCtx = () => ({
  identity,
  slug: "acme",
  draft: null,
  seen: { viewed: [] as number[] },
  attachments: [] as ChatAttachment[],
  profile: null as ChatProfile | null,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tools", () => {
  it("draft_ticket records a draft and writes nothing", async () => {
    const ctx = newCtx();

    const outcome = await runTool(ctx, "draft_ticket", {
      subject: "VPN drops every 10 minutes",
      description: "Since Monday, on my work laptop.",
    });

    expect(outcome.isError).toBe(false);
    expect(ctx.draft).toEqual({
      subject: "VPN drops every 10 minutes",
      description: "Since Monday, on my work laptop.",
    });
    expect(service.createPortalRequest).not.toHaveBeenCalled();
  });

  it("draft_ticket rejects what the New request form would", async () => {
    const ctx = newCtx();

    const outcome = await runTool(ctx, "draft_ticket", {
      subject: "",
      description: "x",
    });

    expect(outcome.isError).toBe(true);
    expect(ctx.draft).toBeNull();
  });

  it("get_ticket looks up by number as the session's customer", async () => {
    service.findPortalRequestIdByNumber.mockResolvedValue("ticket-id");
    service.getPortalRequest.mockResolvedValue({
      id: "ticket-id",
      number: 12,
      subject: "Printer jam",
      description: "It jams.",
      status: "pending",
      state: "waiting_on_you",
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-02T00:00:00Z",
      resolvedAt: null,
      messages: [
        {
          authorType: "agent",
          authorName: "Sam",
          body: "Can you send a photo?",
          createdAt: "2026-11-02T00:00:00Z",
          attachments: [
            {
              id: "att-1",
              name: "jam.jpg",
              size: 204_800,
              mime: "image/jpeg",
              url: "https://storage.example/signed/jam.jpg?token=abc",
            },
          ],
        },
      ],
    });
    const ctx = newCtx();

    const outcome = await runTool(ctx, "get_ticket", { number: 12 });
    const body = JSON.parse(outcome.content);

    expect(service.findPortalRequestIdByNumber).toHaveBeenCalledWith(
      identity,
      12,
    );
    expect(body).toMatchObject({
      found: true,
      number: 12,
      status: "Waiting on you",
      latestMessages: [
        { from: "support (Sam)", body: "Can you send a photo?" },
      ],
    });
    expect(body.url).toMatch(/\/portal\/requests\/ticket-id$/);
    expect(ctx.seen.viewed).toEqual([12]);

    // The model gets the file's name, never its signed link...
    expect(body.files).toEqual([
      { name: "jam.jpg", sizeKb: 200, from: "support", at: "2026-11-02" },
    ]);
    expect(outcome.content).not.toContain("storage.example");
    // ...which goes to the widget's download card instead.
    expect(ctx.attachments).toEqual([
      expect.objectContaining({
        name: "jam.jpg",
        url: "https://storage.example/signed/jam.jpg?token=abc",
        requestNumber: 12,
      }),
    ]);
  });

  it("get_ticket says not found for someone else's number", async () => {
    service.findPortalRequestIdByNumber.mockResolvedValue(null);

    const outcome = await runTool(newCtx(), "get_ticket", { number: 999 });

    expect(JSON.parse(outcome.content)).toMatchObject({ found: false });
    expect(service.getPortalRequest).not.toHaveBeenCalled();
  });

  it("list_my_tickets maps 'any' to no filter", async () => {
    service.listPortalRequests.mockResolvedValue({
      requests: [],
      total: 0,
      page: 1,
      perPage: 5,
    });

    await runTool(newCtx(), "list_my_tickets", { state: "any", page: 1 });

    expect(service.listPortalRequests).toHaveBeenCalledWith(identity, {
      state: undefined,
      sort: "updated",
      page: 1,
    });
  });

  it("accepts a tool name in the wrong case and explains an unknown one", async () => {
    const ctx = newCtx();

    expect(
      (
        await runTool(ctx, "Draft_Ticket", {
          subject: "Login fails",
          description: "Error 500 on sign in.",
        })
      ).isError,
    ).toBe(false);

    const unknown = await runTool(ctx, "delete_ticket", {});
    expect(unknown.isError).toBe(true);
    expect(unknown.content).toContain("list_my_tickets");
  });

  it("turns a thrown error into an error result", async () => {
    service.listPortalRequests.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const outcome = await runTool(newCtx(), "list_my_tickets", {
      state: "open",
      page: 1,
    });

    expect(outcome.isError).toBe(true);
    expect(outcome.content).not.toContain("db down");
  });
});

describe("get_portal_guide", () => {
  it("answers with the customer's own hours and response target", async () => {
    service.getPortalSupportHours.mockResolvedValue({
      hours: "Mon–Fri, 09:00–17:00 CST",
      urgentTarget: null,
    });
    service.getFirstResponseTarget.mockResolvedValue("4 business hours");

    const outcome = await runTool(newCtx(), "get_portal_guide", {
      topic: "support",
    });
    const body = JSON.parse(outcome.content);

    expect(service.getPortalSupportHours).toHaveBeenCalledWith(
      "tenant-1",
      "customer-1",
    );
    expect(body).toMatchObject({
      portal: "Acme support portal",
      supportHours: "Mon–Fri, 09:00–17:00 CST",
      typicalFirstResponse: "4 business hours",
    });
  });

  it("skips the lookups for topics that don't need them", async () => {
    const outcome = await runTool(newCtx(), "get_portal_guide", {
      topic: "account",
    });

    expect(JSON.parse(outcome.content)).not.toHaveProperty("supportHours");
    expect(service.getPortalSupportHours).not.toHaveBeenCalled();
  });

  it("still answers when the hours can't be read", async () => {
    service.getPortalSupportHours.mockRejectedValue(new Error("db down"));
    service.getFirstResponseTarget.mockRejectedValue(new Error("db down"));

    const outcome = await runTool(newCtx(), "get_portal_guide", {
      topic: "overview",
    });

    expect(outcome.isError).toBe(false);
    expect(JSON.parse(outcome.content)).toMatchObject({
      supportHours: "not published",
    });
  });

  it("rejects an unknown topic", async () => {
    const outcome = await runTool(newCtx(), "get_portal_guide", {
      topic: "database",
    });

    expect(outcome.isError).toBe(true);
  });

  it("never mentions internals, vendors or staff tooling", () => {
    const facts = {
      workspace: "Acme",
      supportHours: null,
      firstResponse: null,
    };
    const text = GUIDE_TOPICS.map(
      (topic) => portalGuide(topic, facts).guide,
    ).join("\n");

    expect(text).not.toMatch(
      /supabase|groq|anthropic|claude|openai|ollama|servicedesk|api key|database|SLA polic|internal note|admin/i,
    );
  });
});

describe("get_my_profile", () => {
  it("returns the signed-in customer's own details and no ids", async () => {
    const ctx = newCtx();
    const outcome = await runTool(ctx, "get_my_profile", {});
    const body = JSON.parse(outcome.content);

    expect(body).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@x.io",
      company: "not set",
      profilePhoto: "not set",
    });
    expect(outcome.content).not.toMatch(/customer-1|user-1|tenant-1/);
    // The card gets the same details, from the session.
    expect(ctx.profile).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@x.io",
      avatarUrl: null,
    });
  });
});
