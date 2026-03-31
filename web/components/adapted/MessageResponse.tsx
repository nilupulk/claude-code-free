"use client";

/**
 * Web-adapted MessageResponse component.
 *
 * Renders a single assistant response block — text, tool use, tool results,
 * and thinking blocks.  The terminal version (src/components/MessageResponse.tsx)
 * renders via Ink primitives; this version renders clean HTML with Tailwind.
 */

import * as React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Wrench, Eye, EyeOff } from "lucide-react";
import type { ContentBlock, ToolUseContent, ToolResultContent } from "@/lib/types";
import { Markdown } from "./Markdown";
import { Spinner } from "./Spinner";
import { AnsiRenderer } from "@/components/tools/AnsiRenderer";
import { hasAnsi } from "@/lib/ansi-to-html";

// ─── Tool use block ───────────────────────────────────────────────────────────

function ToolUseBlock({ block }: { block: ToolUseContent }) {
  const [open, setOpen] = useState(false);
  const inputJson = JSON.stringify(block.input, null, 2);

  return (
    <div className="rounded-md border border-surface-700 bg-surface-900/50 my-1.5 overflow-hidden text-xs font-mono">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-800/50 transition-colors"
      >
        <Wrench className="w-3 h-3 text-brand-400 flex-shrink-0" />
        <span className="text-brand-300 font-semibold">{block.name}</span>
        <span className="text-surface-500 ml-auto">
          {open
            ? <ChevronDown className="w-3 h-3" />
            : <ChevronRight className="w-3 h-3" />}
        </span>
      </button>
      {open && (
        <pre className="px-3 pb-3 text-surface-300 overflow-x-auto whitespace-pre-wrap break-all">
          {inputJson}
        </pre>
      )}
    </div>
  );
}

// ─── Tool result block ────────────────────────────────────────────────────────

function ToolResultBlock({ block }: { block: ToolResultContent }) {
  const [open, setOpen] = useState(false);
  const raw = typeof block.content === "string"
    ? block.content
    : block.content
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map(b => b.text)
        .join("");

  const isError = block.is_error;
  const preview = raw.slice(0, 120) + (raw.length > 120 ? "…" : "");

  return (
    <div
      className={cn(
        "rounded-md border my-1.5 overflow-hidden text-xs font-mono",
        isError
          ? "border-red-800 bg-red-950/40"
          : "border-surface-700 bg-surface-900/30"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-800/40 transition-colors"
      >
        {isError
          ? <span className="text-red-400 font-semibold">Error result</span>
          : <span className="text-surface-400">Tool result</span>}
        <span className="text-surface-600 truncate flex-1 ml-2">{!open && preview}</span>
        <span className="text-surface-500 flex-shrink-0">
          {open ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 overflow-x-auto">
          {hasAnsi(raw)
            ? <AnsiRenderer text={raw} className="text-surface-300 whitespace-pre-wrap" />
            : <pre className="text-surface-300 whitespace-pre-wrap">{raw}</pre>}
        </div>
      )}
    </div>
  );
}

// ─── Thinking block ───────────────────────────────────────────────────────────

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-surface-800 bg-surface-950/60 my-1.5 overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-900 transition-colors"
      >
        <span className="text-surface-500 italic">Thinking…</span>
        <span className="text-surface-600 ml-auto">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-surface-500 italic font-mono whitespace-pre-wrap text-xs">
          {text}
        </div>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MessageResponseProps {
  /** Message content — string or content-block array. */
  content: ContentBlock[] | string;
  /** When true, show a streaming cursor after the last text. */
  isStreaming?: boolean;
  /** When true, render text at reduced opacity. */
  dim?: boolean;
  /** Extra class names. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MessageResponse({
  content,
  isStreaming = false,
  dim = false,
  className,
}: MessageResponseProps) {
  const blocks: React.ReactNode[] = [];

  if (typeof content === "string") {
    blocks.push(
      <div key="text" className="relative">
        <Markdown dimColor={dim}>{content}</Markdown>
        {isStreaming && (
          <span
            className="inline-block w-1.5 h-4 bg-brand-400 align-text-bottom ml-0.5 animate-pulse-soft"
            aria-hidden
          />
        )}
      </div>
    );
  } else {
    content.forEach((block, i) => {
      if (block.type === "text") {
        const isLast = i === content.length - 1;
        blocks.push(
          <div key={i} className="relative">
            <Markdown dimColor={dim}>{block.text}</Markdown>
            {isStreaming && isLast && (
              <span
                className="inline-block w-1.5 h-4 bg-brand-400 align-text-bottom ml-0.5 animate-pulse-soft"
                aria-hidden
              />
            )}
          </div>
        );
      } else if (block.type === "tool_use") {
        blocks.push(<ToolUseBlock key={i} block={block} />);
      } else if (block.type === "tool_result") {
        blocks.push(<ToolResultBlock key={i} block={block} />);
      } else if ((block as { type: string }).type === "thinking") {
        blocks.push(
          <ThinkingBlock key={i} text={(block as unknown as { thinking: string }).thinking} />
        );
      }
    });
  }

  if (isStreaming && blocks.length === 0) {
    blocks.push(<Spinner key="spinner" mode="thinking" className="mt-1" />);
  }

  return (
    <div className={cn("min-w-0", className)}>
      {blocks}
    </div>
  );
}
