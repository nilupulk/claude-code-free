"use client";

import { useState, useCallback, useRef } from "react";
import { useChatStore } from "@/lib/store";
import { messageAPI } from "@/lib/api/messages";
import { ApiError } from "@/lib/api/types";
import type { StreamEvent } from "@/lib/api/types";
import type { ContentBlock, Message, TextContent, ToolUseContent } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseChatReturn {
  messages: Message[];
  isStreaming: boolean;
  error: Error | ApiError | null;
  send: (content: string, opts?: { model?: string }) => Promise<void>;
  stop: () => void;
  retry: (messageId: string) => Promise<void>;
  edit: (messageId: string, newContent: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Stream event processor
// ---------------------------------------------------------------------------

/**
 * Accumulates SSE stream events into a ContentBlock array and calls
 * `onUpdate` after each change.
 */
function createStreamProcessor(onUpdate: (blocks: ContentBlock[]) => void) {
  const blocks: (ContentBlock & { _partialJson?: string })[] = [];

  function flush() {
    onUpdate([...blocks] as ContentBlock[]);
  }

  function handleEvent(event: StreamEvent) {
    switch (event.type) {
      case "content_block_start": {
        blocks[event.index] = event.content_block as ContentBlock & {
          _partialJson?: string;
        };
        flush();
        break;
      }

      case "content_block_delta": {
        const block = blocks[event.index];
        if (!block) break;

        if (event.delta.type === "text_delta" && block.type === "text") {
          (block as TextContent).text += event.delta.text;
          flush();
        } else if (
          event.delta.type === "input_json_delta" &&
          block.type === "tool_use"
        ) {
          (block as ToolUseContent & { _partialJson?: string })._partialJson =
            ((block as ToolUseContent & { _partialJson?: string })._partialJson ??
              "") + event.delta.partial_json;
        }
        break;
      }

      case "content_block_stop": {
        const block = blocks[event.index] as ToolUseContent & {
          _partialJson?: string;
        };
        if (block?.type === "tool_use" && block._partialJson) {
          try {
            block.input = JSON.parse(block._partialJson) as Record<
              string,
              unknown
            >;
          } catch {
            // leave input as-is
          }
          delete block._partialJson;
          flush();
        }
        break;
      }

      // Other events don't need block updates
      default:
        break;
    }
  }

  function finalize(): ContentBlock[] {
    // Clean up any leftover _partialJson fields
    for (const b of blocks) {
      if ((b as { _partialJson?: string })._partialJson !== undefined) {
        delete (b as { _partialJson?: string })._partialJson;
      }
    }
    return [...blocks] as ContentBlock[];
  }

  return { handleEvent, finalize };
}

// ---------------------------------------------------------------------------
// useChat
// ---------------------------------------------------------------------------

/**
 * Manages sending and receiving messages for a single conversation.
 *
 * - Handles optimistic user message insertion
 * - Streams the assistant response in real time
 * - Supports stop, retry, and edit
 *
 * @example
 * const { messages, isStreaming, send, stop } = useChat(conversationId);
 */
export function useChat(conversationId: string | null): UseChatReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | ApiError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { conversations, addMessage, updateMessage, truncateMessages } =
    useChatStore();

  const conversation = conversations.find((c) => c.id === conversationId) ?? null;
  const messages = conversation?.messages ?? [];

  // ---------------------------------------------------------------------------
  // Core: drain a stream into an assistant message
  // ---------------------------------------------------------------------------

  const drainStream = useCallback(
    async (
      stream: AsyncGenerator<StreamEvent>,
      assistantMsgId: string,
      convId: string
    ) => {
      const { handleEvent, finalize } = createStreamProcessor((blocks) => {
        updateMessage(convId, assistantMsgId, {
          content: blocks,
          status: "streaming",
        });
      });

      try {
        for await (const event of stream) {
          if (event.type === "error") {
            throw new Error(event.error.message);
          }
          handleEvent(event);
        }
        updateMessage(convId, assistantMsgId, {
          content:
            finalize().length > 0
              ? finalize()
              : [{ type: "text", text: "" } as TextContent],
          status: "complete",
        });
      } catch (err) {
        updateMessage(convId, assistantMsgId, { status: "error" });
        throw err;
      }
    },
    [updateMessage]
  );

  // ---------------------------------------------------------------------------
  // send
  // ---------------------------------------------------------------------------

  const send = useCallback(
    async (content: string, opts?: { model?: string }) => {
      if (!conversationId || isStreaming) return;
      setError(null);
      setIsStreaming(true);

      // Optimistic user message
      addMessage(conversationId, {
        role: "user",
        content,
        status: "complete",
      });

      // Read history *after* adding user message so the API sees it
      const history = useChatStore
        .getState()
        .conversations.find((c) => c.id === conversationId)?.messages ?? [];

      // Placeholder assistant message
      const assistantMsgId = addMessage(conversationId, {
        role: "assistant",
        content: [],
        status: "streaming",
      });

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Pass history *without* the placeholder assistant message
        const historyForApi = history.slice(0, -0); // all messages up to now
        const stream = messageAPI.send(conversationId, content, historyForApi, {
          model: opts?.model,
          signal: controller.signal,
        });
        await drainStream(stream, assistantMsgId, conversationId);
      } catch (err) {
        if (!(err instanceof Error && err.name === "AbortError")) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [conversationId, isStreaming, addMessage, drainStream]
  );

  // ---------------------------------------------------------------------------
  // stop
  // ---------------------------------------------------------------------------

  const stop = useCallback(() => {
    abortRef.current?.abort();
    if (conversationId) void messageAPI.stop(conversationId);
    setIsStreaming(false);
  }, [conversationId]);

  // ---------------------------------------------------------------------------
  // retry
  // ---------------------------------------------------------------------------

  const retry = useCallback(
    async (messageId: string) => {
      if (!conversationId || isStreaming) return;

      const conv = useChatStore
        .getState()
        .conversations.find((c) => c.id === conversationId);
      if (!conv) return;

      const msgIndex = conv.messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return;

      // Keep everything up to (not including) the assistant message to retry
      const historyForApi = conv.messages.slice(0, msgIndex);

      setError(null);
      setIsStreaming(true);

      // Reset the existing assistant message in place
      updateMessage(conversationId, messageId, {
        content: [],
        status: "streaming",
      });

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const stream = messageAPI.retry(conversationId, historyForApi, {
          signal: controller.signal,
        });
        await drainStream(stream, messageId, conversationId);
      } catch (err) {
        if (!(err instanceof Error && err.name === "AbortError")) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [conversationId, isStreaming, updateMessage, drainStream]
  );

  // ---------------------------------------------------------------------------
  // edit
  // ---------------------------------------------------------------------------

  const edit = useCallback(
    async (messageId: string, newContent: string) => {
      if (!conversationId || isStreaming) return;

      const conv = useChatStore
        .getState()
        .conversations.find((c) => c.id === conversationId);
      if (!conv) return;

      const msgIndex = conv.messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return;

      // Update user message in place
      updateMessage(conversationId, messageId, {
        content: newContent,
        status: "complete",
      });

      // Remove all messages after the edited user message
      truncateMessages(conversationId, msgIndex + 1);

      // History up to (not including) the edited message
      const historyBefore = conv.messages.slice(0, msgIndex);

      // Add a fresh assistant placeholder
      const assistantMsgId = addMessage(conversationId, {
        role: "assistant",
        content: [],
        status: "streaming",
      });

      setError(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const stream = messageAPI.edit(conversationId, newContent, historyBefore, {
          signal: controller.signal,
        });
        await drainStream(stream, assistantMsgId, conversationId);
      } catch (err) {
        if (!(err instanceof Error && err.name === "AbortError")) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [conversationId, isStreaming, addMessage, updateMessage, truncateMessages, drainStream]
  );

  return { messages, isStreaming, error, send, stop, retry, edit };
}
