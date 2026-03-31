"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { codeToHtml } from "shiki";
import { AlignJustify, WrapText, Search, Hash } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { cn } from "@/lib/utils";

interface CodeDisplayProps {
  content: string;
  language: string;
  path: string;
}

// Map our language IDs to Shiki's supported languages
function toShikiLang(lang: string): string {
  const overrides: Record<string, string> = {
    tsx: "tsx",
    jsx: "jsx",
    csharp: "csharp",
    makefile: "makefile",
    dockerfile: "dockerfile",
    text: "text",
  };
  return overrides[lang] ?? lang;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function CodeDisplay({ content, language, path }: CodeDisplayProps) {
  const [html, setHtml] = useState<string>("");
  const [isHighlighting, setIsHighlighting] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [gotoLineValue, setGotoLineValue] = useState("");
  const [showGotoLine, setShowGotoLine] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Highlight code with Shiki
  useEffect(() => {
    let cancelled = false;
    setIsHighlighting(true);

    const lang = toShikiLang(language);

    codeToHtml(content || " ", { lang, theme: "one-dark-pro" })
      .then((result) => {
        if (!cancelled) {
          setHtml(result);
          setIsHighlighting(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = `<pre class="shiki" style="background:#282c34"><code>${escapeHtml(content)}</code></pre>`;
          setHtml(fallback);
          setIsHighlighting(false);
        }
      });

    return () => { cancelled = true; };
  }, [content, language]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        e.preventDefault();
        setShowGotoLine(true);
      }
      if (e.key === "Escape") {
        setShowSearch(false);
        setShowGotoLine(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleGotoLine = (e: React.FormEvent) => {
    e.preventDefault();
    const lineNum = parseInt(gotoLineValue, 10);
    if (!isNaN(lineNum) && containerRef.current) {
      const lines = containerRef.current.querySelectorAll(".line");
      const target = lines[lineNum - 1];
      if (target) {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        (target as HTMLElement).classList.add("line-highlighted");
        setTimeout(() => {
          (target as HTMLElement).classList.remove("line-highlighted");
        }, 1500);
      }
    }
    setShowGotoLine(false);
    setGotoLineValue("");
  };

  return (
    <div className="flex flex-col h-full bg-[#282c34]">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-1 px-2 py-1 border-b border-white/5 bg-black/20">
        <button
          onClick={() => setShowSearch(true)}
          className="p-1 rounded text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
          title="Search (Ctrl+F)"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setShowGotoLine(true)}
          className="p-1 rounded text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
          title="Go to line (Ctrl+G)"
        >
          <Hash className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-white/10 mx-0.5" />
        <button
          onClick={() => setShowLineNumbers((v) => !v)}
          className={cn(
            "p-1 rounded transition-colors",
            showLineNumbers
              ? "text-brand-400 bg-brand-900/40"
              : "text-white/30 hover:text-white/70 hover:bg-white/10"
          )}
          title="Toggle line numbers"
        >
          <AlignJustify className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setWordWrap((v) => !v)}
          className={cn(
            "p-1 rounded transition-colors",
            wordWrap
              ? "text-brand-400 bg-brand-900/40"
              : "text-white/30 hover:text-white/70 hover:bg-white/10"
          )}
          title="Toggle word wrap"
        >
          <WrapText className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Go to line */}
      {showGotoLine && (
        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-surface-800 bg-surface-900/90">
          <form onSubmit={handleGotoLine} className="flex items-center gap-2 flex-1">
            <span className="text-xs text-surface-400">Go to line:</span>
            <input
              autoFocus
              type="number"
              value={gotoLineValue}
              onChange={(e) => setGotoLineValue(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setShowGotoLine(false)}
              placeholder="Line number"
              className="bg-surface-800 text-xs text-surface-100 rounded px-2 py-1 outline-none w-28 placeholder-surface-500"
            />
            <button
              type="submit"
              className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-2 py-1 rounded transition-colors"
            >
              Go
            </button>
          </form>
        </div>
      )}

      {/* Search bar */}
      {showSearch && (
        <SearchBar
          content={content}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Code */}
      <div
        ref={containerRef}
        className={cn(
          "flex-1 overflow-auto relative",
          wordWrap && "overflow-x-hidden"
        )}
      >
        {isHighlighting ? (
          <div className="p-4 text-white/20 text-xs font-mono animate-pulse">
            Loading...
          </div>
        ) : (
          <div
            className={cn(
              "shiki-container h-full",
              showLineNumbers && "show-line-numbers",
              wordWrap && "word-wrap-code"
            )}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}
