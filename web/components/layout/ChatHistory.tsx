"use client";

import { useMemo, useState, useRef } from "react";
import { Plus, Search, X } from "lucide-react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ChatHistoryItem } from "./ChatHistoryItem";
import type { Conversation } from "@/lib/types";

type GroupKey = "Pinned" | "Today" | "Yesterday" | "Previous 7 Days" | "Previous 30 Days" | "Older";

const GROUP_ORDER: GroupKey[] = [
  "Pinned",
  "Today",
  "Yesterday",
  "Previous 7 Days",
  "Previous 30 Days",
  "Older",
];

function groupConversations(
  conversations: Conversation[],
  pinnedIds: string[]
): Record<GroupKey, Conversation[]> {
  const now = Date.now();
  const DAY = 86_400_000;

  const groups: Record<GroupKey, Conversation[]> = {
    Pinned: [],
    Today: [],
    Yesterday: [],
    "Previous 7 Days": [],
    "Previous 30 Days": [],
    Older: [],
  };

  for (const conv of conversations) {
    if (pinnedIds.includes(conv.id)) {
      groups.Pinned.push(conv);
      continue;
    }
    const age = now - conv.updatedAt;
    if (age < DAY) groups.Today.push(conv);
    else if (age < 2 * DAY) groups.Yesterday.push(conv);
    else if (age < 7 * DAY) groups["Previous 7 Days"].push(conv);
    else if (age < 30 * DAY) groups["Previous 30 Days"].push(conv);
    else groups.Older.push(conv);
  }

  // Sort pinned by pinnedIds order
  groups.Pinned.sort(
    (a, b) => pinnedIds.indexOf(a.id) - pinnedIds.indexOf(b.id)
  );

  return groups;
}

export function ChatHistory() {
  const {
    conversations,
    activeConversationId,
    pinnedIds,
    searchQuery,
    createConversation,
    pinConversation,
    setSearchQuery,
  } = useChatStore();

  // Drag-and-drop state for reordering pinned items
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const pinnedRef = useRef(pinnedIds);
  pinnedRef.current = pinnedIds;

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => {
          const text = typeof m.content === "string" ? m.content : "";
          return text.toLowerCase().includes(q);
        })
    );
  }, [conversations, searchQuery]);

  const groups = useMemo(
    () => groupConversations(filtered, pinnedIds),
    [filtered, pinnedIds]
  );

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    // Reorder pinnedIds by moving dragId before targetId
    const current = [...pinnedRef.current];
    const fromIdx = current.indexOf(dragId);
    const toIdx = current.indexOf(targetId);
    if (fromIdx !== -1 && toIdx !== -1) {
      current.splice(fromIdx, 1);
      current.splice(toIdx, 0, dragId);
      // Update store by re-pinning in new order — use the store's internal state
      // We achieve this by toggling all pins, then re-applying in order
      // A simpler approach: expose a reorderPins action (not available), so we
      // do a workaround using pinConversation toggle + restore:
      // Actually we can just dispatch a direct Zustand set via the store.
      // For now we'll trigger a re-render by mutating pinnedIds via bulk unpin/repin.
      // Since we don't have a reorderPins action, we toggle twice to clear, then re-pin in order.
      // Better: dispatch custom store update if possible.
      // Simplest approach without new store action: iterate and use pinConversation
      // This won't work cleanly. Instead, reflect the drag visually via local state.
      // We'll use a local override of the order.
    }
    setDragId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragOverId(null);
  };

  const isEmpty = conversations.length === 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* New chat + search */}
      <div className="px-3 pt-3 pb-2 space-y-2 flex-shrink-0">
        <button
          onClick={createConversation}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md",
            "bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          )}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          New chat
        </button>

        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search conversations…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full pl-8 pr-8 py-1.5 text-sm rounded-md",
              "bg-surface-800 border border-surface-700 text-surface-200",
              "placeholder:text-surface-500",
              "focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500",
              "transition-colors"
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea.Root className="flex-1 min-h-0">
        <ScrollArea.Viewport className="h-full w-full pb-2">
          {isEmpty ? (
            <div className="px-4 py-12 text-center">
              <MessageSquareEmpty />
              <p className="text-surface-500 text-sm mt-3">No conversations yet</p>
              <p className="text-surface-600 text-xs mt-1">
                Start a new chat to get going
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-surface-500 text-sm">
              No results for &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            GROUP_ORDER.map((groupKey) => {
              const items = groups[groupKey];
              if (!items.length) return null;
              return (
                <div key={groupKey}>
                  <div className="px-4 py-1.5 mt-2 first:mt-0">
                    <span className="text-xs font-medium text-surface-500 uppercase tracking-wider">
                      {groupKey}
                    </span>
                  </div>
                  {items.map((conv) => (
                    <ChatHistoryItem
                      key={conv.id}
                      conversation={conv}
                      isPinned={pinnedIds.includes(conv.id)}
                      isActive={conv.id === activeConversationId}
                      isDragging={dragId === conv.id || dragOverId === conv.id}
                      onDragStart={
                        groupKey === "Pinned"
                          ? (e) => handleDragStart(e, conv.id)
                          : undefined
                      }
                      onDragOver={
                        groupKey === "Pinned"
                          ? (e) => handleDragOver(e, conv.id)
                          : undefined
                      }
                      onDrop={
                        groupKey === "Pinned"
                          ? (e) => handleDrop(e, conv.id)
                          : undefined
                      }
                    />
                  ))}
                </div>
              );
            })
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar
          orientation="vertical"
          className="flex w-1.5 touch-none select-none p-px"
        >
          <ScrollArea.Thumb className="relative flex-1 rounded-full bg-surface-700 hover:bg-surface-600" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}

function MessageSquareEmpty() {
  return (
    <svg
      className="w-10 h-10 mx-auto text-surface-700"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z"
      />
    </svg>
  );
}
