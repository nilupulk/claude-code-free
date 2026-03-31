"use client";

import { useRef, useEffect } from "react";
import { X, XCircle, PanelRightClose } from "lucide-react";
import { useFileViewerStore } from "@/lib/fileViewerStore";
import { cn } from "@/lib/utils";

export function FileViewerTabs() {
  const { tabs, activeTabId, setActiveTab, closeTab, closeAllTabs, setOpen } =
    useFileViewerStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll active tab into view when it changes
  useEffect(() => {
    if (!scrollRef.current || !activeTabId) return;
    const el = scrollRef.current.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeTabId]);

  return (
    <div className="flex items-center border-b border-surface-800 bg-surface-950 min-h-[36px] flex-shrink-0">
      {/* Scrollable tab list */}
      <div
        ref={scrollRef}
        className="flex flex-1 min-w-0 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-tab-id={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "group flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap",
              "border-r border-surface-800 transition-colors shrink-0 max-w-[180px]",
              activeTabId === tab.id
                ? "bg-surface-800 text-surface-100 border-b border-b-brand-500"
                : "text-surface-500 hover:text-surface-200 hover:bg-surface-850"
            )}
          >
            {/* Dirty indicator */}
            {tab.isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
            )}

            {/* Filename */}
            <span className="truncate">{tab.filename}</span>

            {/* Diff badge */}
            {tab.mode === "diff" && (
              <span className="text-[10px] bg-brand-900/60 text-brand-300 px-1 rounded shrink-0">
                diff
              </span>
            )}

            {/* Close button */}
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className={cn(
                "ml-auto p-0.5 rounded transition-colors shrink-0",
                "opacity-0 group-hover:opacity-100",
                activeTabId === tab.id && "opacity-60",
                "hover:opacity-100 hover:bg-surface-700 hover:text-surface-100 text-surface-500"
              )}
              title="Close tab"
            >
              <X className="w-3 h-3" />
            </span>
          </button>
        ))}
      </div>

      {/* Panel actions */}
      <div className="flex items-center px-1.5 border-l border-surface-800 gap-0.5 shrink-0">
        {tabs.length > 1 && (
          <button
            onClick={closeAllTabs}
            className="p-1 rounded text-surface-600 hover:text-surface-300 hover:bg-surface-800 transition-colors"
            title="Close all tabs"
          >
            <XCircle className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => setOpen(false)}
          className="p-1 rounded text-surface-600 hover:text-surface-300 hover:bg-surface-800 transition-colors"
          title="Close panel"
        >
          <PanelRightClose className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
