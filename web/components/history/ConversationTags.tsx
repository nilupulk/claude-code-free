"use client";

import { useState } from "react";
import { Plus, X, Check, Pencil } from "lucide-react";
import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ConversationTag } from "@/lib/types";

const TAG_COLORS = [
  "blue", "green", "red", "yellow", "purple",
  "pink", "orange", "teal", "cyan", "indigo",
] as const;

const DOT_CLASSES: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
  indigo: "bg-indigo-500",
};

const PILL_CLASSES: Record<string, string> = {
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  green: "bg-green-500/15 text-green-400 border-green-500/25",
  red: "bg-red-500/15 text-red-400 border-red-500/25",
  yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  pink: "bg-pink-500/15 text-pink-400 border-pink-500/25",
  orange: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  teal: "bg-teal-500/15 text-teal-400 border-teal-500/25",
  cyan: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  indigo: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
};

export { PILL_CLASSES as TAG_PILL_CLASSES };

interface ConversationTagsProps {
  conversationId?: string; // If provided, show tags for this conversation
  showManage?: boolean;    // Show the full tag management UI
}

export function ConversationTags({ conversationId, showManage = false }: ConversationTagsProps) {
  const {
    tags,
    conversations,
    createTag,
    deleteTag,
    updateTag,
    tagConversation,
    untagConversation,
  } = useChatStore();

  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<string>("blue");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const conv = conversationId
    ? conversations.find((c) => c.id === conversationId)
    : null;
  const convTagIds = new Set(conv?.tags ?? []);

  const handleCreate = () => {
    if (!newLabel.trim()) return;
    createTag(newLabel.trim(), newColor);
    setNewLabel("");
  };

  const startEdit = (tag: ConversationTag) => {
    setEditingId(tag.id);
    setEditLabel(tag.label);
  };

  const commitEdit = (id: string) => {
    if (editLabel.trim()) updateTag(id, { label: editLabel.trim() });
    setEditingId(null);
  };

  return (
    <div className="space-y-3">
      {/* Tags list */}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const applied = convTagIds.has(tag.id);
          return (
            <div key={tag.id} className="group flex items-center gap-0.5">
              {editingId === tag.id ? (
                <input
                  autoFocus
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onBlur={() => commitEdit(tag.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit(tag.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="text-xs bg-surface-800 border border-surface-600 rounded px-1.5 py-0.5 w-20 focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => {
                    if (!conversationId) return;
                    applied ? untagConversation(conversationId, tag.id) : tagConversation(conversationId, tag.id);
                  }}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors",
                    applied
                      ? PILL_CLASSES[tag.color] ?? PILL_CLASSES.blue
                      : "border-surface-700 text-surface-500 hover:text-surface-300"
                  )}
                >
                  {applied && <Check className="w-2.5 h-2.5" />}
                  {tag.label}
                </button>
              )}

              {showManage && editingId !== tag.id && (
                <div className="hidden group-hover:flex items-center">
                  <button
                    onClick={() => startEdit(tag)}
                    className="p-0.5 text-surface-600 hover:text-surface-400 transition-colors"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => deleteTag(tag.id)}
                    className="p-0.5 text-surface-600 hover:text-red-400 transition-colors"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create new tag */}
      {showManage && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="New tag name…"
            className="flex-1 text-xs bg-surface-800 border border-surface-700 rounded px-2 py-1 text-surface-200 placeholder-surface-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {/* Color picker */}
          <div className="flex gap-1">
            {TAG_COLORS.slice(0, 5).map((color) => (
              <button
                key={color}
                onClick={() => setNewColor(color)}
                className={cn(
                  "w-4 h-4 rounded-full transition-transform",
                  DOT_CLASSES[color],
                  newColor === color && "ring-2 ring-offset-1 ring-offset-surface-900 ring-white scale-110"
                )}
              />
            ))}
          </div>
          <button
            onClick={handleCreate}
            disabled={!newLabel.trim()}
            className="p-1 rounded text-surface-400 hover:text-surface-100 hover:bg-surface-700 disabled:opacity-40 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
