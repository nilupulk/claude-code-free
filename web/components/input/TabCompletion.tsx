"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// ── Public types ──────────────────────────────────────────────────────────────

export interface TabCompletionItem {
  /** The string that will be inserted into the input */
  value: string;
  /** Display label (defaults to `value` if omitted) */
  label?: string;
  /** Optional secondary description shown to the right */
  description?: string;
  /** Optional icon name (lucide) or emoji */
  icon?: string;
}

export interface TabCompletionProps {
  items: TabCompletionItem[];
  /** Index of the currently highlighted item */
  selectedIndex: number;
  /** Called when the user clicks or presses Enter on an item */
  onSelect: (item: TabCompletionItem) => void;
  /** Called when the menu should close (Escape, outside click) */
  onDismiss: () => void;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Tab-completion dropdown menu.
 *
 * Keyboard navigation (Tab / Shift+Tab / ArrowUp / ArrowDown / Enter / Escape)
 * is handled by the parent WebTextInput — this component only handles
 * mouse interaction and renders the list.
 */
export function TabCompletion({
  items,
  selectedIndex,
  onSelect,
  onDismiss,
  className,
}: TabCompletionProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const selectedRef = useRef<HTMLLIElement>(null);

  // Scroll selected item into view whenever it changes
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Dismiss on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onDismiss]);

  if (items.length === 0) return null;

  const clamped = Math.max(0, Math.min(selectedIndex, items.length - 1));

  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label="Completions"
      className={cn(
        "absolute bottom-full left-0 right-0 mb-1 z-50",
        "max-h-56 overflow-y-auto overscroll-contain",
        "rounded-lg border border-surface-700 bg-surface-900 shadow-xl",
        "py-1",
        className,
      )}
    >
      {items.map((item, i) => {
        const isSelected = i === clamped;
        const label = item.label ?? item.value;

        return (
          <li
            key={item.value}
            ref={isSelected ? selectedRef : undefined}
            role="option"
            aria-selected={isSelected}
            tabIndex={-1}
            onMouseDown={(e) => {
              // Prevent textarea from losing focus
              e.preventDefault();
            }}
            onClick={() => onSelect(item)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer",
              "text-surface-300 hover:bg-surface-800 hover:text-surface-100",
              isSelected && "bg-surface-800 text-surface-100",
              "transition-colors",
            )}
          >
            {/* Icon slot */}
            {item.icon && (
              <span
                className="w-4 text-center flex-shrink-0 text-surface-500"
                aria-hidden="true"
              >
                {item.icon}
              </span>
            )}

            {/* Label */}
            <span className="font-mono truncate flex-1">{label}</span>

            {/* Description */}
            {item.description && (
              <span className="text-surface-500 text-xs truncate max-w-[40%] flex-shrink-0">
                {item.description}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
