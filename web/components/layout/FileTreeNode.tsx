"use client";

import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  Copy,
  ExternalLink,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import type { FileNode, GitFileStatus } from "@/lib/types";

interface FileTreeNodeProps {
  node: FileNode;
  depth?: number;
  onFileClick?: (path: string) => void;
}

const GIT_STATUS_STYLES: Record<GitFileStatus, { dot: string; label: string }> = {
  M: { dot: "bg-yellow-500", label: "Modified" },
  A: { dot: "bg-green-500", label: "Added" },
  "?": { dot: "bg-surface-400", label: "Untracked" },
  D: { dot: "bg-red-500", label: "Deleted" },
  R: { dot: "bg-blue-400", label: "Renamed" },
};

// File extension → color class for icon tinting
function getFileColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "text-blue-400",
    tsx: "text-blue-400",
    js: "text-yellow-400",
    jsx: "text-yellow-400",
    json: "text-yellow-300",
    md: "text-surface-300",
    mdx: "text-surface-300",
    css: "text-pink-400",
    scss: "text-pink-400",
    html: "text-orange-400",
    py: "text-green-400",
    go: "text-cyan-400",
    rs: "text-orange-500",
    sh: "text-green-300",
    yml: "text-red-400",
    yaml: "text-red-400",
    toml: "text-red-400",
    env: "text-surface-500",
    lock: "text-surface-600",
    svg: "text-purple-400",
    png: "text-purple-300",
    jpg: "text-purple-300",
    gif: "text-purple-300",
  };
  return map[ext] ?? "text-surface-400";
}

export function FileTreeNode({ node, depth = 0, onFileClick }: FileTreeNodeProps) {
  const [isOpen, setIsOpen] = useState(depth < 2);

  const isDir = node.type === "directory";
  const indent = depth * 12;

  const gitInfo = node.gitStatus ? GIT_STATUS_STYLES[node.gitStatus] : null;

  const handleClick = () => {
    if (isDir) {
      setIsOpen((prev) => !prev);
    } else {
      onFileClick?.(node.path);
    }
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(node.path);
  };

  const handleInsertRef = () => {
    // Insert as @path reference in active input — emit a custom event
    window.dispatchEvent(
      new CustomEvent("insert-file-reference", { detail: { path: node.path } })
    );
  };

  return (
    <div>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => e.key === "Enter" && handleClick()}
            style={{ paddingLeft: indent + 8 }}
            className={cn(
              "group flex items-center gap-1.5 py-1 pr-2 rounded-sm cursor-pointer",
              "text-sm text-surface-300 hover:bg-surface-800/60 hover:text-surface-100",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500",
              "transition-colors"
            )}
            aria-expanded={isDir ? isOpen : undefined}
          >
            {/* Expand chevron for dirs */}
            <span className="w-3.5 flex-shrink-0 flex items-center justify-center">
              {isDir ? (
                isOpen ? (
                  <ChevronDown className="w-3 h-3 text-surface-500" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-surface-500" aria-hidden="true" />
                )
              ) : null}
            </span>

            {/* File/folder icon */}
            {isDir ? (
              isOpen ? (
                <FolderOpen className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" aria-hidden="true" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" aria-hidden="true" />
              )
            ) : (
              <File
                className={cn("w-3.5 h-3.5 flex-shrink-0", getFileColor(node.name))}
                aria-hidden="true"
              />
            )}

            {/* Name */}
            <span className="truncate flex-1 leading-tight">{node.name}</span>

            {/* Git status dot */}
            {gitInfo && (
              <span
                className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 ml-auto", gitInfo.dot)}
                title={gitInfo.label}
                aria-label={gitInfo.label}
              />
            )}
          </div>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={cn(
              "z-50 min-w-[160px] rounded-md border border-surface-700 bg-surface-800 p-1",
              "shadow-lg shadow-black/30 text-sm animate-fade-in"
            )}
            sideOffset={4}
          >
            <DropdownMenu.Item
              onSelect={handleCopyPath}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer text-surface-200",
                "hover:bg-surface-700 hover:text-surface-100 focus:outline-none focus:bg-surface-700 transition-colors"
              )}
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              Copy path
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={handleInsertRef}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer text-surface-200",
                "hover:bg-surface-700 hover:text-surface-100 focus:outline-none focus:bg-surface-700 transition-colors"
              )}
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              Insert as reference
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Children */}
      {isDir && isOpen && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
