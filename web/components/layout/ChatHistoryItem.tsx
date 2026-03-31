"use client";

import { useState, useRef } from "react";
import { MessageSquare, Pin, PinOff, Pencil, Trash2, Download, Share2 } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useChatStore } from "@/lib/store";
import { cn, formatDate, truncate, extractTextContent } from "@/lib/utils";
import { MODELS } from "@/lib/constants";
import type { Conversation } from "@/lib/types";
import { ExportDialog } from "@/components/export/ExportDialog";
import { ShareDialog } from "@/components/share/ShareDialog";

interface ChatHistoryItemProps {
  conversation: Conversation;
  isPinned: boolean;
  isActive: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export function ChatHistoryItem({
  conversation,
  isPinned,
  isActive,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
}: ChatHistoryItemProps) {
  const { setActiveConversation, deleteConversation, renameConversation, pinConversation } =
    useChatStore();

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(conversation.title);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const preview = lastMessage ? truncate(extractTextContent(lastMessage.content), 60) : "No messages";

  const modelLabel = MODELS.find((m) => m.id === conversation.model)?.label?.replace("Claude ", "") ?? conversation.model;

  const handleRenameStart = () => {
    setRenameValue(conversation.title);
    setIsRenaming(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleRenameCommit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== conversation.title) {
      renameConversation(conversation.id, trimmed);
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleRenameCommit();
    if (e.key === "Escape") setIsRenaming(false);
  };


  const hasActiveTools = conversation.messages.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some((b) => b.type === "tool_use") &&
      m.status === "streaming"
  );

  return (
    <>
    <DropdownMenu.Root>
      <div
        draggable={isPinned}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={cn(
          "group relative flex items-start gap-2 px-3 py-2.5 mx-2 rounded-md cursor-pointer",
          "hover:bg-surface-800 transition-colors",
          isActive && "bg-surface-800",
          isDragging && "opacity-50 ring-1 ring-brand-500"
        )}
        onClick={() => !isRenaming && setActiveConversation(conversation.id)}
      >
        <div className="flex-shrink-0 mt-0.5">
          <MessageSquare
            className={cn("w-3.5 h-3.5", isActive ? "text-brand-400" : "text-surface-500")}
            aria-hidden="true"
          />
        </div>

        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameCommit}
              onKeyDown={handleRenameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "w-full text-sm bg-surface-700 text-surface-100 rounded px-1.5 py-0.5",
                "focus:outline-none focus:ring-1 focus:ring-brand-500"
              )}
              autoFocus
            />
          ) : (
            <p className="text-sm text-surface-200 truncate leading-tight">
              {conversation.title}
            </p>
          )}

          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-xs text-surface-500 truncate flex-1">{preview}</p>
            {hasActiveTools && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-soft flex-shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-surface-600">{formatDate(conversation.updatedAt)}</span>
            {modelLabel && (
              <span className="text-xs px-1 py-0.5 rounded bg-surface-700 text-surface-500 font-mono leading-none">
                {modelLabel}
              </span>
            )}
            {isPinned && (
              <Pin className="w-2.5 h-2.5 text-brand-500 flex-shrink-0" aria-label="Pinned" />
            )}
          </div>
        </div>

        {/* Context menu trigger on right-click */}
        <DropdownMenu.Trigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "absolute right-2 top-2 p-1 rounded opacity-0 group-hover:opacity-100",
              "text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-all",
              "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500"
            )}
            aria-label="More options"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>
        </DropdownMenu.Trigger>
      </div>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={cn(
            "z-50 min-w-[160px] rounded-md border border-surface-700 bg-surface-800 p-1",
            "shadow-lg shadow-black/30 text-sm",
            "animate-fade-in"
          )}
          sideOffset={4}
          align="start"
        >
          <DropdownMenu.Item
            onSelect={handleRenameStart}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer text-surface-200",
              "hover:bg-surface-700 hover:text-surface-100 focus:outline-none focus:bg-surface-700",
              "transition-colors"
            )}
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            Rename
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={() => pinConversation(conversation.id)}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer text-surface-200",
              "hover:bg-surface-700 hover:text-surface-100 focus:outline-none focus:bg-surface-700",
              "transition-colors"
            )}
          >
            {isPinned ? (
              <>
                <PinOff className="w-3.5 h-3.5" aria-hidden="true" />
                Unpin
              </>
            ) : (
              <>
                <Pin className="w-3.5 h-3.5" aria-hidden="true" />
                Pin
              </>
            )}
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={() => setExportOpen(true)}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer text-surface-200",
              "hover:bg-surface-700 hover:text-surface-100 focus:outline-none focus:bg-surface-700",
              "transition-colors"
            )}
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Export
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={() => setShareOpen(true)}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer text-surface-200",
              "hover:bg-surface-700 hover:text-surface-100 focus:outline-none focus:bg-surface-700",
              "transition-colors"
            )}
          >
            <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
            Share
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-surface-700" />

          <DropdownMenu.Item
            onSelect={() => deleteConversation(conversation.id)}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer text-red-400",
              "hover:bg-red-500/10 focus:outline-none focus:bg-red-500/10",
              "transition-colors"
            )}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>

    {exportOpen && (
      <ExportDialog
        conversation={conversation}
        open={exportOpen}
        onOpenChange={setExportOpen}
      />
    )}

    {shareOpen && (
      <ShareDialog
        conversation={conversation}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    )}
    </>
  );
}
