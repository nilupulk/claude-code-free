"use client";

import { useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Download, Copy, X, Check, Printer } from "lucide-react";
import type { Conversation, ExportOptions, ExportFormat } from "@/lib/types";
import { FormatSelector } from "./FormatSelector";
import { ExportOptionsPanel } from "./ExportOptions";
import { ExportPreview } from "./ExportPreview";
import { toMarkdown } from "@/lib/export/markdown";
import { toJSON } from "@/lib/export/json";
import { toPlainText } from "@/lib/export/plaintext";
import { toHTML } from "@/lib/export/html";

const DEFAULT_OPTIONS: ExportOptions = {
  format: "markdown",
  includeToolUse: true,
  includeThinking: false,
  includeTimestamps: true,
  includeFileContents: false,
};

interface ExportDialogProps {
  conversation: Conversation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ conversation, open, onOpenChange }: ExportDialogProps) {
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_OPTIONS);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const updateOptions = useCallback((patch: Partial<ExportOptions>) => {
    setOptions((prev) => ({ ...prev, ...patch }));
  }, []);

  const getContent = useCallback((): string => {
    switch (options.format) {
      case "markdown": return toMarkdown(conversation, options);
      case "json":     return toJSON(conversation, options);
      case "html":     return toHTML(conversation, options);
      case "plaintext": return toPlainText(conversation, options);
      default:         return "";
    }
  }, [conversation, options]);

  const handleDownload = useCallback(async () => {
    if (options.format === "pdf") {
      window.print();
      return;
    }

    setDownloading(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation, options }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? `conversation.${EXT[options.format]}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [conversation, options]);

  const handleCopy = useCallback(async () => {
    const content = getContent();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [getContent]);

  const canCopy = options.format !== "pdf" && options.format !== "html";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-describedby="export-dialog-description"
        >
          <div className="bg-surface-900 border border-surface-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
              <div>
                <Dialog.Title className="text-base font-semibold text-surface-100">
                  Export Conversation
                </Dialog.Title>
                <p id="export-dialog-description" className="text-xs text-surface-500 mt-0.5 truncate max-w-md">
                  {conversation.title}
                </p>
              </div>
              <Dialog.Close className="p-1.5 rounded-md text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>

            {/* Body */}
            <div className="flex flex-1 min-h-0 gap-0 divide-x divide-surface-800">
              {/* Left: format + options */}
              <div className="w-72 flex-shrink-0 flex flex-col gap-4 p-4 overflow-y-auto">
                <div>
                  <p className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-2">Format</p>
                  <FormatSelector
                    value={options.format}
                    onChange={(format: ExportFormat) => updateOptions({ format })}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-1">Options</p>
                  <ExportOptionsPanel options={options} onChange={updateOptions} />
                </div>
              </div>

              {/* Right: preview */}
              <div className="flex-1 min-w-0 flex flex-col p-4">
                <ExportPreview conversation={conversation} options={options} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-surface-800">
              {canCopy && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 hover:text-surface-100 transition-colors"
                >
                  {copied ? (
                    <><Check className="w-3.5 h-3.5 text-green-400" />Copied</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" />Copy</>
                  )}
                </button>
              )}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-60 transition-colors"
              >
                {options.format === "pdf" ? (
                  <><Printer className="w-3.5 h-3.5" />Print / Save PDF</>
                ) : (
                  <><Download className="w-3.5 h-3.5" />{downloading ? "Exporting…" : "Export"}</>
                )}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const EXT: Record<string, string> = {
  markdown: "md",
  json: "json",
  html: "html",
  plaintext: "txt",
};
