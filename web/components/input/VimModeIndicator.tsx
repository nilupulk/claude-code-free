"use client";

import { type VimState } from "@/lib/input/vim-adapter";
import { cn } from "@/lib/utils";

interface VimModeIndicatorProps {
  state: VimState;
  className?: string;
}

const MODE_LABEL: Record<VimState["mode"], string> = {
  INSERT: "INSERT",
  NORMAL: "NORMAL",
  VISUAL: "VISUAL",
  COMMAND: "COMMAND",
};

const MODE_STYLES: Record<VimState["mode"], string> = {
  INSERT: "text-brand-400 border-brand-500/50",
  NORMAL: "text-emerald-400 border-emerald-500/50",
  VISUAL: "text-amber-400 border-amber-500/50",
  COMMAND: "text-purple-400 border-purple-500/50",
};

/**
 * Slim status-line indicator that shows the current vim mode.
 * Displayed above the input area when vim mode is active.
 */
export function VimModeIndicator({ state, className }: VimModeIndicatorProps) {
  const label = MODE_LABEL[state.mode];
  const modeStyle = MODE_STYLES[state.mode];

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-1 pb-0.5 text-[10px] font-mono font-medium tracking-widest select-none",
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Vim mode: ${label}`}
    >
      {/* Mode badge */}
      <span
        className={cn(
          "border px-1.5 py-px rounded",
          modeStyle,
        )}
      >
        -- {label} --
      </span>

      {/* Command accumulation display (e.g. "2d", "g", ":wq") */}
      {state.mode === "COMMAND" && (
        <span className="text-surface-400 ml-1">
          :{state.commandInput}
          <span className="animate-pulse">█</span>
        </span>
      )}
      {state.mode !== "COMMAND" && state.command.type !== "idle" && (
        <span className="text-surface-500 ml-1">
          {commandStatePreview(state)}
        </span>
      )}
    </div>
  );
}

/** Build a short human-readable preview of a pending command (e.g. "2d", "g") */
function commandStatePreview(state: VimState): string {
  const { command } = state;
  switch (command.type) {
    case "count":
      return command.digits;
    case "operator":
      return operatorKey(command.op);
    case "operatorCount":
      return `${operatorKey(command.op)}${command.digits}`;
    case "find":
      return command.find;
    case "operatorFind":
      return `${operatorKey(command.op)}${command.find}`;
    case "g":
      return "g";
    case "replace":
      return "r";
    default:
      return "";
  }
}

function operatorKey(op: VimState["command"] extends { op: infer O } ? O : never): string {
  switch (op) {
    case "delete": return "d";
    case "change": return "c";
    case "yank":   return "y";
  }
}
