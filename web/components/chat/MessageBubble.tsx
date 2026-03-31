"use client";

import { memo, useState, useCallback } from "react";
import { User, Bot, AlertCircle, Copy, Check, RefreshCw, Pencil, ChevronDown, Info } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn, extractTextContent, formatDate } from "@/lib/utils";
import type { Message, ContentBlock, ToolUseContent } from "@/lib/types";
import { MarkdownContent } from "./MarkdownContent";
import { AnnotationBadge } from "@/components/collaboration/AnnotationBadge";
import { ToolRouter } from "@/components/tools/ToolRouter";

interface MessageBubbleProps {
  message: Message;
  conversationId?: string;
}

function AssistantContent({
  blocks,
  isStreaming,
  isError,
}: {
  blocks: ContentBlock[];
  isStreaming: boolean;
  isError: boolean;
}) {
  // Check if there are any tool_use blocks (mixed content)
  const hasTools = blocks.some((b) => b.type === "tool_use");

  if (!hasTools) {
    // Plain text-only message — use original bubble style
    const text = blocks
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("");
    return (
      <div
        className={cn(
          "rounded-2xl px-4 py-3 text-sm rounded-tl-sm",
          isError
            ? "bg-red-950 border border-red-800 text-red-200"
            : "bg-surface-800 text-surface-100"
        )}
      >
        <MarkdownContent content={text} />
        {isStreaming && (
          <span
            aria-hidden="true"
            className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse-soft"
          />
        )}
      </div>
    );
  }

  // Mixed content: render blocks in order, tool_use via ToolRouter
  return (
    <div className="flex flex-col gap-2 w-full">
      {blocks.map((block, i) => {
        if (block.type === "text") {
          if (!block.text.trim()) return null;
          return (
            <div
              key={i}
              className="rounded-2xl px-4 py-3 text-sm bg-surface-800 text-surface-100 rounded-tl-sm"
            >
              <MarkdownContent content={block.text} />
              {isStreaming && i === blocks.length - 1 && (
                <span
                  aria-hidden="true"
                  className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse-soft"
                />
              )}
            </div>
          );
        }

        if (block.type === "tool_use") {
          const toolBlock = block as ToolUseContent;
          return (
            <ToolRouter
              key={toolBlock.id}
              toolName={toolBlock.name}
              toolUseId={toolBlock.id}
              input={toolBlock.input}
              result={toolBlock.result}
              isError={toolBlock.is_error}
              isRunning={toolBlock.is_running}
              startedAt={toolBlock.started_at}
              completedAt={toolBlock.completed_at}
            />
          );
        }

        // tool_result blocks are rendered inline with their tool_use counterpart
        return null;
      })}

      {/* Trailing streaming cursor when last block is a tool */}
      {isStreaming && blocks[blocks.length - 1]?.type === "tool_use" && (
        <div className="px-2 py-1 text-xs text-surface-500 animate-pulse">
          Working…
        </div>
      )}
    </div>
  );
}

