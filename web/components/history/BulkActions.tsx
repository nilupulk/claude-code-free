"use client";

import { Trash2, Download, X, CheckSquare } from "lucide-react";
import { useChatStore } from "@/lib/store";
import { exportConversationsAsZip } from "@/lib/export";

interface BulkActionsProps {
  selectedIds: string[];
}

export function BulkActions({ selectedIds }: BulkActionsProps) {
  const { bulkDeleteConversations, clearSelection, conversations } = useChatStore();
  const count = selectedIds.length;

  if (count === 0) return null;

  const handleExport = () => {
    const selected = conversations.filter((c) => selectedIds.includes(c.id));
    exportConversationsAsZip(selected);
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete ${count} conversation${count !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    bulkDeleteConversations(selectedIds);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-brand-600/10 border border-brand-600/30 rounded-lg">
      <CheckSquare className="w-3.5 h-3.5 text-brand-400" />
      <span className="text-xs text-brand-300 font-medium flex-1">
        {count} selected
      </span>
      <button
        onClick={handleExport}
        className="flex items-center gap-1 text-xs text-surface-400 hover:text-surface-200 transition-colors px-1.5 py-1 rounded hover:bg-surface-700"
        title="Export selected"
      >
        <Download className="w-3.5 h-3.5" />
        Export
      </button>
      <button
        onClick={handleDelete}
        className="flex items-center gap-1 text-xs text-surface-400 hover:text-red-400 transition-colors px-1.5 py-1 rounded hover:bg-surface-700"
        title="Delete selected"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>
      <button
        onClick={clearSelection}
        className="p-1 text-surface-500 hover:text-surface-300 transition-colors"
        title="Clear selection"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
