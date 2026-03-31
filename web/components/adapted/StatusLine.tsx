"use client";

/**
 * Web-adapted StatusLine.
 *
 * The terminal StatusLine (src/components/StatusLine.tsx) is a complex
 * component that: executes a shell hook command, reads terminal-specific
 * state (AppState, cost-tracker, worktree, vim mode, etc.), and renders
 * ANSI-coloured text in Ink's <Box>/<Ansi>.
 *
 * This web version surfaces the same conceptual information — model, working
 * directory, context usage, cost — sourced from the web Zustand store and
 * standard browser APIs.  It renders as a slim footer bar that mimics the
 * terminal status line aesthetic with a monospace font and subtle dividers.
 */

import * as React from "react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/store";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StatusLineProps {
  /** Override the displayed model name. Falls back to store value. */
  model?: string;
  /** Current working directory label. */
  cwd?: string;
  /** Context window usage 0–1 fraction. */
  contextUsed?: number;
  /** Total cost in USD for the session. */
  totalCostUsd?: number;
  /** Vim mode indicator ("NORMAL" | "INSERT" | "VISUAL"). */
  vimMode?: string;
  /** Extra class names for the bar. */
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 100).toFixed(2)}¢`;
  return `$${usd.toFixed(4)}`;
}

function ContextBar({ fraction }: { fraction: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  const barColor =
    pct >= 90
      ? "bg-red-500"
      : pct >= 70
      ? "bg-yellow-500"
      : "bg-brand-500";

  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`Context window ${pct}% used`}
      title={`Context window ${pct}% used`}
    >
      <span className="w-16 h-1.5 rounded-full bg-surface-700 overflow-hidden inline-block align-middle">
        <span
          className={cn("h-full rounded-full block transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-surface-400">{pct}%</span>
    </span>
  );
}

function Divider() {
  return <span className="text-surface-700 select-none">·</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StatusLine({
  model: modelProp,
  cwd,
  contextUsed,
  totalCostUsd,
  vimMode,
  className,
}: StatusLineProps) {
  const { settings, conversations, activeConversationId } = useChatStore();

  const model = modelProp ?? settings.model;

  // Derive token totals from active conversation messages
  const { inputTokens, outputTokens } = useMemo(() => {
    const conv = conversations.find((c) => c.id === activeConversationId);
    let input = 0;
    let output = 0;
    for (const msg of conv?.messages ?? []) {
      if (msg.usage) {
        input += msg.usage.input_tokens;
        output += msg.usage.output_tokens;
      }
    }
    return { inputTokens: input, outputTokens: output };
  }, [conversations, activeConversationId]);

  const totalTokens = inputTokens + outputTokens;

  return (
    <footer
      className={cn(
        "flex items-center gap-2 px-3 py-1",
        "bg-surface-950 border-t border-surface-800",
        "font-mono text-xs text-surface-500 select-none overflow-x-auto whitespace-nowrap",
        className
      )}
      role="status"
      aria-label="Session status"
    >
      {/* Model */}
      <span className="text-brand-400 font-medium">{model}</span>

      <Divider />

      {/* CWD */}
      {cwd && (
        <>
          <span
            className="text-surface-400 max-w-[20ch] truncate"
            title={cwd}
            aria-label={`Working directory: ${cwd}`}
          >
            {cwd}
          </span>
          <Divider />
        </>
      )}

      {/* Token count */}
      {totalTokens > 0 && (
        <>
          <span title={`${inputTokens} in · ${outputTokens} out`}>
            {totalTokens.toLocaleString()} tokens
          </span>
          <Divider />
        </>
      )}

      {/* Context window usage bar */}
      {contextUsed !== undefined && (
        <>
          <ContextBar fraction={contextUsed} />
          <Divider />
        </>
      )}

      {/* Cost */}
      {totalCostUsd !== undefined && totalCostUsd > 0 && (
        <>
          <span title="Session cost">{formatCost(totalCostUsd)}</span>
          <Divider />
        </>
      )}

      {/* Vim mode */}
      {vimMode && (
        <span
          className={cn(
            "px-1 rounded text-xs font-bold",
            vimMode === "NORMAL"
              ? "bg-brand-900/60 text-brand-300"
              : vimMode === "VISUAL"
              ? "bg-purple-900/60 text-purple-300"
              : "text-surface-400"
          )}
          aria-label={`Vim mode: ${vimMode}`}
        >
          {vimMode}
        </span>
      )}

      {/* Spacer pushes right-side items to the end */}
      <span className="flex-1" aria-hidden />

      {/* Active conversation message count */}
      {activeConversationId && (
        <span className="text-surface-600">
          {conversations.find((c) => c.id === activeConversationId)?.messages
            .length ?? 0}{" "}
          msgs
        </span>
      )}
    </footer>
  );
}
