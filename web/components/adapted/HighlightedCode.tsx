"use client";

/**
 * Web-adapted HighlightedCode.
 *
 * The terminal HighlightedCode (src/components/HighlightedCode.tsx) uses a
 * native Rust/NAPI ColorFile module to render syntax-highlighted ANSI output
 * inside Ink's <Ansi> / <Box>.  In the browser we delegate to the existing
 * SyntaxHighlight component (shiki-powered) and strip any residual ANSI codes
 * that might arrive from the server before rendering.
 *
 * Props are intentionally compatible with the terminal version so callers can
 * swap between them via the platform conditional.
 */

import * as React from "react";
import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SyntaxHighlight, getLanguageFromPath } from "../tools/SyntaxHighlight";
import { stripAnsi } from "@/lib/ansi-to-html";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HighlightedCodeProps {
  /** Raw code string (may contain ANSI codes from server). */
  code: string;
  /** File path used for language detection (e.g. "src/foo.ts"). */
  filePath: string;
  /** Optional explicit width — ignored in web (container fills available space). */
  width?: number;
  /** When true, renders at reduced opacity to indicate inactive/secondary content. */
  dim?: boolean;
  /** Maximum lines to show before collapsing. Default: 50. */
  maxLines?: number;
  /** Extra class names for the wrapper element. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HighlightedCode({
  code,
  filePath,
  dim = false,
  maxLines = 50,
  className,
}: HighlightedCodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Strip ANSI codes that may be embedded in server-side output
  const cleanCode = stripAnsi(code);
  const lang = getLanguageFromPath(filePath);

  const lines = cleanCode.split("\n");
  const isLong = lines.length > maxLines;
  const visibleCode =
    isLong && !expanded ? lines.slice(0, maxLines).join("\n") : cleanCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden border border-surface-700 font-mono text-xs",
        dim && "opacity-60",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-800 border-b border-surface-700">
        <span className="text-surface-400 text-xs truncate max-w-[70%]">
          {filePath}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-surface-600 text-xs uppercase tracking-wide">
            {lang}
          </span>
          <button
            onClick={handleCopy}
            className="p-1 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors"
            aria-label="Copy code"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Code body */}
      <div
        className={cn(
          "overflow-x-auto bg-surface-900",
          "[&_pre]:!m-0 [&_pre]:!rounded-none [&_pre]:!border-0",
          "[&_code]:!text-xs [&_code]:!leading-5"
        )}
      >
        <SyntaxHighlight
          code={visibleCode}
          lang={lang}
          theme="github-dark"
          className="text-xs"
        />
      </div>

      {/* Expand / collapse control */}
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "w-full flex items-center justify-center gap-1 py-1.5",
            "bg-surface-800 border-t border-surface-700",
            "text-xs text-surface-400 hover:text-surface-200 hover:bg-surface-700/80 transition-colors"
          )}
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" aria-hidden />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" aria-hidden />
              {lines.length - maxLines} more lines
            </>
          )}
        </button>
      )}
    </div>
  );
}
