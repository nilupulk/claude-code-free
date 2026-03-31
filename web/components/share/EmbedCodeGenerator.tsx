"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import * as Select from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";

interface EmbedCodeGeneratorProps {
  shareUrl: string;
  shareId: string;
}

type Theme = "dark" | "light";

export function EmbedCodeGenerator({ shareUrl, shareId }: EmbedCodeGeneratorProps) {
  const [height, setHeight]       = useState(480);
  const [theme, setTheme]         = useState<Theme>("dark");
  const [showToolUse, setShowToolUse] = useState(true);
  const [copied, setCopied]       = useState(false);

  const embedUrl = `${shareUrl}?embed=1&theme=${theme}&toolUse=${showToolUse}`;
  const iframeCode = `<iframe
  src="${embedUrl}"
  width="100%"
  height="${height}"
  style="border:none;border-radius:12px;overflow:hidden;"
  title="Claude Code Conversation"
  loading="lazy"
></iframe>`;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(iframeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [iframeCode]);

  return (
    <div className="flex flex-col gap-3 p-3 bg-surface-800/50 rounded-lg border border-surface-700">
      <p className="text-xs font-medium text-surface-400 uppercase tracking-wide">Embed Code</p>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-2">
        {/* Height */}
        <div>
          <label className="text-xs text-surface-500 block mb-1">Height (px)</label>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            min={200}
            max={1200}
            step={40}
            className="w-full px-2 py-1.5 rounded bg-surface-800 border border-surface-700 text-xs text-surface-200 focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Theme */}
        <div>
          <label className="text-xs text-surface-500 block mb-1">Theme</label>
          <Select.Root value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            <Select.Trigger className="flex items-center justify-between w-full px-2 py-1.5 rounded bg-surface-800 border border-surface-700 text-xs text-surface-200 focus:outline-none focus:border-brand-500">
              <Select.Value />
              <Select.Icon><ChevronDown className="w-3 h-3 text-surface-500" /></Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="z-[70] bg-surface-800 border border-surface-700 rounded-lg shadow-xl overflow-hidden">
                <Select.Viewport className="p-1">
                  {(["dark", "light"] as Theme[]).map((t) => (
                    <Select.Item
                      key={t}
                      value={t}
                      className="flex items-center px-3 py-1.5 text-xs text-surface-200 rounded cursor-pointer hover:bg-surface-700 focus:bg-surface-700 focus:outline-none data-[state=checked]:text-brand-300"
                    >
                      <Select.ItemText>{t.charAt(0).toUpperCase() + t.slice(1)}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>
      </div>

      {/* Show tool use toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showToolUse}
          onChange={(e) => setShowToolUse(e.target.checked)}
          className="w-3.5 h-3.5 rounded accent-brand-500"
        />
        <span className="text-xs text-surface-400">Show tool use blocks</span>
      </label>

      {/* Code */}
      <div className="relative">
        <pre className="text-xs font-mono text-surface-400 bg-surface-900 rounded p-2.5 overflow-x-auto whitespace-pre">
          {iframeCode}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1 rounded bg-surface-800 text-surface-500 hover:text-surface-200 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
