"use client";

import { useState, useMemo } from "react";
import { X, BarChart2, Calendar, Tag, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/lib/store";
import { CalendarHeatmap } from "./CalendarHeatmap";
import { HistoryStats } from "./HistoryStats";
import { Timeline } from "./Timeline";
import { ConversationTags } from "./ConversationTags";
import { BulkActions } from "./BulkActions";

type Tab = "timeline" | "heatmap" | "stats" | "tags";

export function HistoryView() {
  const {
    conversations,
    tags,
    setSidebarTab,
    toggleSelectConversation,
    selectedConversationIds,
    clearSelection,
    openSearch,
  } = useChatStore();

  const [tab, setTab] = useState<Tab>("timeline");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!tagFilter) return conversations;
    return conversations.filter((c) => c.tags?.includes(tagFilter));
  }, [conversations, tagFilter]);

  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: "timeline", label: "Timeline", icon: BarChart2 },
    { id: "heatmap", label: "Activity", icon: Calendar },
    { id: "stats", label: "Stats", icon: BarChart2 },
    { id: "tags", label: "Tags", icon: Tag },
  ];

  return (
    <div className="flex flex-col h-full bg-surface-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
        <h2 className="text-sm font-semibold text-surface-100">History</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={openSearch}
            className="p-1.5 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors"
            title="Search conversations (Cmd+Shift+F)"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSidebarTab("chats")}
            className="p-1.5 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors"
            title="Back to chats"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-surface-800">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
              tab === id
                ? "text-brand-400 border-b-2 border-brand-500 -mb-px"
                : "text-surface-500 hover:text-surface-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bulk actions bar */}
      {selectedConversationIds.length > 0 && (
        <div className="px-3 py-2 border-b border-surface-800">
          <BulkActions selectedIds={selectedConversationIds} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {tab === "timeline" && (
              <Timeline
                conversations={filtered}
                selectedIds={selectedConversationIds}
                onSelect={toggleSelectConversation}
              />
            )}

            {tab === "heatmap" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-medium text-surface-400 mb-3">
                    Conversation activity — last 365 days
                  </h3>
                  <CalendarHeatmap conversations={conversations} />
                </div>
                <p className="text-xs text-surface-600">
                  {conversations.length} total conversation{conversations.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}

            {tab === "stats" && <HistoryStats conversations={conversations} />}

            {tab === "tags" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-medium text-surface-400 mb-2">Manage tags</h3>
                  <ConversationTags showManage />
                </div>
                <div>
                  <h3 className="text-xs font-medium text-surface-400 mb-2">Filter by tag</h3>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setTagFilter(null)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        !tagFilter
                          ? "bg-brand-600 text-white"
                          : "bg-surface-800 text-surface-400 hover:text-surface-200"
                      }`}
                    >
                      All
                    </button>
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => setTagFilter(tagFilter === tag.id ? null : tag.id)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          tagFilter === tag.id
                            ? "bg-brand-600 text-white"
                            : "bg-surface-800 text-surface-400 hover:text-surface-200"
                        }`}
                      >
                        {tag.label} ({conversations.filter((c) => c.tags?.includes(tag.id)).length})
                      </button>
                    ))}
                  </div>

                  {tagFilter && (
                    <div className="mt-4">
                      <Timeline
                        conversations={filtered}
                        selectedIds={selectedConversationIds}
                        onSelect={toggleSelectConversation}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
