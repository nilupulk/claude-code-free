"use client";

/**
 * Web-adapted Message.
 *
 * The terminal Message (src/components/Message.tsx) renders a single
 * conversation turn — user, assistant, or tool — using Ink's <Box> / <Text>
 * with ANSI colour, terminal width truncation, and inline diff/code rendering.
 *
 * This web version uses the same props shape where feasible and maps each
 * content block type to the appropriate web component:
 *   - text   → Markdown renderer
 *   - tool_use → ToolUseBlock (collapsible)
 *   - tool_result → ToolUseBlock result pane
 *
 * Role-specific styling replicates the terminal's visual language:
 *   - user: right-aligned bubble (brand colour)
 *   - assistant: left-aligned flat card
 *   - system/tool: subtle muted row
 */

import * as React from "react";
import { memo } from "react";
import { User, Bot, AlertCircle, Wrench, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "./Markdown";
import { AnsiRenderer } from "../tools/AnsiRenderer";
import { ToolUseBlock } from "../tools/ToolUseBlock";
import { hasAnsi } from "@/lib/ansi-to-html";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "system" | "tool";
export type MessageStatus = "pending" | "streaming" | "complete" | "error";

export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}

export type ContentBlock = TextContent | ToolUseContent | ToolResultContent;

export interface MessageProps {
  /** Unique message ID. */
  id?: string;
  role: MessageRole;
  content: ContentBlock[] | string;
  status?: MessageStatus;
  /** When true dim the message content (e.g. old turns). */
  dim?: boolean;
  /** Model name for assistant messages. */
  model?: string;
  /** Timestamp (Unix ms). */
  createdAt?: number;
  /** Extra class names. */
  className?: string;
}

// ─── Content block renderers ─────────────────────────────────────────────────

function TextBlock({ text, dim }: { text: string; dim?: boolean }) {
  if (!text) return null;
  // If the string still contains ANSI codes (e.g. from a tool passthrough)
  // render with AnsiRenderer; otherwise use Markdown.
  if (hasAnsi(text)) {
    return (
      <AnsiRenderer
        text={text}
        className={cn("font-mono text-xs leading-5 whitespace-pre-wrap", dim && "opacity-60")}
      />
    );
  }
  return <Markdown dimColor={dim}>{text}</Markdown>;
}

function ToolResultBlock({ block }: { block: ToolResultContent }) {
  const rawContent =
    typeof block.content === "string"
      ? block.content
      : block.content
          .filter((b): b is TextContent => b.type === "text")
          .map((b) => b.text)
          .join("\n");

  return (
    <ToolUseBlock
      toolName={block.tool_use_id}
      toolInput={{}}
      toolResult={rawContent}
      isError={block.is_error}
    />
  );
}

function ContentBlocks({
  content,
  dim,
}: {
  content: ContentBlock[];
  dim?: boolean;
}) {
  return (
    <>
      {content.map((block, i) => {
        if (block.type === "text") {
          return <TextBlock key={i} text={block.text} dim={dim} />;
        }
        if (block.type === "tool_use") {
          return (
            <ToolUseBlock
              key={block.id ?? i}
              toolName={block.name}
              toolInput={block.input}
            />
          );
        }
        if (block.type === "tool_result") {
          return <ToolResultBlock key={i} block={block} />;
        }
        return null;
      })}
    </>
  );
}

// ─── Role avatars ─────────────────────────────────────────────────────────────

function Avatar({ role, isError }: { role: MessageRole; isError: boolean }) {
  const cls = cn(
    "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
    role === "user"
      ? "bg-brand-600 text-white"
      : isError
      ? "bg-red-900 text-red-300"
      : role === "tool"
      ? "bg-surface-700 text-surface-400"
      : "bg-surface-750 text-surface-300"
  );
  const Icon =
    role === "user"
      ? User
      : isError
      ? AlertCircle
      : role === "tool"
      ? Wrench
      : role === "system"
      ? Info
      : Bot;

  return (
    <div className={cls} aria-hidden>
      <Icon className="w-3.5 h-3.5" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const Message = memo(function Message({
  role,
  content,
  status = "complete",
  dim = false,
  model,
  createdAt,
  className,
}: MessageProps) {
  const isUser = role === "user";
  const isError = status === "error";
  const isStreaming = status === "streaming";

  const textContent =
    typeof content === "string"
      ? content
      : content
          .filter((b): b is TextContent => b.type === "text")
          .map((b) => b.text)
          .join("");

  // System messages get a compact inline style
  if (role === "system") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-xs text-surface-500 font-mono",
          "border-l-2 border-surface-700 ml-9 my-1",
          dim && "opacity-50",
          className
        )}
        role="note"
      >
        <Info className="w-3 h-3 flex-shrink-0 text-surface-600" aria-hidden />
        <span className="truncate">{textContent}</span>
      </div>
    );
  }

  return (
    <article
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser && "flex-row-reverse",
        dim && "opacity-70",
        className
      )}
      aria-label={
        isUser ? "You" : isError ? "Error from Claude" : `Claude${model ? ` (${model})` : ""}`
      }
    >
      {/* Avatar */}
      <Avatar role={role} isError={isError} />

      {/* Content bubble */}
      <div
        className={cn(
          "flex-1 min-w-0",
          "max-w-[min(680px,85%)]",
          isUser && "flex justify-end"
        )}
      >
        <div
          className={cn(
            "rounded-xl px-3.5 py-2.5 text-sm",
            isUser
              ? "bg-brand-600 text-white rounded-tr-sm"
              : isError
              ? "bg-red-950 border border-red-800/60 text-red-200 rounded-tl-sm"
              : "bg-surface-800/70 text-surface-100 rounded-tl-sm"
          )}
        >
          {isUser ? (
            // User messages: plain pre-wrap text (no markdown)
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {textContent}
            </p>
          ) : typeof content === "string" ? (
            <TextBlock text={content} dim={dim} />
          ) : (
            <ContentBlocks content={content} dim={dim} />
          )}

          {/* Streaming cursor */}
          {isStreaming && (
            <span
              aria-hidden
              className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse-soft align-text-bottom"
            />
          )}
        </div>

        {/* Meta row */}
        {(model || createdAt) && !isUser && (
          <div className="flex items-center gap-2 mt-1 px-0.5">
            {model && (
              <span className="text-xs text-surface-600 font-mono">{model}</span>
            )}
            {createdAt && (
              <time
                className="text-xs text-surface-700"
                dateTime={new Date(createdAt).toISOString()}
              >
                {new Date(createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            )}
          </div>
        )}
      </div>
    </article>
  );
});
