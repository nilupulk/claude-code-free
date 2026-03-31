"use client";

import { useEffect, useState } from "react";
import type { Conversation, ExportOptions } from "@/lib/types";
import { toMarkdown } from "@/lib/export/markdown";
import { toJSON } from "@/lib/export/json";
import { toPlainText } from "@/lib/export/plaintext";
import { cn } from "@/lib/utils";

interface ExportPreviewProps {
  conversation: Conversation;
  options: ExportOptions;
}

export function ExportPreview({ conversation, options }: ExportPreviewProps) {
  const [preview, setPreview] = useState<string>("");

  useEffect(() => {
    if (options.format === "pdf") {
      setPreview("PDF preview not available — click Export to open the print dialog.");
      return;
    }
    if (options.format === "html") {
      setPreview("HTML preview not shown here — click Export to download the file.");
      return;
    }

    try {
      let text = "";
      switch (options.format) {
        case "markdown":
          text = toMarkdown(conversation, options);
          break;
        case "json":
          text = toJSON(conversation, options);
          break;
        case "plaintext":
          text = toPlainText(conversation, options);
          break;
      }
      // Show first ~3000 chars in preview
      setPreview(text.length > 3000 ? text.slice(0, 3000) + "\n\n…[preview truncated]" : text);
    } catch {
      setPreview("Preview unavailable.");
    }
  }, [conversation, options]);

  const isInfo = options.format === "pdf" || options.format === "html";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-900 border-b border-surface-700 rounded-t-md">
        <span className="text-xs text-surface-500 font-medium uppercase tracking-wide">Preview</span>
        <span className="text-xs text-surface-600">
          {isInfo ? "" : `~${Math.ceil(preview.length / 1024)} KB`}
        </span>
      </div>
      <pre
        className={cn(
          "flex-1 overflow-auto text-xs font-mono leading-relaxed p-3",
          "bg-surface-900 text-surface-300 rounded-b-md whitespace-pre-wrap break-words",
          isInfo && "text-surface-500 italic"
        )}
      >
        {preview}
      </pre>
    </div>
  );
}
