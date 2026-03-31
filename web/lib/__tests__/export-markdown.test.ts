import { describe, it, expect } from "vitest";
import { toMarkdown } from "@/lib/export/markdown";
import {
  makeConversation,
  makeMessage,
  makeToolUseMessage,
  makeToolResultMessage,
  DEFAULT_EXPORT_OPTIONS,
} from "@/__tests__/mocks/data";

describe("toMarkdown", () => {
  it("includes the conversation title as an H1", () => {
    const conv = makeConversation({ title: "My Conversation" });
    const result = toMarkdown(conv, DEFAULT_EXPORT_OPTIONS);
    expect(result).toContain("# My Conversation");
  });

  it("includes model when present", () => {
    const conv = makeConversation({ model: "claude-sonnet-4-6" });
    const result = toMarkdown(conv, DEFAULT_EXPORT_OPTIONS);
    expect(result).toContain("**Model:** claude-sonnet-4-6");
  });

  it("omits model line when model is undefined", () => {
    const conv = makeConversation({ model: undefined });
    const result = toMarkdown(conv, DEFAULT_EXPORT_OPTIONS);
    expect(result).not.toContain("**Model:**");
  });

  it("includes message count in header", () => {
    const conv = makeConversation({
      messages: [makeMessage(), makeMessage()],
    });
    const result = toMarkdown(conv, DEFAULT_EXPORT_OPTIONS);
    expect(result).toContain("**Messages:** 2");
  });

  it("renders user message with ### **User** heading", () => {
    const conv = makeConversation({
      messages: [makeMessage({ role: "user", content: "Hello" })],
    });
    const result = toMarkdown(conv, DEFAULT_EXPORT_OPTIONS);
    expect(result).toContain("### **User**");
    expect(result).toContain("Hello");
  });

  it("renders assistant message with ### **Assistant** heading", () => {
    const conv = makeConversation({
      messages: [
        makeMessage({ role: "assistant", content: "World", status: "complete" }),
      ],
    });
    const result = toMarkdown(conv, DEFAULT_EXPORT_OPTIONS);
    expect(result).toContain("### **Assistant**");
    expect(result).toContain("World");
  });

  it("includes timestamps when includeTimestamps is true", () => {
    const conv = makeConversation({
      createdAt: new Date("2024-01-01T00:00:00Z").getTime(),
      messages: [
        makeMessage({
          createdAt: new Date("2024-01-01T00:00:00Z").getTime(),
        }),
      ],
    });
    const result = toMarkdown(conv, {
      ...DEFAULT_EXPORT_OPTIONS,
      includeTimestamps: true,
    });
    expect(result).toContain("**Created:**");
    expect(result).toMatch(/_.*2024.*_/);
  });

  it("omits timestamps when includeTimestamps is false", () => {
    const conv = makeConversation({
      messages: [makeMessage()],
    });
    const result = toMarkdown(conv, DEFAULT_EXPORT_OPTIONS);
    expect(result).not.toContain("**Created:**");
  });

  it("excludes tool use blocks when includeToolUse is false", () => {
    const toolMsg = makeToolUseMessage("bash", { command: "ls" });
    const conv = makeConversation({ messages: [toolMsg] });
    const result = toMarkdown(conv, {
      ...DEFAULT_EXPORT_OPTIONS,
      includeToolUse: false,
    });
    expect(result).not.toContain("```tool-use");
  });

  it("includes tool use blocks when includeToolUse is true", () => {
    const toolMsg = makeToolUseMessage("bash", { command: "ls" });
    const conv = makeConversation({ messages: [toolMsg] });
    const result = toMarkdown(conv, {
      ...DEFAULT_EXPORT_OPTIONS,
      includeToolUse: true,
    });
    expect(result).toContain("```tool-use");
    expect(result).toContain("bash");
  });

  it("includes tool result blocks when includeToolUse is true", () => {
    const resultMsg = makeToolResultMessage("tool-1", "file contents");
    const conv = makeConversation({ messages: [resultMsg] });
    const result = toMarkdown(conv, {
      ...DEFAULT_EXPORT_OPTIONS,
      includeToolUse: true,
    });
    expect(result).toContain("```tool-result");
    expect(result).toContain("file contents");
  });

  it("truncates tool result when includeFileContents is false and content is long", () => {
    const longContent = "x".repeat(600);
    const resultMsg = makeToolResultMessage("tool-1", longContent);
    const conv = makeConversation({ messages: [resultMsg] });
    const result = toMarkdown(conv, {
      ...DEFAULT_EXPORT_OPTIONS,
      includeToolUse: true,
      includeFileContents: false,
    });
    expect(result).toContain("[truncated]");
  });

  it("does not truncate tool result when includeFileContents is true", () => {
    const longContent = "x".repeat(600);
    const resultMsg = makeToolResultMessage("tool-1", longContent);
    const conv = makeConversation({ messages: [resultMsg] });
    const result = toMarkdown(conv, {
      ...DEFAULT_EXPORT_OPTIONS,
      includeToolUse: true,
      includeFileContents: true,
    });
    expect(result).not.toContain("[truncated]");
    expect(result).toContain("x".repeat(600));
  });

  it("filters messages by dateRange", () => {
    const early = makeMessage({
      role: "user",
      content: "early message",
      createdAt: 1_000,
    });
    const late = makeMessage({
      role: "user",
      content: "late message",
      createdAt: 9_000,
    });
    const conv = makeConversation({ messages: [early, late] });
    const result = toMarkdown(conv, {
      ...DEFAULT_EXPORT_OPTIONS,
      dateRange: { start: 5_000, end: 10_000 },
    });
    expect(result).not.toContain("early message");
    expect(result).toContain("late message");
  });

  it("ends with exported-from footer", () => {
    const conv = makeConversation();
    const result = toMarkdown(conv, DEFAULT_EXPORT_OPTIONS);
    expect(result).toContain("*Exported from Claude Code*");
  });
});
