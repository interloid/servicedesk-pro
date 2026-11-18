import { afterEach, describe, expect, it, vi } from "vitest";

import { chatStorageKey, clearStoredChats } from "@/features/chatbot/chatbot";

function fakeSessionStorage(initial: Record<string, string>) {
  const store = new Map(Object.entries(initial));

  return {
    store,
    storage: {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("saved chats", () => {
  it("keeps each customer's chat under its own key", () => {
    expect(chatStorageKey("acme", "customer-a")).not.toBe(
      chatStorageKey("acme", "customer-b"),
    );
  });

  it("clears every saved chat on sign-out and nothing else", () => {
    const { store, storage } = fakeSessionStorage({
      [chatStorageKey("acme", "customer-a")]: "{}",
      "portal-chat:v2:acme": "{}",
      "portal-chat:teaser-dismissed": "1",
      "something-else": "keep",
    });
    vi.stubGlobal("window", { sessionStorage: storage });

    clearStoredChats();

    expect([...store.keys()]).toEqual(["something-else"]);
  });

  it("does nothing when storage is blocked", () => {
    vi.stubGlobal("window", {
      get sessionStorage() {
        throw new Error("blocked");
      },
    });

    expect(() => clearStoredChats()).not.toThrow();
  });
});
