"use client";

/**
 * Web-adapted StructuredDiff.
 *
 * The terminal StructuredDiff (src/components/StructuredDiff.tsx) uses a
 * native Rust/NAPI ColorDiff module that renders ANSI-coloured diff lines
 * inside Ink's <RawAnsi> / <Box>.  In the browser we delegate to the existing
 * DiffView component (LCS-based, pure JS) and bridge between the two APIs.
 *
 * Two usage patterns are supported:
 *   1. Pass `patch` (a StructuredPatchHunk from the `diff` npm package) —
 *      matches the terminal component's props interface exactly.
 *   2. Pass `oldContent` + `newContent` strings for simpler call sites that
 *      don't have a pre-parsed patch object.
 */

import * as React from "react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { DiffView } from "../tools/DiffView";
import { getLanguageFromPath } from "../tools/SyntaxHighlight";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal shape of diff.StructuredPatchHunk used here. */
export interface PatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

/** Props that mirror src/components/StructuredDiff.tsx */
export interface StructuredDiffProps {
  /** Pre-parsed patch hunk from the `diff` package. */
  patch?: PatchHunk;
  /** Alternative: raw old file content (used when patch is not available). */
  oldContent?: string;
  /** Alternative: raw new file content. */
  newContent?: string;
  /** When true, renders at reduced opacity. */
  dim?: boolean;
  /** File path for language detection and display. */
  filePath?: string;
  /** Width prop — ignored in web (container fills available space). */
  width?: number;
  /** Whether to skip syntax highlighting (passed through to DiffView). */
  skipHighlighting?: boolean;
  /** Extra class names. */
  className?: string;
}

// ─── Patch → old/new strings ─────────────────────────────────────────────────

/**
 * Reconstruct old and new file content from a patch hunk's lines array.
 * Lines prefixed with "-" are removals (old only), "+" are additions (new only),
 * and " " (space) are context lines (both sides).
 */
function hunkToOldNew(patch: PatchHunk): { old: string; new: string } {
  const oldLines: string[] = [];
  const newLines: string[] = [];

  for (const line of patch.lines) {
    if (line.startsWith("-")) {
      oldLines.push(line.slice(1));
    } else if (line.startsWith("+")) {
      newLines.push(line.slice(1));
    } else {
      // Context line (starts with " " or is empty)
      const content = line.startsWith(" ") ? line.slice(1) : line;
      oldLines.push(content);
      newLines.push(content);
    }
  }

  return { old: oldLines.join("\n"), new: newLines.join("\n") };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StructuredDiff({
  patch,
  oldContent,
  newContent,
  dim = false,
  filePath = "",
  className,
}: StructuredDiffProps) {
  const { derivedOld, derivedNew } = useMemo(() => {
    if (patch) {
      const { old: o, new: n } = hunkToOldNew(patch);
      return { derivedOld: o, derivedNew: n };
    }
    return {
      derivedOld: oldContent ?? "",
      derivedNew: newContent ?? "",
    };
  }, [patch, oldContent, newContent]);

  const lang = filePath ? getLanguageFromPath(filePath) : "text";

  return (
    <div className={cn(dim && "opacity-60", className)}>
      {filePath && (
        <div className="px-3 py-1 bg-surface-800 border border-b-0 border-surface-700 rounded-t-lg">
          <span className="text-surface-400 text-xs font-mono truncate">
            {filePath}
          </span>
        </div>
      )}
      <DiffView
        oldContent={derivedOld}
        newContent={derivedNew}
        lang={lang}
        className={filePath ? "rounded-t-none" : undefined}
      />
    </div>
  );
}
