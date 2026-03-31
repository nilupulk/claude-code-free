"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/lib/store";
import type { SearchFilters } from "@/lib/types";
import { clientSearch } from "@/lib/search/client-search";
import { SearchInput } from "./SearchInput";
import { SearchFilters as SearchFiltersPanel } from "./SearchFilters";
import { SearchResults } from "./SearchResults";

const DEBOUNCE_MS = 200;

export function GlobalSearch() {
  const { isSearchOpen, closeSearch, conversations, addRecentSearch, setActiveConversation } =
    useChatStore();

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<ReturnType<typeof clientSearch>>([]);
  const [loading, setLoading] = useState(false);
  const [took, setTook] = useState<number | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    (q: string, f: SearchFilters) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!q.trim() && !hasActiveFilters(f)) {
        setResults([]);
        setTook(undefined);
        return;
      }

      setLoading(true);
      debounceRef.current = setTimeout(() => {
        const start = performance.now();
        const r = clientSearch(conversations, q, f);
        setTook(Math.round(performance.now() - start));
        setResults(r);
        setLoading(false);
      }, DEBOUNCE_MS);
    },
    [conversations]
  );

  useEffect(() => {
    runSearch(query, filters);
  }, [query, filters, runSearch]);

  // Save recent search on close if there was a query
  const handleClose = useCallback(() => {
    if (query.trim()) addRecentSearch(query.trim());
    closeSearch();
    setQuery("");
    setFilters({});
    setResults([]);
    setShowFilters(false);
  }, [query, addRecentSearch, closeSearch]);

  // Keyboard shortcut to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSearchOpen) handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isSearchOpen, handleClose]);

  const handleSelectResult = (conversationId: string, _messageId?: string) => {
    if (query.trim()) addRecentSearch(query.trim());
    setActiveConversation(conversationId);
    closeSearch();
    setQuery("");
    setFilters({});
    setResults([]);
    // TODO: scroll to messageId once the chat window supports anchoring
  };

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="search-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Panel */}
          <motion.div
            key="search-panel"
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-x-4 top-[8vh] z-50 mx-auto max-w-3xl bg-surface-900 border border-surface-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: "80vh" }}
          >
            {/* Search input */}
            <SearchInput
              value={query}
              onChange={setQuery}
              onClose={handleClose}
            />

            {/* Filters toggle */}
            <div className="flex items-center gap-2 px-4 py-1.5 border-b border-surface-800/60">
              <button
                onClick={() => setShowFilters((v) => !v)}
                className="text-xs text-surface-500 hover:text-surface-300 transition-colors"
              >
                {showFilters ? "Hide filters" : "Filters"}
                {hasActiveFilters(filters) && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-600 text-white text-[10px]">
                    {countActiveFilters(filters)}
                  </span>
                )}
              </button>
              <span className="text-surface-700 text-xs">
                {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Filters panel */}
            {showFilters && (
              <SearchFiltersPanel filters={filters} onChange={setFilters} />
            )}

            {/* Results */}
            <SearchResults
              results={results}
              query={query}
              loading={loading}
              took={took}
              onSelectResult={handleSelectResult}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function hasActiveFilters(f: SearchFilters): boolean {
  return !!(
    f.dateFrom || f.dateTo || f.role || f.conversationId ||
    f.contentType || f.model || f.tagIds?.length
  );
}

function countActiveFilters(f: SearchFilters): number {
  return [
    f.dateFrom || f.dateTo,
    f.role,
    f.conversationId,
    f.contentType,
    f.model,
    f.tagIds?.length,
  ].filter(Boolean).length;
}
