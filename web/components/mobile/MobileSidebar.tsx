"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/Sidebar";
import { useTouchGesture } from "@/hooks/useTouchGesture";
import { useChatStore } from "@/lib/store";

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Slide-in drawer sidebar for mobile / tablet.
 * - Opens from the left as an overlay
 * - Swipe left or tap backdrop to close
 * - Auto-closes when the active conversation changes (user tapped a chat)
 * - Traps body scroll while open
 * - Closes on Escape key
 */
export function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const { activeConversationId } = useChatStore();
  const prevConvId = useRef(activeConversationId);

  // Auto-close when the user taps a conversation in the sidebar
  useEffect(() => {
    if (activeConversationId !== prevConvId.current) {
      prevConvId.current = activeConversationId;
      if (isOpen) onClose();
    }
  }, [activeConversationId, isOpen, onClose]);

  // Swipe left on the drawer to close
  const swipeHandlers = useTouchGesture({ onSwipeLeft: onClose });

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 lg:hidden",
          "transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 left-0 bottom-0 z-50 w-72 lg:hidden",
          "transition-transform duration-300 ease-in-out"
        )}
        style={{ transform: isOpen ? "translateX(0)" : "translateX(-100%)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        {...swipeHandlers}
      >
        <Sidebar />
      </div>
    </>
  );
}
