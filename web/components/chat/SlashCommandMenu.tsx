"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: "clear", description: "Clear the current conversation", usage: "/clear" },
  { name: "compact", description: "Compact the conversation history", usage: "/compact" },
  { name: "help", description: "Show available commands", usage: "/help" },
  { name: "model", description: "Switch the current model", usage: "/model <name>" },
  { name: "export", description: "Export conversation to a file", usage: "/export [format]" },
  { name: "share", description: "Share the current conversation", usage: "/share" },
  { name: "retry", description: "Retry the last message", usage: "/retry" },
];

interface SlashCommandMenuProps {
  query: string;
  visible: boolean;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}

export function SlashCommandMenu({
  query,
  visible,
  onSelect,
  onClose,
}: SlashCommandMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = SLASH_COMMANDS.filter((c) =>
    c.name.toLowerCase().startsWith(query.toLowerCase())
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!visible || filtered.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (filtered[activeIndex]) onSelect(filtered[activeIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [visible, filtered, activeIndex, onSelect, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const active = menu.querySelector<HTMLButtonElement>(`[data-idx="${activeIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <AnimatePresence>
      {visible && filtered.length > 0 && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
          className="absolute bottom-full mb-1.5 left-0 right-0 bg-surface-800 border border-surface-700 rounded-xl shadow-xl overflow-hidden z-50 max-h-48 overflow-y-auto"
          role="listbox"
          aria-label="Slash commands"
        >
          <div className="p-1">
            {filtered.map((cmd, i) => (
              <button
                key={cmd.name}
                data-idx={i}
                role="option"
                aria-selected={i === activeIndex}
                onClick={() => onSelect(cmd)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                  i === activeIndex
                    ? "bg-brand-600/20 text-surface-100"
                    : "hover:bg-surface-700 text-surface-300"
                )}
              >
                <span className="text-xs font-mono text-brand-400 flex-shrink-0 w-24 truncate">
                  /{cmd.name}
                </span>
                <span className="text-xs text-surface-400 flex-1 truncate">
                  {cmd.description}
                </span>
                <kbd className="text-xs text-surface-600 font-mono hidden sm:inline">
                  {cmd.usage}
                </kbd>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
