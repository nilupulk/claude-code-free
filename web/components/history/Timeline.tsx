"use client";

import { useMemo } from "react";
import { MessageSquare, Pin } from "lucide-react";
import type { Conversation } from "@/lib/types";
import { useChatStore } from "@/lib/store";
import { cn, formatDate, truncate } from "@/lib/utils";
import { TAG_PILL_CLASSES } from "./ConversationTags";

interface TimelineProps {
  conversations: Conversation[];
  selectedIds: string[];
  onSelect: (id: string) => void;
}

function groupByDay(conversations: Conversation[]): Array<{ label: string; items: Conversation[] }> {
  const groups = new Map<string, Conversation[]>();
  for (const conv of [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const d = new Date(conv.updatedAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    let label: string;
    if (d.toDateString() === today.toDateString()) {
      label = "Today";
    } else if (d.toDateString() === yesterday.toDateString()) {
      label = "Yesterday";
    } else {
      label = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(conv);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

export function Timeline({ conversations, selectedIds, onSelect }: TimelineProps) {
  const { tags, setActiveConversation, pinnedIds } = useChatStore();
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const groups = useMemo(() => groupByDay(conversations), [conversations]);
  const selectedSet = new Set(selectedIds);

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-surface-500">
        <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(({ label, items }) => (
        <div key={label}>
          <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 px-1">
            {label}
          </h3>
          <div className="space-y-1">
            {items.map((conv) => {
              const isPinned = pinnedIds.includes(conv.id);
              const isSelected = selectedSet.has(conv.id);
              const convTags = (conv.tags ?? [])
                .map((tid) => tagMap.get(tid))
                .filter(Boolean);

              return (
                <div
                  key={conv.id}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors group",
                    isSelected
                      ? "bg-brand-600/20 border border-brand-600/30"
                      : "hover:bg-surface-800/60 border border-transparent"
                  )}
                  onClick={() => setActiveConversation(conv.id)}
                >
                  {/* Selection checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(conv.id);
                    }}
                    className={cn(
                      "mt-0.5 w-4 h-4 rounded flex-shrink-0 border transition-colors",
                      isSelected
                        ? "bg-brand-600 border-brand-500"
                        : "border-surface-700 opacity-0 group-hover:opacity-100"
                    )}
                  >
                    {isSelected && (
                      <svg viewBox="0 0 10 10" className="w-full h-full text-white fill-current">
                        <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isPinned && <Pin className="w-3 h-3 text-brand-400 flex-shrink-0" />}
                      <p className="text-sm text-surface-200 truncate">{truncate(conv.title, 60)}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-surface-500">
                        {conv.messages.length} msg{conv.messages.length !== 1 ? "s" : ""}
                      </span>
                      {conv.model && (
                        <span className="text-xs text-surface-600">
                          {conv.model.split("-").slice(0, 2).join("-")}
                        </span>
                      )}
                      {convTags.length > 0 && (
                        <div className="flex gap-1">
                          {convTags.slice(0, 3).map((tag) => (
                            <span
                              key={tag!.id}
                              className={cn(
                                "px-1.5 py-0 rounded-full text-[10px] border",
                                TAG_PILL_CLASSES[tag!.color] ?? TAG_PILL_CLASSES.blue
                              )}
                            >
                              {tag!.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="text-xs text-surface-600 flex-shrink-0 mt-0.5">
                    {formatDate(conv.updatedAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
