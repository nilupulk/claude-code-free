"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ToolUseBlock } from "./ToolUseBlock";

interface ToolGenericProps {
  toolName: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  isRunning?: boolean;
  startedAt?: number;
  completedAt?: number;
}

function JsonViewer({ data }: { data: unknown }) {
  return (
    <pre className="text-xs font-mono text-surface-300 leading-5 whitespace-pre-wrap break-all">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

const MAX_RESULT_LENGTH = 2000;

export function ToolGeneric({
  toolName,
  input,
  result,
  isError = false,
  isRunning = false,
  startedAt,
  completedAt,
}: ToolGenericProps) {
  const [showFullResult, setShowFullResult] = useState(false);

  const isTruncated =
    !showFullResult && result && result.length > MAX_RESULT_LENGTH;
  const displayResult =
    isTruncated ? result!.slice(0, MAX_RESULT_LENGTH) : result;

  return (
    <ToolUseBlock
      toolName={toolName}
      toolInput={input}
      toolResult={result}
      isError={isError}
      isRunning={isRunning}
      startedAt={startedAt}
      completedAt={completedAt}
    >
      {/* Input section */}
      <div className="border-b border-surface-700/50">
        <div className="px-3 py-1.5 bg-surface-800/50 text-xs text-surface-500 uppercase tracking-wide font-medium">
          Input
        </div>
        <div className="px-3 py-3 overflow-auto max-h-[240px]">
          <JsonViewer data={input} />
        </div>
      </div>

      {/* Result section */}
      {isRunning ? (
        <div className="px-3 py-4 text-surface-500 text-xs animate-pulse">
          Running…
        </div>
      ) : result !== undefined ? (
        <div>
          <div className="px-3 py-1.5 bg-surface-800/50 text-xs text-surface-500 uppercase tracking-wide font-medium">
            Result
          </div>
          <div
            className={`px-3 py-3 overflow-auto max-h-[300px] ${isError ? "text-red-400" : ""}`}
          >
            {isError ? (
              <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap">
                {displayResult}
              </pre>
            ) : (
              <pre className="text-xs font-mono text-surface-300 whitespace-pre-wrap break-all">
                {displayResult}
              </pre>
            )}
          </div>
          {isTruncated && (
            <button
              onClick={() => setShowFullResult(true)}
              className="flex items-center gap-1 mx-3 mb-2 text-xs text-brand-400 hover:text-brand-300"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Show full result ({result!.length - MAX_RESULT_LENGTH} more chars)
            </button>
          )}
          {showFullResult && result && result.length > MAX_RESULT_LENGTH && (
            <button
              onClick={() => setShowFullResult(false)}
              className="flex items-center gap-1 mx-3 mb-2 text-xs text-surface-400 hover:text-surface-200"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              Collapse
            </button>
          )}
        </div>
      ) : null}
    </ToolUseBlock>
  );
}
