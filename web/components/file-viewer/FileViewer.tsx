"use client";

import { useRef, useEffect, useCallback } from "react";
import { useFileViewerStore } from "@/lib/fileViewerStore";
import { FileViewerTabs } from "./FileViewerTabs";
import { CodeDisplay } from "./CodeDisplay";
import { DiffViewer } from "./DiffViewer";
import { FileEditor } from "./FileEditor";
import { FileBreadcrumb } from "./FileBreadcrumb";
import { ImageViewer } from "./ImageViewer";
import { FileInfoBar } from "./FileInfoBar";
import { FileText } from "lucide-react";

export function FileViewer() {
  const { isOpen, tabs, activeTabId, panelWidth, setPanelWidth } =
    useFileViewerStore();

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      startX.current = e.clientX;
      startWidth.current = panelWidth;
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    },
    [panelWidth]
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      // Panel is on the right; dragging left increases width
      const delta = startX.current - e.clientX;
      setPanelWidth(startWidth.current + delta);
    };
    const onMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [setPanelWidth]);

  if (!isOpen) return null;

  return (
    <div
      className="relative flex h-full flex-col bg-surface-900 border-l border-surface-800 overflow-hidden"
      style={{ width: panelWidth, minWidth: 300, maxWidth: 1400 }}
    >
      {/* Resize handle — on the left edge */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 z-10 cursor-ew-resize group"
        onMouseDown={handleResizeStart}
      >
        <div className="absolute inset-y-0 left-0 w-1 group-hover:bg-brand-500/50 transition-colors" />
      </div>

      {/* Tabs */}
      <FileViewerTabs />

      {activeTab ? (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Breadcrumb */}
          <FileBreadcrumb path={activeTab.path} />

          {/* Main content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab.isImage ? (
              <ImageViewer src={activeTab.content} path={activeTab.path} />
            ) : activeTab.mode === "diff" && activeTab.diff ? (
              <DiffViewer
                oldContent={activeTab.diff.oldContent}
                newContent={activeTab.diff.newContent}
                language={activeTab.language}
                tabId={activeTab.id}
              />
            ) : activeTab.mode === "edit" ? (
              <FileEditor tab={activeTab} />
            ) : (
              <CodeDisplay
                content={activeTab.content}
                language={activeTab.language}
                path={activeTab.path}
              />
            )}
          </div>

          {/* Info bar */}
          <FileInfoBar tab={activeTab} />
        </div>
      ) : (
        <div className="flex flex-col flex-1 items-center justify-center gap-3 text-surface-600">
          <FileText className="w-10 h-10" />
          <p className="text-sm">No file open</p>
          <p className="text-xs text-surface-700">Click a file path in chat to open it here</p>
        </div>
      )}
    </div>
  );
}
