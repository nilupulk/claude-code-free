"use client";

import { MessageSquare, Bot, User, Wrench } from "lucide-react";
import type { SearchResult } from "@/lib/types";
import { formatDate, cn } from "@/lib/utils";

interface SearchResultItemProps {
  result: SearchResult;
  query: string;
  onClick: (conversationId: string, messageId?: string) => void;
}

const ROLE_ICONS = {
  user: User,
  assistant: Bot,
  system: MessageSquare,
  tool: Wrench,
} as const;

const ROLE_LABELS = {
  user: "You",
  assistant: "Claude",
  system: "System",
  tool: "Tool",
} as const;

export function SearchResultItem({ result, onClick }: SearchResultItemProps) {
  return (
    <div className="border-b border-surface-800 last:border-0">
      {/* Conversation header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-surface-800/50 transition-colors text-left"
        onClick={() => onClick(result.conversationId)}
      >
        <MessageSquare className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
        <span className="text-sm font-medium text-surface-200 flex-1 truncate">
          {result.conversationTitle}
        </span>
        <span className="text-xs text-surface-600 flex-shrink-0">
          {formatDate(result.conversationDate)}
        </span>
        {result.conversationModel && (
          <span className="text-xs text-surface-600 border border-surface-700 rounded px-1.5 py-0.5 flex-shrink-0">
            {result.conversationModel.split("-").slice(0, 3).join("-")}
          </span>
        )}
      </button>

      {/* Message matches */}
      {result.matches.length > 0 && (
        <div className="px-4 pb-2 space-y-1">
          {result.matches.map((match) => {
            const Icon = ROLE_ICONS[match.role] ?? MessageSquare;
            const label = ROLE_LABELS[match.role] ?? match.role;

            return (
              <button
                key={match.messageId}
                className={cn(
                  "w-full flex items-start gap-2.5 p-2 rounded-md text-left transition-colors",
                  "hover:bg-surface-800 bg-surface-900/50"
                )}
                onClick={() => onClick(result.conversationId, match.messageId)}
              >
                <Icon className="w-3.5 h-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-surface-500 mr-2">{label}</span>
                  <span
                    className="text-xs text-surface-300 [&_mark]:bg-yellow-400/30 [&_mark]:text-yellow-200 [&_mark]:rounded-sm [&_mark]:px-0.5"
                    dangerouslySetInnerHTML={{ __html: match.highlighted }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
