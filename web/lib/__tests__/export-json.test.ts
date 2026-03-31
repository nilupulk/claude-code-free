import { describe, it, expect } from "vitest";
import { toJSON } from "@/lib/export/json";
import {
  makeConversation,
  makeMessage,
  makeToolUseMessage,
  DEFAULT_EXPORT_OPTIONS,
} from "@/__tests__/mocks/data";

describe("toJSON", () => {
  it("produces valid JSON", () => {
    const conv = makeConversation();
    expect(() => JSON.parse(toJSON(conv, DEFAULT_EXPORT_OPTIONS))).not.toThrow();
  });

  it("includes conversation id, title, and model", () => {
    const conv = makeConversation({
      title: "My Chat",
      model: "claude-sonnet-4-6",
    });
    const obj = JSON.parse(toJSON(conv, DEFAULT_EXPORT_OPTIONS));
    expect(obj.id).toBe(conv.id);
    expect(obj.title).toBe("My Chat");
    expect(obj.model).toBe("claude-sonnet-4-6");
  });

  it("includes messageCount matching filtered messages", () => {
    const conv = makeConversation({
      messages: [makeMessage(), makeMessage(), makeMessage()],
    });
    const obj = JSON.parse(toJSON(conv, DEFAULT_EXPORT_OPTIONS));
    expect(obj.messageCount).toBe(3);
  });

  it("includes exportedAt timestamp", () => {
    const conv = makeConversation();
    const obj = JSON.parse(toJSON(conv, DEFAULT_EXPORT_OPTIONS));
    expect(obj.exportedAt).toBeDefined();
    expect(new Date(obj.exportedAt).toString()).not.toBe("Invalid Date");
  });

  it("strips timestamps when includeTimestamps is false", () => {
    const conv = makeConversation({ createdAt: 12345, updatedAt: 67890 });
    const obj = JSON.parse(toJSON(conv, DEFAULT_EXPORT_OPTIONS));
    expect(obj.createdAt).toBeUndefined();
    expect(obj.updatedAt).toBeUndefined();
  });

  it("includes timestamps when includeTimestamps is true", () => {
    const conv = makeConversation({ createdAt: 12345, updatedAt: 67890 });
    const obj = JSON.parse(
      toJSON(conv, { ...DEFAULT_EXPORT_OPTIONS, includeTimestamps: true })
    );
    expect(obj.createdAt).toBe(12345);
    expect(obj.updatedAt).toBe(67890);
  });

  it("strips tool_use blocks when includeToolUse is false", () => {
    const toolMsg = makeToolUseMessage("bash", { command: "ls" });
    const conv = makeConversation({ messages: [toolMsg] });
    const obj = JSON.parse(
      toJSON(conv, { ...DEFAULT_EXPORT_OPTIONS, includeToolUse: false })
    );
    const allBlocks = obj.messages.flatMap(
      (m: { content: Array<{ type: string }> }) =>
        Array.isArray(m.content) ? m.content : []
    );
    expect(allBlocks.some((b: { type: string }) => b.type === "tool_use")).toBe(false);
  });

  it("includes tool_use blocks when includeToolUse is true", () => {
    const toolMsg = makeToolUseMessage("bash", { command: "ls" });
    const conv = makeConversation({ messages: [toolMsg] });
    const obj = JSON.parse(
      toJSON(conv, { ...DEFAULT_EXPORT_OPTIONS, includeToolUse: true })
    );
    const allBlocks = obj.messages.flatMap(
      (m: { content: Array<{ type: string }> }) =>
        Array.isArray(m.content) ? m.content : []
    );
    expect(allBlocks.some((b: { type: string }) => b.type === "tool_use")).toBe(true);
  });

  it("filters messages by dateRange", () => {
    const inRange = makeMessage({ content: "in range", createdAt: 5_000 });
    const outOfRange = makeMessage({ content: "out of range", createdAt: 1_000 });
    const conv = makeConversation({ messages: [inRange, outOfRange] });
    const obj = JSON.parse(
      toJSON(conv, {
        ...DEFAULT_EXPORT_OPTIONS,
        dateRange: { start: 4_000, end: 6_000 },
      })
    );
    expect(obj.messageCount).toBe(1);
    expect(
      obj.messages.some(
        (m: { content: string }) => m.content === "in range"
      )
    ).toBe(true);
  });
});
