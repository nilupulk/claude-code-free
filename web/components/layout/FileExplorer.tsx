"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Eye, EyeOff, ChevronRight, FolderOpen } from "lucide-react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";
import { FileTreeNode } from "./FileTreeNode";
import type { FileNode } from "@/lib/types";

interface FileTreeResponse {
  tree: FileNode[];
  root: string;
  breadcrumbs: string[];
}

function filterTree(nodes: FileNode[], query: string): FileNode[] {
  const q = query.toLowerCase();
  return nodes.reduce<FileNode[]>((acc, node) => {
    if (node.type === "directory" && node.children) {
      const filtered = filterTree(node.children, query);
      if (filtered.length > 0 || node.name.toLowerCase().includes(q)) {
        acc.push({ ...node, children: filtered });
      }
    } else if (node.name.toLowerCase().includes(q)) {
      acc.push(node);
    }
    return acc;
  }, []);
}

export function FileExplorer() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [root, setRoot] = useState("");
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showIgnored, setShowIgnored] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTree = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ showIgnored: String(showIgnored) });
      const res = await fetch(`/api/files?${params}`);
      if (!res.ok) throw new Error(`Failed to load files (${res.status})`);
      const data: FileTreeResponse = await res.json();
      setTree(data.tree);
      setRoot(data.root);
      setBreadcrumbs(data.breadcrumbs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setIsLoading(false);
    }
  }, [showIgnored]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const displayedTree = searchQuery ? filterTree(tree, searchQuery) : tree;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Breadcrumb */}
      <div className="px-3 pt-3 pb-1.5 flex-shrink-0">
        <div className="flex items-center gap-1 text-xs text-surface-500 overflow-hidden">
          <FolderOpen className="w-3 h-3 flex-shrink-0 text-brand-400" aria-hidden="true" />
          {breadcrumbs.length > 0
            ? breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1 min-w-0">
                  {i > 0 && (
                    <ChevronRight className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate" title={crumb}>
                    {crumb}
                  </span>
                </span>
              ))
            : root && (
                <span className="truncate font-mono" title={root}>
                  {root.split("/").pop() || root}
                </span>
              )}
        </div>
      </div>

      {/* Search + controls */}
      <div className="px-3 pb-2 space-y-2 flex-shrink-0">
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Filter files…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full pl-8 pr-3 py-1.5 text-sm rounded-md",
              "bg-surface-800 border border-surface-700 text-surface-200",
              "placeholder:text-surface-500",
              "focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-colors"
            )}
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowIgnored((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-300 transition-colors"
          >
            {showIgnored ? (
              <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {showIgnored ? "Hide ignored" : "Show ignored"}
          </button>
          <button
            onClick={fetchTree}
            disabled={isLoading}
            aria-label="Refresh file tree"
            className="p-1 rounded text-surface-500 hover:text-surface-300 hover:bg-surface-800/60 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Git status legend */}
      <div className="px-3 pb-2 flex items-center gap-3 flex-shrink-0">
        {(
          [
            { color: "bg-yellow-500", label: "Modified" },
            { color: "bg-green-500", label: "Added" },
            { color: "bg-surface-400", label: "Untracked" },
          ] as const
        ).map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1 text-xs text-surface-600">
            <span className={cn("w-1.5 h-1.5 rounded-full", color)} />
            {label}
          </span>
        ))}
      </div>

      {/* File tree */}
      <ScrollArea.Root className="flex-1 min-h-0 border-t border-surface-800">
        <ScrollArea.Viewport className="h-full w-full py-1">
          {isLoading && !tree.length ? (
            <div className="px-4 py-8 text-center">
              <RefreshCw className="w-5 h-5 text-surface-600 animate-spin mx-auto" aria-hidden="true" />
              <p className="text-surface-500 text-xs mt-2">Loading files…</p>
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center space-y-2">
              <p className="text-red-400 text-xs">{error}</p>
              <button
                onClick={fetchTree}
                className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : displayedTree.length === 0 ? (
            <p className="px-4 py-8 text-center text-surface-500 text-xs">
              {searchQuery ? `No files matching "${searchQuery}"` : "No files found"}
            </p>
          ) : (
            displayedTree.map((node) => (
              <FileTreeNode
                key={node.path}
                node={node}
                depth={0}
                onFileClick={(path) => {
                  window.dispatchEvent(new CustomEvent("open-file", { detail: { path } }));
                }}
              />
            ))
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar
          orientation="vertical"
          className="flex w-1.5 touch-none select-none p-px"
        >
          <ScrollArea.Thumb className="relative flex-1 rounded-full bg-surface-700 hover:bg-surface-600" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}
