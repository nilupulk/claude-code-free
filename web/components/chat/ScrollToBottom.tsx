"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollToBottomProps {
  visible: boolean;
  onClick: () => void;
  unreadCount?: number;
  className?: string;
}

export function ScrollToBottom({
  visible,
  onClick,
  unreadCount,
  className,
}: ScrollToBottomProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          onClick={onClick}
          aria-label="Scroll to bottom"
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
            "bg-surface-800 border border-surface-700 shadow-lg",
            "text-surface-300 text-xs hover:bg-surface-700 hover:border-surface-600",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            className
          )}
        >
          {unreadCount ? (
            <span className="text-brand-400 font-medium">{unreadCount} new</span>
          ) : null}
          <ArrowDown className="w-3.5 h-3.5" aria-hidden />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
