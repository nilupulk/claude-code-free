"use client";

import { SyntaxHighlight } from "./SyntaxHighlight";
import { ToolUseBlock } from "./ToolUseBlock";

interface ToolNotebookEditProps {
  input: {
    notebook_path: string;
    cell_id?: string;
    new_source?: string;
    cell_type?: "code" | "markdown";
    edit_mode?: string;
  };
  result?: string;
  isError?: boolean;
  isRunning?: boolean;
  startedAt?: number;
  completedAt?: number;
}

export function ToolNotebookEdit({
  input,
  result,
  isError = false,
  isRunning = false,
  startedAt,
  completedAt,
}: ToolNotebookEditProps) {
  const cellType = input.cell_type ?? "code";

  return (
    <ToolUseBlock
      toolName="notebookedit"
      toolInput={input}
      toolResult={result}
      isError={isError}
      isRunning={isRunning}
      startedAt={startedAt}
      completedAt={completedAt}
    >
      {/* Notebook + cell header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-850 border-b border-surface-700/50">
        <span className="font-mono text-xs text-surface-300 truncate">
          {input.notebook_path}
        </span>
        {input.cell_id && (
          <>
            <span className="text-surface-600 text-xs">·</span>
            <span className="font-mono text-xs text-surface-400">
              cell: {input.cell_id}
            </span>
          </>
        )}
        <span
          className={
            cellType === "code"
              ? "ml-auto text-xs px-1.5 py-0.5 rounded bg-brand-900/40 text-brand-400 border border-brand-800/40"
              : "ml-auto text-xs px-1.5 py-0.5 rounded bg-surface-700 text-surface-300"
          }
        >
          {cellType}
        </span>
      </div>

      {/* Cell content */}
      {isRunning ? (
        <div className="px-3 py-4 text-surface-500 text-xs animate-pulse">
          Editing cell…
        </div>
      ) : isError ? (
        <div className="px-3 py-3 text-red-400 text-xs font-mono">{result}</div>
      ) : input.new_source ? (
        <div
          className={
            cellType === "code"
              ? "bg-surface-900 overflow-auto max-h-[320px] [&_pre]:!bg-transparent [&_.shiki]:!bg-transparent"
              : "bg-surface-850 px-3 py-3 text-sm text-surface-200 prose prose-invert prose-sm max-w-none"
          }
        >
          {cellType === "code" ? (
            <SyntaxHighlight
              code={input.new_source}
              lang="python"
              className="text-xs [&_pre]:p-3 [&_pre]:leading-5"
            />
          ) : (
            <pre className="whitespace-pre-wrap text-xs text-surface-200 font-mono">
              {input.new_source}
            </pre>
          )}
        </div>
      ) : result ? (
        <div className="px-3 py-3 text-xs text-surface-300 font-mono">{result}</div>
      ) : null}
    </ToolUseBlock>
  );
}
