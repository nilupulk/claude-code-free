"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useChatStore } from "@/lib/store";
import { VirtualMessageList } from "./VirtualMessageList";
import { ScrollToBottom } from "./ScrollToBottom";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { ConversationLoadingSkeleton } from "@/components/ui/Skeleton";
import { markFirstMessageRender, monitorScrollFps } from "@/lib/performance/metrics";
import { Bot } from "lucide-react";

interface ChatWindowProps {
  conversationId: string;
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const { conversations, setDraftInput } = useChatStore();
  const conversation = conversations.find((c) => c.id === conversationId);
  const messages = conversation?.messages ?? [];
  const isStreaming = messages.some((m) => m.status === "streaming");

  // Announce the last completed assistant message to screen readers
  const [announcement, setAnnouncement] = useState("");
  const prevLengthRef = useRef(messages.length);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMessageCountRef = useRef(messages.length);
  const hasMarkedFirstRender = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollToBottomFnRef = useRef<(() => void) | null>(null);

  const handleScrollStateChange = useCallback((atBottom: boolean, scrollToBottomFn: () => void) => {
    scrollToBottomFnRef.current = scrollToBottomFn;
    setIsAtBottom(atBottom);
    if (atBottom) setUnreadCount(0);
  }, []);

  // Track new messages while scrolled away
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && !isAtBottom) {
      setUnreadCount((n) => n + (messages.length - prevMessageCountRef.current));
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, isAtBottom]);

  // Mark first-message-render metric once
  useEffect(() => {
    if (messages.length > 0 && !hasMarkedFirstRender.current) {
      hasMarkedFirstRender.current = true;
      markFirstMessageRender();
    }
  }, [messages.length]);

  // Monitor scroll FPS while the window is visible
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    return monitorScrollFps(el);
  }, []);

  // Announce new assistant replies to screen readers
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (
      messages.length > prevLengthRef.current &&
      lastMsg?.role === "assistant" &&
      lastMsg.status === "complete"
    ) {
      const preview =
        typeof lastMsg.content === "string"
          ? lastMsg.content.slice(0, 100)
          : "";
      setAnnouncement("");
      setTimeout(() => setAnnouncement(`Claude replied: ${preview}`), 50);
    }
    prevLengthRef.current = messages.length;
  }, [messages.length, messages]);

  if (messages.length === 0 && conversation === undefined) {
    return (
      <div className="flex-1 overflow-hidden">
        <ConversationLoadingSkeleton />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
        <div
          className="w-12 h-12 rounded-full bg-brand-600/20 flex items-center justify-center"
          aria-hidden="true"
        >
          <Bot className="w-6 h-6 text-brand-400" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-surface-100">How can I help?</h2>
          <p className="text-sm text-surface-400 mt-1">
            Start a conversation with Claude Code
          </p>
        </div>
        <SuggestedPrompts onSelect={(text) => setDraftInput(text)} />
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {/* Polite live region — announces when Claude finishes a reply */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      <VirtualMessageList
        messages={messages}
        isStreaming={isStreaming}
        conversationId={conversationId}
        onScrollStateChange={handleScrollStateChange}
      />

      {/* Scroll-to-bottom floating button */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="pointer-events-auto">
          <ScrollToBottom
            visible={!isAtBottom}
            onClick={() => scrollToBottomFnRef.current?.()}
            unreadCount={unreadCount}
          />
        </div>
      </div>
    </div>
  );
}
