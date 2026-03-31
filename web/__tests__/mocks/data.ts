import type { Conversation, Message, ContentBlock, ExportOptions } from "@/lib/types";

let idCounter = 0;
function nextId() {
  return `test-${++idCounter}`;
}

export function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: nextId(),
    role: "user",
    content: "Hello",
    status: "complete",
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

export function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: nextId(),
    title: "Test conversation",
    messages: [],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    model: "claude-sonnet-4-6",
    tags: [],
    ...overrides,
  };
}

export function makeToolUseMessage(name: string, input: Record<string, unknown>): Message {
  return makeMessage({
    role: "assistant",
    content: [
      {
        type: "tool_use",
        id: nextId(),
        name,
        input,
      } satisfies ContentBlock,
    ],
  });
}

export function makeToolResultMessage(toolUseId: string, content: string, isError = false): Message {
  return makeMessage({
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: toolUseId,
        content,
        is_error: isError,
      } satisfies ContentBlock,
    ],
  });
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: "markdown",
  includeToolUse: false,
  includeThinking: false,
  includeTimestamps: false,
  includeFileContents: false,
};

export function makePopulatedConversation(): Conversation {
  const userMsg = makeMessage({
    role: "user",
    content: "What is the capital of France?",
    createdAt: 1_700_000_001_000,
  });
  const assistantMsg = makeMessage({
    role: "assistant",
    content: "The capital of France is **Paris**.",
    status: "complete",
    createdAt: 1_700_000_002_000,
  });
  return makeConversation({
    title: "Geography Q&A",
    messages: [userMsg, assistantMsg],
    model: "claude-sonnet-4-6",
  });
}