export const MessageBubble = memo(function MessageBubble({
  message,
  conversationId,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const isStreaming = message.status === "streaming";
  const isSystem = message.role === "system";

  const [copied, setCopied] = useState(false);

  // Normalise content to a blocks array
  const blocks: ContentBlock[] = Array.isArray(message.content)
    ? (message.content as ContentBlock[])
    : [{ type: "text", text: message.content as string }];

  const textOnly = extractTextContent(message.content);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textOnly);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }, [textOnly]);

  const handleRetry = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("chat:retry", { detail: { conversationId, messageId: message.id } })
    );
  }, [conversationId, message.id]);

  const handleEdit = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("chat:edit", { detail: { conversationId, messageId: message.id, content: textOnly } })
    );
  }, [conversationId, message.id, textOnly]);

  // System messages: centered pill
  if (isSystem) {
    return (
      <div className="flex justify-center py-1" role="note">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-800/50 border border-surface-700/50">
          <Info className="w-3 h-3 text-surface-500" aria-hidden />
          <span className="text-xs text-surface-500 italic">{textOnly}</span>
        </div>
      </div>
    );
  }

  return (
    <article
      className={cn("group flex gap-3 animate-fade-in", isUser && "flex-row-reverse")}
      aria-label={isUser ? "You" : isError ? "Error from Claude" : "Claude"}
    >
      {/* Avatar — purely decorative, role conveyed by article label */}
      <div
        aria-hidden="true"
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
          isUser
            ? "bg-brand-600 text-white"
            : isError
            ? "bg-red-900 text-red-300"
            : "bg-surface-700 text-surface-300"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4" aria-hidden="true" />
        ) : isError ? (
          <AlertCircle className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Bot className="w-4 h-4" aria-hidden="true" />
        )}
      </div>

      {/* Content + hover actions */}
      <div className={cn("flex-1 min-w-0 max-w-2xl", isUser && "flex flex-col items-end")}>
        <div className="relative">
          {isUser ? (
            <div className="rounded-2xl px-4 py-3 text-sm bg-brand-600 text-white rounded-tr-sm">
              <p className="whitespace-pre-wrap break-words">{textOnly}</p>
            </div>
          ) : (
            <AssistantContent
              blocks={blocks}
              isStreaming={isStreaming}
              isError={isError}
            />
          )}
          {/* Annotation badge — only renders when inside a CollaborationProvider */}
          <div className="absolute -bottom-2.5 right-2">
            <AnnotationBadge messageId={message.id} />
          </div>
        </div>

        {/* Hover action row */}
        <div
          className={cn(
            "flex items-center gap-1 mt-1 px-1",
            "opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity",
            isUser ? "flex-row-reverse" : "flex-row"
          )}
        >
          {/* Timestamp */}
          <span className="text-xs text-surface-600 select-none" suppressHydrationWarning>
            {formatDate(message.createdAt)}
          </span>

          {/* Quick copy */}
          <button
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy message"}
            className="p-1 rounded text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* More actions dropdown */}
          <DropdownMenuPrimitive.Root>
            <DropdownMenuPrimitive.Trigger asChild>
              <button
                aria-label="More message actions"
                className="p-1 rounded text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500"
              >
                <ChevronDown className="w-3.5 h-3.5" aria-hidden />
              </button>
            </DropdownMenuPrimitive.Trigger>
            <DropdownMenuPrimitive.Portal>
              <DropdownMenuPrimitive.Content
                align={isUser ? "end" : "start"}
                sideOffset={4}
                className="z-50 min-w-32 bg-surface-800 border border-surface-700 rounded-lg shadow-xl p-1 text-sm animate-fade-in"
              >
                <DropdownMenuPrimitive.Item
                  onSelect={handleCopy}
                  className="flex items-center gap-2 px-3 py-1.5 rounded text-surface-300 hover:bg-surface-700 hover:text-surface-100 cursor-pointer focus:outline-none focus:bg-surface-700"
                >
                  <Copy className="w-3.5 h-3.5" aria-hidden /> Copy
                </DropdownMenuPrimitive.Item>

                {isUser && (
                  <DropdownMenuPrimitive.Item
                    onSelect={handleEdit}
                    className="flex items-center gap-2 px-3 py-1.5 rounded text-surface-300 hover:bg-surface-700 hover:text-surface-100 cursor-pointer focus:outline-none focus:bg-surface-700"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden /> Edit
                  </DropdownMenuPrimitive.Item>
                )}

                {!isUser && !isStreaming && (
                  <DropdownMenuPrimitive.Item
                    onSelect={handleRetry}
                    className="flex items-center gap-2 px-3 py-1.5 rounded text-surface-300 hover:bg-surface-700 hover:text-surface-100 cursor-pointer focus:outline-none focus:bg-surface-700"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden /> Retry
                  </DropdownMenuPrimitive.Item>
                )}
              </DropdownMenuPrimitive.Content>
            </DropdownMenuPrimitive.Portal>
          </DropdownMenuPrimitive.Root>
        </div>
      </div>
    </article>
  );
});
