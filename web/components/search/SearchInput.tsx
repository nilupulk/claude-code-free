"use client";

import { useRef, useEffect, useState } from "react";
import { Search, X, Clock } from "lucide-react";
import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, onClose, placeholder = "Search conversations…" }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showRecent, setShowRecent] = useState(false);
  const { recentSearches, clearRecentSearches } = useChatStore();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") setShowRecent(false);
  };

  const pickRecent = (query: string) => {
    onChange(query);
    setShowRecent(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-800">
        <Search className="w-5 h-5 text-surface-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setShowRecent(recentSearches.length > 0 && value === "")}
          onBlur={() => setTimeout(() => setShowRecent(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-surface-100 placeholder-surface-500 focus:outline-none text-base"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="p-1 rounded text-surface-500 hover:text-surface-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <kbd className="hidden sm:flex items-center gap-0.5 text-xs text-surface-600 border border-surface-700 rounded px-1.5 py-0.5 font-mono">
          Esc
        </kbd>
        <button
          onClick={onClose}
          className="sm:hidden p-1 rounded text-surface-500 hover:text-surface-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Recent searches dropdown */}
      {showRecent && recentSearches.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 bg-surface-900 border border-surface-700 rounded-b-lg shadow-xl">
          <div className="flex items-center justify-between px-4 py-2 border-b border-surface-800">
            <span className="text-xs text-surface-500 font-medium uppercase tracking-wide">
              Recent searches
            </span>
            <button
              onClick={clearRecentSearches}
              className="text-xs text-surface-600 hover:text-surface-400 transition-colors"
            >
              Clear
            </button>
          </div>
          {recentSearches.map((query) => (
            <button
              key={query}
              className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm text-surface-300 hover:bg-surface-800 transition-colors"
              onMouseDown={() => pickRecent(query)}
            >
              <Clock className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
              {query}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
