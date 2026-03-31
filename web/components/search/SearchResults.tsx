"use client";

import { Search, Loader2 } from "lucide-react";
import type { SearchResult } from "@/lib/types";
import { SearchResultItem } from "./SearchResultItem";

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  loading: boolean;
  took?: number;
  onSelectResult: (conversationId: string, messageId?: string) => void;
}

export function SearchResults({
  results,
  query,
  loading,
  took,
  onSelectResult,
}: SearchResultsProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-surface-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Searching…</span>
      </div>
    );
  }

  if (!query.trim() && results.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-surface-500 py-16">
        <Search className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">Type to search your conversations</p>
        <p className="text-xs mt-1 text-surface-600">
          Search message content, code, and tool use
        </p>
      </div>
    );
  }

  if (query.trim() && results.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-surface-500 py-16">
        <Search className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">No results for &ldquo;{query}&rdquo;</p>
        <p className="text-xs mt-1 text-surface-600">
          Try different keywords or remove filters
        </p>
      </div>
    );
  }

  const totalMessages = results.reduce((s, r) => s + r.matches.length, 0);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Result count */}
      <div className="px-4 py-2 border-b border-surface-800 flex items-center justify-between">
        <p className="text-xs text-surface-500">
          {results.length} conversation{results.length !== 1 ? "s" : ""},{" "}
          {totalMessages} match{totalMessages !== 1 ? "es" : ""}
          {query.trim() ? ` for "${query}"` : ""}
        </p>
        {took !== undefined && (
          <p className="text-xs text-surface-600">{took}ms</p>
        )}
      </div>

      {/* Scrollable results */}
      <div className="flex-1 overflow-y-auto">
        {results.map((result) => (
          <SearchResultItem
            key={result.conversationId}
            result={result}
            query={query}
            onClick={onSelectResult}
          />
        ))}
      </div>
    </div>
  );
}
