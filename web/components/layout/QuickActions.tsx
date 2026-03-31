"use client";

import { useEffect } from "react";
import { useChatStore } from "@/lib/store";

const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "Command palette" },
  { keys: ["⌘", "N"], label: "New chat" },
  { keys: ["⌘", "⇧", "F"], label: "Search" },
  { keys: ["⌘", "/"], label: "Toggle sidebar" },
] as const;

export function QuickActions() {
  const { createConversation, toggleSidebar, openSearch } = useChatStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        createConversation();
      } else if (e.key === "/") {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("open-command-palette"));
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("open-quick-file"));
      } else if ((e.key === "f" || e.key === "F") && e.shiftKey) {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [createConversation, toggleSidebar, openSearch]);

  return (
    <div className="px-3 py-3 border-t border-surface-800 flex-shrink-0 space-y-1.5">
      <p className="text-xs text-surface-600 font-medium uppercase tracking-wider mb-2">
        Shortcuts
      </p>
      {SHORTCUTS.map(({ keys, label }) => (
        <div key={label} className="flex items-center justify-between text-xs">
          <span className="text-surface-500">{label}</span>
          <div className="flex items-center gap-0.5">
            {keys.map((key) => (
              <kbd
                key={key}
                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-surface-800 border border-surface-700 text-surface-400 font-mono text-xs leading-none"
              >
                {key}
              </kbd>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
