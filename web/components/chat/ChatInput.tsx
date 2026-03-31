"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Send, Square, Paperclip, X } from "lucide-react";
import { useChatStore } from "@/lib/store";
import { streamChat } from "@/lib/api";
import { cn, extractTextContent } from "@/lib/utils";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";
import { StreamingOptimizer } from "@/lib/performance/streaming-optimizer";
import { markTimeToInteractive, startStreamingLatencyMeasurement } from "@/lib/performance/metrics";
import type { ContentBlock, TextContent, ToolUseContent } from "@/lib/types";
import { SlashCommandMenu, type SlashCommand } from "./SlashCommandMenu";
import { FileAttachment } from "./FileAttachment";

interface ChatInputProps {
  conversationId: string;
}

export function ChatInput({ conversationId }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Accumulates the full assistant text independently of React state */
  const fullTextRef = useRef("");
  const optimizerRef = useRef<StreamingOptimizer | null>(null);

  const { conversations, settings, addMessage, updateMessage, draftInput, setDraftInput } = useChatStore();
  const conversation = conversations.find((c) => c.id === conversationId);

  // Slash command query (text after the leading /)
  const slashQuery = useMemo(() => {
    if (input.startsWith("/")) return input.slice(1).split(" ")[0];
    return "";
  }, [input]);

  // Mark time-to-interactive once the textarea mounts
  useEffect(() => {
    markTimeToInteractive();
  }, []);

  // Pick up suggested prompt text written into the store by SuggestedPrompts
  useEffect(() => {
    if (draftInput) {
      setInput(draftInput);
      setDraftInput("");
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        adjustHeight();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftInput]);

  // Listen for retry / edit events dispatched by MessageBubble
  useEffect(() => {
    const handleRetry = (e: Event) => {
      const { conversationId: cid, messageId } = (e as CustomEvent).detail;
      if (cid !== conversationId) return;
      const conv = conversations.find((c) => c.id === conversationId);
      if (!conv) return;
      const idx = conv.messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return;
      // Find the last user message before this assistant message
      const userMsg = conv.messages.slice(0, idx).reverse().find((m) => m.role === "user");
      if (!userMsg) return;
      // Trim conversation to before the assistant message
      const keepCount = idx;
      // We use updateMessage to remove trailing messages by truncating — but the
      // store doesn't expose truncate here, so we remove via a resend approach:
      // set input to the user message text and the user can send it again.
      setInput(extractTextContent(userMsg.content));
      requestAnimationFrame(() => textareaRef.current?.focus());
    };

    const handleEdit = (e: Event) => {
      const { conversationId: cid, content } = (e as CustomEvent).detail;
      if (cid !== conversationId) return;
      setInput(content ?? "");
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        adjustHeight();
      });
    };

    window.addEventListener("chat:retry", handleRetry);
    window.addEventListener("chat:edit", handleEdit);
    return () => {
      window.removeEventListener("chat:retry", handleRetry);
      window.removeEventListener("chat:edit", handleEdit);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, conversations]);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setIsStreaming(true);
    fullTextRef.current = "";

    // Optimistic: add user message immediately
    addMessage(conversationId, {
      role: "user",
      content: text,
      status: "complete",
    });

    // Add placeholder assistant message
    const assistantId = addMessage(conversationId, {
      role: "assistant",
      content: [],
      status: "streaming",
    });

    const controller = new AbortController();
    abortRef.current = controller;

    const messages = [
      ...(conversation?.messages ?? []).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user" as const, content: text },
    ];

    // Content blocks being built up during streaming
    let contentBlocks: ContentBlock[] = [];

    // Flush pending text from the optimizer into the last text block
    const flushText = (accumulated: string) => {
      if (!accumulated) return;
      const last = contentBlocks[contentBlocks.length - 1];
      if (last?.type === "text") {
        contentBlocks = [
          ...contentBlocks.slice(0, -1),
          { type: "text", text: last.text + accumulated } as TextContent,
        ];
      } else {
        contentBlocks = [...contentBlocks, { type: "text", text: accumulated } as TextContent];
      }
      updateMessage(conversationId, assistantId, {
        content: contentBlocks,
        status: "streaming",
      });
    };

    // RAF-batched optimizer for text tokens only
    const optimizer = new StreamingOptimizer(flushText);
    optimizerRef.current = optimizer;

    const endLatencyMeasurement = startStreamingLatencyMeasurement();
    let firstChunkReceived = false;

    try {
      for await (const chunk of streamChat(messages, settings.model, controller.signal)) {
        if (chunk.type === "text" && chunk.content) {
          if (!firstChunkReceived) {
            firstChunkReceived = true;
            endLatencyMeasurement();
          }
          optimizer.push(chunk.content);
        } else if (chunk.type === "tool_use" && chunk.tool) {
          // Flush any buffered text first
          optimizer.flush();
          const toolBlock: ToolUseContent = {
            type: "tool_use",
            id: chunk.tool.id,
            name: chunk.tool.name,
            input: chunk.tool.input ?? {},
            is_running: true,
            started_at: Date.now(),
          };
          contentBlocks = [...contentBlocks, toolBlock];
          updateMessage(conversationId, assistantId, {
            content: contentBlocks,
            status: "streaming",
          });
        } else if (chunk.type === "tool_result" && chunk.tool) {
          // Mark the matching tool_use block as complete with its result
          const now = Date.now();
          contentBlocks = contentBlocks.map((b) => {
            if (b.type === "tool_use" && b.id === chunk.tool!.id) {
              return {
                ...b,
                result: chunk.tool!.result,
                is_error: chunk.tool!.is_error,
                is_running: false,
                completed_at: now,
              } as ToolUseContent;
            }
            return b;
          });
          updateMessage(conversationId, assistantId, {
            content: contentBlocks,
            status: "streaming",
          });
        } else if (chunk.type === "done") {
          break;
        } else if (chunk.type === "error") {
          optimizer.destroy();
          updateMessage(conversationId, assistantId, {
            content: chunk.error ?? "An error occurred",
            status: "error",
          });
          return;
        }
      }

      // Flush any remaining buffered tokens before marking complete
      optimizer.destroy();
      updateMessage(conversationId, assistantId, { status: "complete" });
    } catch (err) {
      optimizer.destroy();
      if ((err as Error).name !== "AbortError") {
        updateMessage(conversationId, assistantId, {
          content: "Request failed. Please try again.",
          status: "error",
        });
      } else {
        updateMessage(conversationId, assistantId, { status: "complete" });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      optimizerRef.current = null;
      fullTextRef.current = "";
    }
  }, [input, isStreaming, conversationId, conversation, settings.model, addMessage, updateMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't intercept arrow keys when slash menu is visible — SlashCommandMenu handles those
    if (showSlashMenu && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Escape")) {
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Up arrow on empty input → load last user message for editing
    if (e.key === "ArrowUp" && !input) {
      e.preventDefault();
      const conv = conversations.find((c) => c.id === conversationId);
      if (!conv) return;
      const lastUserMsg = [...conv.messages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        setInput(extractTextContent(lastUserMsg.content));
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (el) {
            el.focus();
            el.selectionStart = el.selectionEnd = el.value.length;
            adjustHeight();
          }
        });
      }
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value.slice(0, MAX_MESSAGE_LENGTH);
    setInput(value);
    // Show slash menu when input starts with /
    setShowSlashMenu(value.startsWith("/") && !value.includes(" "));
    adjustHeight();
  };

  const handleSlashSelect = (cmd: SlashCommand) => {
    setInput(`/${cmd.name} `);
    setShowSlashMenu(false);
    textareaRef.current?.focus();
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter((f) => f.size < 10 * 1024 * 1024); // 10MB limit
    setAttachments((prev) => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const charCount = input.length;
  const charPercent = Math.round((charCount / MAX_MESSAGE_LENGTH) * 100);
  const isNearLimit = charPercent >= 80;

  return (
    <div
      className={cn(
        "border-t border-surface-800 bg-surface-900/50 backdrop-blur-sm px-4 py-3",
        isDragOver && "bg-brand-950/20 border-brand-700"
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        aria-hidden
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      <div className="max-w-3xl mx-auto">
        {/* File attachments row */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachments.map((file, i) => (
              <FileAttachment
                key={`${file.name}-${i}`}
                file={file}
                onRemove={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
        )}

        {/* Slash command menu (floats above input) */}
        <div className="relative">
          <SlashCommandMenu
            query={slashQuery}
            visible={showSlashMenu}
            onSelect={handleSlashSelect}
            onClose={() => setShowSlashMenu(false)}
          />

          <div
            className={cn(
              "flex items-end gap-2 rounded-xl border bg-surface-800 px-3 py-2",
              "border-surface-700 focus-within:border-brand-500 transition-colors",
              isDragOver && "border-brand-500"
            )}
          >
            {/* Attach file button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 text-surface-500 hover:text-surface-300 transition-colors flex-shrink-0 mb-0.5"
              aria-label="Attach file"
              type="button"
            >
              <Paperclip className="w-4 h-4" aria-hidden="true" />
            </button>

            <label htmlFor="chat-input" className="sr-only">
              Message
            </label>
            <textarea
              id="chat-input"
              ref={textareaRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={isDragOver ? "Drop files here…" : "Message Claude Code… (/ for commands)"}
              rows={1}
              aria-label="Message"
              aria-describedby="char-count"
              className={cn(
                "flex-1 resize-none bg-transparent text-sm text-surface-100",
                "placeholder:text-surface-500 focus:outline-none",
                "min-h-[24px] max-h-[300px] py-0.5"
              )}
            />

            {isStreaming ? (
              <button
                onClick={handleStop}
                aria-label="Stop generation"
                className="p-1.5 rounded-lg bg-surface-700 text-surface-300 hover:bg-surface-600 transition-colors flex-shrink-0"
                type="button"
              >
                <Square className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!input.trim() && attachments.length === 0}
                aria-label="Send message"
                type="button"
                className={cn(
                  "p-1.5 rounded-lg transition-colors flex-shrink-0",
                  input.trim() || attachments.length > 0
                    ? "bg-brand-600 text-white hover:bg-brand-700"
                    : "bg-surface-700 text-surface-500 cursor-not-allowed"
                )}
              >
                <Send className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Footer row: disclaimer + character count */}
        <div className="flex items-center justify-between mt-1.5 px-1">
          <p className="text-xs text-surface-600">
            Claude can make mistakes. Verify important information.
          </p>
          {charCount > 0 && (
            <span
              id="char-count"
              className={cn(
                "text-xs tabular-nums transition-colors",
                isNearLimit ? "text-amber-500" : "text-surface-600"
              )}
              aria-live="polite"
              aria-label={`${charCount} of ${MAX_MESSAGE_LENGTH} characters`}
            >
              {charCount.toLocaleString()}{isNearLimit ? `/${MAX_MESSAGE_LENGTH.toLocaleString()}` : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
