"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export function ThinkingBlock({
  content,
  isStreaming = false,
  className,
}: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={cn(
        "my-2 rounded-lg border border-surface-700/50 overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => !isStreaming && setIsExpanded((v) => !v)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 bg-surface-850 text-left transition-colors",
          !isStreaming && "hover:bg-surface-800 cursor-pointer",
          isStreaming && "cursor-default"
        )}
        aria-expanded={!isStreaming ? isExpanded : undefined}
        aria-label={isStreaming ? "Thinking in progress" : isExpanded ? "Collapse thinking" : "Expand thinking"}
      >
        {isStreaming ? (
          /* Animated pulsing dots */
          <span className="flex items-center gap-0.5" aria-hidden>
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" />
          </span>
        ) : (
          <Brain className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" aria-hidden />
        )}

        <span className="text-xs text-surface-400 flex-1 font-medium">
          {isStreaming ? "Thinking…" : "Thinking"}
        </span>

        {!isStreaming && (
          isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" aria-hidden />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" aria-hidden />
          )
        )}
      </button>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {isExpanded && !isStreaming && (
          <motion.div
            key="thinking-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-3 py-2.5 text-xs text-surface-400 font-mono whitespace-pre-wrap leading-relaxed bg-surface-900 border-t border-surface-700/50 max-h-64 overflow-y-auto">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
