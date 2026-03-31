"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, Check, WrapText } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ code, language = "text", className }: CodeBlockProps) {
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);

  const lang = language === "text" ? "plaintext" : language;

  useEffect(() => {
    let cancelled = false;
    import("shiki")
      .then(({ codeToHtml }) =>
        codeToHtml(code, {
          lang,
          theme: "github-dark",
        })
      )
      .then((result) => {
        if (!cancelled) setHtml(result);
      })
      .catch(() => {
        // Fallback to plain display on unsupported language
        if (!cancelled) setHtml("");
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }, [code]);

  return (
    <div
      className={cn(
        "relative group my-3 rounded-lg overflow-hidden border border-surface-700 bg-[#0d1117]",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-850 border-b border-surface-700">
        <span className="text-xs text-surface-500 font-mono select-none">
          {language || "text"}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setWordWrap((v) => !v)}
            title="Toggle word wrap"
            aria-label="Toggle word wrap"
            className={cn(
              "p-1 rounded text-xs transition-colors",
              wordWrap
                ? "text-brand-400 bg-brand-950/30"
                : "text-surface-500 hover:text-surface-300"
            )}
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy code"}
            aria-label={copied ? "Copied" : "Copy code"}
            className="p-1 rounded text-surface-500 hover:text-surface-300 transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Code content */}
      <div
        className={cn(
          "overflow-x-auto text-sm font-mono",
          wordWrap && "whitespace-pre-wrap break-all overflow-x-hidden"
        )}
      >
        {html ? (
          <div
            dangerouslySetInnerHTML={{ __html: html }}
            className="[&>pre]:!p-4 [&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:!overflow-visible [&>pre]:!rounded-none [&>pre]:!border-none"
          />
        ) : (
          <pre className="p-4 text-surface-300 bg-[#0d1117]">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
