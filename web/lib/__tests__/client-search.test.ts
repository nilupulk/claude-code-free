import { describe, it, expect } from "vitest";
import { clientSearch } from "@/lib/search/client-search";
import { makeConversation, makeMessage } from "@/__tests__/mocks/data";
import type { Conversation } from "@/lib/types";

function makeConvWithMessages(
  title: string,
  messages: Array<{ role: "user" | "assistant"; text: string }>
): Conversation {
  return makeConversation({
    title,
    messages: messages.map(({ role, text }) =>
      makeMessage({ role, content: text })
    ),
  });
}

const BASE_TIME = 1_700_000_000_000;

describe("clientSearch", () => {
  // --- Basic query matching ---

  it("returns empty array for blank query with no filters", () => {
    const conv = makeConvWithMessages("Test", [{ role: "user", text: "hello" }]);
    expect(clientSearch([conv], "")).toHaveLength(0);
  });

  it("matches conversations by message content", () => {
    const conv = makeConvWithMessages("Convo", [
      { role: "user", text: "TypeScript generics" },
    ]);
    const results = clientSearch([conv], "TypeScript");
    expect(results).toHaveLength(1);
    expect(results[0].conversationId).toBe(conv.id);
  });

  it("matches by conversation title (weighted higher)", () => {
    const byTitle = makeConvWithMessages("TypeScript Guide", [
      { role: "user", text: "hello" },
    ]);
    const byContent = makeConvWithMessages("Random Chat", [
      { role: "user", text: "TypeScript generics" },
    ]);
    const results = clientSearch([byContent, byTitle], "TypeScript");
    // Title match should rank first
    expect(results[0].conversationId).toBe(byTitle.id);
  });

  it("returns no results when query does not match anything", () => {
    const conv = makeConvWithMessages("Hello", [
      { role: "user", text: "world" },
    ]);
    expect(clientSearch([conv], "xyzzynotfound")).toHaveLength(0);
  });

  it("is case-insensitive", () => {
    const conv = makeConvWithMessages("Convo", [
      { role: "user", text: "TypeScript" },
    ]);
    expect(clientSearch([conv], "typescript")).toHaveLength(1);
    expect(clientSearch([conv], "TYPESCRIPT")).toHaveLength(1);
  });

  it("caps matches at 5 per conversation", () => {
    const messages = Array.from({ length: 10 }, (_, i) =>
      makeMessage({ role: "user", content: `needle message ${i}` })
    );
    const conv = makeConversation({ messages });
    const [result] = clientSearch([conv], "needle");
    expect(result.matches.length).toBeLessThanOrEqual(5);
  });

  it("sorts results by total score descending", () => {
    const weak = makeConvWithMessages("Chat A", [
      { role: "user", text: "needle once" },
    ]);
    const strong = makeConvWithMessages("needle Chat B", [
      { role: "user", text: "needle needle needle" },
    ]);
    const results = clientSearch([weak, strong], "needle");
    expect(results[0].conversationId).toBe(strong.id);
  });

  // --- Filters ---

  it("filters by role", () => {
    const conv = makeConversation({
      messages: [
        makeMessage({ role: "user", content: "user says needle" }),
        makeMessage({ role: "assistant", content: "assistant says needle" }),
      ],
    });
    const results = clientSearch([conv], "needle", { role: "user" });
    expect(results[0].matches.every((m) => m.role === "user")).toBe(true);
  });

  it("filters by conversationId", () => {
    const a = makeConvWithMessages("A", [{ role: "user", text: "needle" }]);
    const b = makeConvWithMessages("B", [{ role: "user", text: "needle" }]);
    const results = clientSearch([a, b], "needle", { conversationId: a.id });
    expect(results).toHaveLength(1);
    expect(results[0].conversationId).toBe(a.id);
  });

  it("filters by dateFrom (excludes older conversations)", () => {
    const old = makeConversation({
      updatedAt: BASE_TIME - 86_400_000,
      messages: [makeMessage({ content: "needle" })],
    });
    const recent = makeConversation({
      updatedAt: BASE_TIME + 1_000,
      messages: [makeMessage({ content: "needle" })],
    });
    const results = clientSearch([old, recent], "needle", {
      dateFrom: BASE_TIME,
    });
    expect(results).toHaveLength(1);
    expect(results[0].conversationId).toBe(recent.id);
  });

  it("returns all matching conversations when filter is empty object", () => {
    const convs = Array.from({ length: 3 }, (_, i) =>
      makeConvWithMessages(`Chat ${i}`, [{ role: "user", text: "needle" }])
    );
    expect(clientSearch(convs, "needle", {})).toHaveLength(3);
  });

  it("filter-only mode (no query) includes all conversations passing filters", () => {
    const a = makeConversation({ model: "claude-opus-4-6" });
    const b = makeConversation({ model: "claude-sonnet-4-6" });
    const results = clientSearch([a, b], "", { model: "claude-opus-4-6" });
    expect(results).toHaveLength(1);
    expect(results[0].conversationId).toBe(a.id);
  });

  it("filters by tagIds", () => {
    const tagged = makeConversation({ tags: ["tag-1", "tag-2"] });
    const untagged = makeConversation({ tags: [] });
    const results = clientSearch([tagged, untagged], "", { tagIds: ["tag-1"] });
    expect(results).toHaveLength(1);
    expect(results[0].conversationId).toBe(tagged.id);
  });
});
