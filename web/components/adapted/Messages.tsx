"use client";

/**
 * Web-adapted Messages.
 *
 * The terminal Messages (src/components/Messages.tsx) is a virtualised list
 * that renders conversation turns using terminal dimensions, ANSI styling, and
 * Ink's measurement APIs.
 *
 * This web version:
 *   - Uses @tanstack/react-virtual for efficient rendering of long histories
 *   - Delegates each item to the adapted Message component
 *   - Auto-scrolls to the bottom when new messages arrive
 *   - Shows an "empty state" when there are no messages yet
 *   - Accepts the same conceptual props (messages array) so callers can swap
 *     the component via the platform conditional without logic changes
 */

import * as React from "react";
import { useRef, useEffect, useCallback, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Message as MessageComponent } from "./Message";
import type { MessageProps } from "./Message";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal message shape accepted by this component. */
export interface MessageItem extends Omit<MessageProps, "className"> {
  id: string;
}

export interface MessagesProps {
  messages: MessageItem[];
  /** When true, disable auto-scroll (e.g. user has scrolled up manually). */
  disableAutoScroll?: boolean;
  /** Called when the user scrolls to the top (for history loading). */
  onScrollToTop?: () => void;
  /** Whether the session is actively generating output. */
  isStreaming?: boolean;
  /** Extra class names for the scroll container. */
  className?: string;
}

// ─── Height estimation ────────────────────────────────────────────────────────

function estimateHeight(msg: MessageItem): number {
  const text =
    typeof msg.content === "string"
      ? msg.content
      : msg.content
          .filter((b): b is { type: "text"; text: string } => b.type === "text")
          .map((b) => b.text)
          .join("");

  if (msg.role === "system") return 36;
  if (text.length < 80) return 72;
  if (text.length < 400 || text.includes("```")) return 160;
  return 320;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-surface-500 py-16">
      <div className="w-14 h-14 rounded-full bg-surface-800 flex items-center justify-center">
        <Bot className="w-7 h-7 text-surface-400" aria-hidden />
      </div>
      <p className="text-sm font-mono text-center max-w-xs leading-relaxed">
        Start a conversation with Claude Code.
        <br />
        <span className="text-surface-600">
          Ask anything — code, analysis, writing.
        </span>
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Messages = memo(function Messages({
  messages,
  disableAutoScroll = false,
  onScrollToTop,
  isStreaming = false,
  className,
}: MessagesProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const prevLengthRef = useRef(messages.length);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => estimateHeight(messages[i]),
    overscan: 5,
  });

  // Auto-scroll to bottom when new messages arrive (if already near bottom)
  useEffect(() => {
    if (disableAutoScroll) return;
    const grew = messages.length > prevLengthRef.current;
    prevLengthRef.current = messages.length;

    if (grew && atBottomRef.current) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    }
  }, [messages.length, disableAutoScroll, virtualizer]);

  // Also scroll when the last message's content changes (streaming)
  const lastMsg = messages[messages.length - 1];
  const lastContent = lastMsg
    ? typeof lastMsg.content === "string"
      ? lastMsg.content
      : JSON.stringify(lastMsg.content)
    : "";
  useEffect(() => {
    if (!isStreaming || disableAutoScroll || !atBottomRef.current) return;
    virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastContent, isStreaming]);

  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = distFromBottom < 80;

    if (el.scrollTop < 40) {
      onScrollToTop?.();
    }
  }, [onScrollToTop]);

  if (messages.length === 0) {
    return (
      <div className={cn("flex-1 overflow-y-auto", className)}>
        <EmptyState />
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      className={cn(
        "flex-1 overflow-y-auto overscroll-contain scroll-smooth",
        className
      )}
      role="log"
      aria-label="Conversation"
      aria-live="polite"
      aria-relevant="additions"
    >
      {/* Total height spacer for virtualizer */}
      <div
        style={{ height: virtualizer.getTotalSize() }}
        className="relative w-full"
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${items[0]?.start ?? 0}px)`,
          }}
        >
          {items.map((virtualRow) => {
            const msg = messages[virtualRow.index];
            return (
              <div
                key={msg.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
              >
                <MessageComponent
                  {...msg}
                  className={
                    virtualRow.index === 0 ? "pt-4" : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
