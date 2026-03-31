"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface InputHistoryProps {
  /** All history entries, oldest first */
  entries: readonly string[];
  /** The index that is currently selected/highlighted (-1 = none) */
  selectedIndex: number;
  /** Called when the user clicks an entry */
  onSelect: (entry: string) => void;
  /** Called when the panel should close */
  onDismiss: () => void;
  /** Maximum number of entries to show */
  maxVisible?: number;
  className?: string;
}

/**
 * Dropdown panel that shows past input entries.
 *
 * Displayed when the user presses an explicit "show history" key or when
 * Ctrl+R triggers a history search. Entries are shown newest-first.
 */
export function InputHistory({
  entries,
  selectedIndex,
  onSelect,
  onDismiss,
  maxVisible = 10,
  className,
}: InputHistoryProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const selectedRef = useRef<HTMLLIElement>(null);

  // Keep the selected item scrolled into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onDismiss]);

  // Entries are shown newest-first
  const visible = [...entries].reverse().slice(0, maxVisible);

  if (visible.length === 0) return null;

  // The selectedIndex is an index into the reversed slice
  const normalizedSelected =
    selectedIndex >= 0 && selectedIndex < visible.length ? selectedIndex : -1;

  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label="Input history"
      className={cn(
        "absolute bottom-full left-0 right-0 mb-1 z-50",
        "max-h-60 overflow-y-auto overscroll-contain",
        "rounded-lg border border-surface-700 bg-surface-900 shadow-xl",
        "py-1",
        className,
      )}
    >
      {visible.map((entry, i) => {
        const isSelected = i === normalizedSelected;
        return (
          <li
            key={i}
            ref={isSelected ? selectedRef : undefined}
            role="option"
            aria-selected={isSelected}
            tabIndex={-1}
            onClick={() => {
              onSelect(entry);
              onDismiss();
            }}
            className={cn(
              "px-3 py-1.5 text-sm font-mono cursor-pointer truncate",
              "text-surface-300 hover:bg-surface-800 hover:text-surface-100",
              isSelected && "bg-surface-800 text-surface-100",
              "transition-colors",
            )}
            title={entry}
          >
            {entry}
          </li>
        );
      })}
    </ul>
  );
}
