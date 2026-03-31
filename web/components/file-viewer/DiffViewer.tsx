"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  CheckSquare,
  RotateCcw,
  Columns,
  AlignJustify,
  Layers,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useFileViewerStore } from "@/lib/fileViewerStore";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type LineType = "unchanged" | "added" | "removed";

interface DiffLine {
  type: LineType;
  content: string;
  oldLineNum: number | null;
  newLineNum: number | null;
}

interface Hunk {
  id: string;
  lines: DiffLine[];
  status: "pending" | "accepted" | "rejected";
}

type DiffMode = "unified" | "side-by-side" | "inline";

interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  language: string;
  tabId: string;
}

// ─── Diff algorithm (LCS-based) ─────────────────────────────────────────────

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        oldLines[i - 1] === newLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack
  const result: DiffLine[] = [];
  let i = m,
    j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: "unchanged", content: oldLines[i - 1], oldLineNum: i, newLineNum: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", content: newLines[j - 1], oldLineNum: null, newLineNum: j });
      j--;
    } else {
      result.unshift({ type: "removed", content: oldLines[i - 1], oldLineNum: i, newLineNum: null });
      i--;
    }
  }
  return result;
}

function buildHunks(diffLines: DiffLine[], context: number): Hunk[] {
  const changedIdx = diffLines.map((l, i) => (l.type !== "unchanged" ? i : -1)).filter((i) => i >= 0);
  if (changedIdx.length === 0) return [];

  const ranges: [number, number][] = [];
  let start = Math.max(0, changedIdx[0] - context);
  let end = Math.min(diffLines.length - 1, changedIdx[0] + context);

  for (let k = 1; k < changedIdx.length; k++) {
    const ns = Math.max(0, changedIdx[k] - context);
    if (ns <= end + 1) {
      end = Math.min(diffLines.length - 1, changedIdx[k] + context);
    } else {
      ranges.push([start, end]);
      start = ns;
      end = Math.min(diffLines.length - 1, changedIdx[k] + context);
    }
  }
  ranges.push([start, end]);

  return ranges.map(([s, e]) => ({
    id: nanoid(),
    lines: diffLines.slice(s, e + 1),
    status: "pending" as const,
  }));
}

// ─── Word-level diff for inline mode ────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.match(/\w+|\W+/g) ?? [];
}

function wordDiff(oldLine: string, newLine: string) {
  const ow = tokenize(oldLine);
  const nw = tokenize(newLine);
  const m = ow.length,
    n = nw.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = ow[i - 1] === nw[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const oldOut: { text: string; changed: boolean }[] = [];
  const newOut: { text: string; changed: boolean }[] = [];
  let i = m,
    j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ow[i - 1] === nw[j - 1]) {
      oldOut.unshift({ text: ow[i - 1], changed: false });
      newOut.unshift({ text: nw[j - 1], changed: false });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      newOut.unshift({ text: nw[j - 1], changed: true });
      j--;
    } else {
      oldOut.unshift({ text: ow[i - 1], changed: true });
      i--;
    }
  }
  return { old: oldOut, new: newOut };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderWordTokens(tokens: { text: string; changed: boolean }[], kind: "add" | "del") {
  return tokens.map((t, i) =>
    t.changed ? (
      <span
        key={i}
        className={kind === "add" ? "bg-green-500/30 rounded-sm" : "bg-red-500/30 rounded-sm"}
      >
        {t.text}
      </span>
    ) : (
      <span key={i}>{t.text}</span>
    )
  );
}

// ─── Line number cell ────────────────────────────────────────────────────────

const LineNum = ({ n }: { n: number | null }) => (
  <td className="select-none w-10 pr-3 text-right text-[11px] text-surface-600 border-r border-surface-800 font-mono">
    {n ?? ""}
  </td>
);

// ─── Main component ──────────────────────────────────────────────────────────

export function DiffViewer({ oldContent, newContent, language, tabId }: DiffViewerProps) {
  const { updateContent } = useFileViewerStore();
  const [mode, setMode] = useState<DiffMode>("unified");
  const [context, setContext] = useState(3);
  const [hunks, setHunks] = useState<Hunk[]>(() => {
    const lines = computeDiff(oldContent, newContent);
    return buildHunks(lines, 3);
  });
  const [currentHunk, setCurrentHunk] = useState(0);

  const allDiffLines = useMemo(() => computeDiff(oldContent, newContent), [oldContent, newContent]);

  // Rebuild hunks when context changes
  const handleContextChange = (c: number) => {
    setContext(c);
    setHunks(buildHunks(allDiffLines, c));
  };

  const acceptHunk = (id: string) => {
    setHunks((prev) => prev.map((h) => (h.id === id ? { ...h, status: "accepted" } : h)));
  };

  const rejectHunk = (id: string) => {
    setHunks((prev) => prev.map((h) => (h.id === id ? { ...h, status: "rejected" } : h)));
  };

  const applyAll = () => {
    updateContent(tabId, newContent);
    setHunks((prev) => prev.map((h) => ({ ...h, status: "accepted" })));
  };

  const revertAll = () => {
    updateContent(tabId, oldContent);
    setHunks((prev) => prev.map((h) => ({ ...h, status: "rejected" })));
  };

  const totalChanges = allDiffLines.filter((l) => l.type !== "unchanged").length;
  const additions = allDiffLines.filter((l) => l.type === "added").length;
  const deletions = allDiffLines.filter((l) => l.type === "removed").length;

  if (totalChanges === 0) {
    return (
      <div className="flex items-center justify-center h-full text-surface-500 text-sm gap-2">
        <Check className="w-4 h-4 text-green-400" />
        No differences
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-xs font-mono">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-surface-800 bg-surface-900/80 flex-shrink-0">
        {/* Stats */}
        <span className="text-green-400">+{additions}</span>
        <span className="text-red-400">-{deletions}</span>
        <div className="w-px h-4 bg-surface-800 mx-1" />

        {/* Mode */}
        <div className="flex items-center gap-0.5 bg-surface-800/80 rounded p-0.5">
          {(
            [
              { mode: "unified", icon: AlignJustify, label: "Unified" },
              { mode: "side-by-side", icon: Columns, label: "Side by side" },
              { mode: "inline", icon: Layers, label: "Inline" },
            ] as const
          ).map(({ mode: m, icon: Icon, label }) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-colors",
                mode === m
                  ? "bg-surface-700 text-surface-100"
                  : "text-surface-500 hover:text-surface-300"
              )}
              title={label}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Context lines */}
        <select
          value={context}
          onChange={(e) => handleContextChange(Number(e.target.value))}
          className="bg-surface-800 text-surface-300 text-[11px] rounded px-1 py-0.5 outline-none border border-surface-700"
          title="Context lines"
        >
          {[3, 5, 10, 9999].map((v) => (
            <option key={v} value={v}>
              {v === 9999 ? "All" : `±${v} lines`}
            </option>
          ))}
        </select>

        {/* Navigation */}
        <button
          onClick={() => setCurrentHunk((c) => Math.max(0, c - 1))}
          disabled={currentHunk === 0}
          className="p-0.5 rounded text-surface-500 hover:text-surface-200 disabled:opacity-30 transition-colors"
          title="Previous change"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-surface-500">
          {currentHunk + 1}/{hunks.length}
        </span>
        <button
          onClick={() => setCurrentHunk((c) => Math.min(hunks.length - 1, c + 1))}
          disabled={currentHunk >= hunks.length - 1}
          className="p-0.5 rounded text-surface-500 hover:text-surface-200 disabled:opacity-30 transition-colors"
          title="Next change"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1" />

        {/* Global actions */}
        <button
          onClick={applyAll}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-green-900/40 text-green-300 hover:bg-green-900/60 transition-colors"
          title="Apply all changes"
        >
          <CheckSquare className="w-3 h-3" />
          Apply all
        </button>
        <button
          onClick={revertAll}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-surface-800 text-surface-400 hover:bg-surface-700 transition-colors"
          title="Revert all changes"
        >
          <RotateCcw className="w-3 h-3" />
          Revert all
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {mode === "side-by-side" ? (
          <SideBySideView hunks={hunks} onAccept={acceptHunk} onReject={rejectHunk} />
        ) : mode === "inline" ? (
          <InlineView hunks={hunks} onAccept={acceptHunk} onReject={rejectHunk} />
        ) : (
          <UnifiedView hunks={hunks} onAccept={acceptHunk} onReject={rejectHunk} />
        )}
      </div>
    </div>
  );
}

// ─── Unified view ────────────────────────────────────────────────────────────

function UnifiedView({
  hunks,
  onAccept,
  onReject,
}: {
  hunks: Hunk[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <table className="w-full border-collapse">
      <tbody>
        {hunks.map((hunk, hi) => (
          <>
            {hi > 0 && (
              <tr key={`sep-${hunk.id}`}>
                <td colSpan={4} className="py-1 text-center text-surface-700 text-[11px] bg-surface-900/30">
                  ···
                </td>
              </tr>
            )}
            {hunk.lines.map((line, li) => (
              <tr
                key={`${hunk.id}-${li}`}
                className={cn(
                  "group",
                  line.type === "added" && "bg-green-950/40 hover:bg-green-950/60",
                  line.type === "removed" && "bg-red-950/40 hover:bg-red-950/60",
                  line.type === "unchanged" && "hover:bg-white/2"
                )}
              >
                <LineNum n={line.oldLineNum} />
                <LineNum n={line.newLineNum} />
                <td
                  className={cn(
                    "pl-2 pr-1 w-4 text-center select-none",
                    line.type === "added" && "text-green-400",
                    line.type === "removed" && "text-red-400",
                    line.type === "unchanged" && "text-surface-700"
                  )}
                >
                  {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                </td>
                <td className="pl-2 pr-4 py-0 whitespace-pre leading-5 text-surface-200">
                  {line.content}
                </td>
              </tr>
            ))}
            <HunkActions key={`act-${hunk.id}`} hunk={hunk} onAccept={onAccept} onReject={onReject} />
          </>
        ))}
      </tbody>
    </table>
  );
}

// ─── Side-by-side view ───────────────────────────────────────────────────────

function SideBySideView({
  hunks,
  onAccept,
  onReject,
}: {
  hunks: Hunk[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 h-full">
      {/* Old */}
      <div className="border-r border-surface-800 overflow-auto">
        <table className="w-full border-collapse">
          <tbody>
            {hunks.map((hunk, hi) => (
              <>
                {hi > 0 && (
                  <tr key={`sep-${hunk.id}`}>
                    <td colSpan={2} className="py-1 text-center text-surface-700 text-[11px] bg-surface-900/30">
                      ···
                    </td>
                  </tr>
                )}
                {hunk.lines
                  .filter((l) => l.type !== "added")
                  .map((line, li) => (
                    <tr
                      key={`${hunk.id}-old-${li}`}
                      className={cn(
                        line.type === "removed" && "bg-red-950/40",
                        line.type === "unchanged" && "hover:bg-white/2"
                      )}
                    >
                      <LineNum n={line.oldLineNum} />
                      <td className="pl-2 pr-4 py-0 whitespace-pre leading-5 text-surface-200">
                        {line.content}
                      </td>
                    </tr>
                  ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
      {/* New */}
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <tbody>
            {hunks.map((hunk, hi) => (
              <>
                {hi > 0 && (
                  <tr key={`sep-${hunk.id}`}>
                    <td colSpan={2} className="py-1 text-center text-surface-700 text-[11px] bg-surface-900/30">
                      ···
                    </td>
                  </tr>
                )}
                {hunk.lines
                  .filter((l) => l.type !== "removed")
                  .map((line, li) => (
                    <tr
                      key={`${hunk.id}-new-${li}`}
                      className={cn(
                        line.type === "added" && "bg-green-950/40",
                        line.type === "unchanged" && "hover:bg-white/2"
                      )}
                    >
                      <LineNum n={line.newLineNum} />
                      <td className="pl-2 pr-4 py-0 whitespace-pre leading-5 text-surface-200">
                        {line.content}
                      </td>
                    </tr>
                  ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Inline view (word-level diff) ───────────────────────────────────────────

function InlineView({
  hunks,
  onAccept,
  onReject,
}: {
  hunks: Hunk[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <table className="w-full border-collapse">
      <tbody>
        {hunks.map((hunk, hi) => {
          // Pair up consecutive removed+added lines for word diff
          const pairedLines = pairChangedLines(hunk.lines);

          return (
            <>
              {hi > 0 && (
                <tr key={`sep-${hunk.id}`}>
                  <td colSpan={4} className="py-1 text-center text-surface-700 text-[11px] bg-surface-900/30">
                    ···
                  </td>
                </tr>
              )}
              {pairedLines.map((entry, li) => {
                if (entry.type === "unchanged") {
                  return (
                    <tr key={`${hunk.id}-${li}`} className="hover:bg-white/2">
                      <LineNum n={entry.line.oldLineNum} />
                      <LineNum n={entry.line.newLineNum} />
                      <td className="pl-2 pr-1 w-4 text-surface-700 select-none text-center"> </td>
                      <td className="pl-2 pr-4 py-0 whitespace-pre leading-5 text-surface-200">
                        {entry.line.content}
                      </td>
                    </tr>
                  );
                }

                if (entry.type === "pair") {
                  const wd = wordDiff(entry.removed.content, entry.added.content);
                  return (
                    <>
                      <tr key={`${hunk.id}-${li}-del`} className="bg-red-950/40">
                        <LineNum n={entry.removed.oldLineNum} />
                        <LineNum n={null} />
                        <td className="pl-2 pr-1 w-4 text-red-400 select-none text-center">-</td>
                        <td className="pl-2 pr-4 py-0 whitespace-pre leading-5 text-surface-200">
                          {renderWordTokens(wd.old, "del")}
                        </td>
                      </tr>
                      <tr key={`${hunk.id}-${li}-add`} className="bg-green-950/40">
                        <LineNum n={null} />
                        <LineNum n={entry.added.newLineNum} />
                        <td className="pl-2 pr-1 w-4 text-green-400 select-none text-center">+</td>
                        <td className="pl-2 pr-4 py-0 whitespace-pre leading-5 text-surface-200">
                          {renderWordTokens(wd.new, "add")}
                        </td>
                      </tr>
                    </>
                  );
                }

                // Unpaired added/removed
                const l = entry.line;
                return (
                  <tr
                    key={`${hunk.id}-${li}`}
                    className={l.type === "added" ? "bg-green-950/40" : "bg-red-950/40"}
                  >
                    <LineNum n={l.oldLineNum} />
                    <LineNum n={l.newLineNum} />
                    <td
                      className={cn(
                        "pl-2 pr-1 w-4 select-none text-center",
                        l.type === "added" ? "text-green-400" : "text-red-400"
                      )}
                    >
                      {l.type === "added" ? "+" : "-"}
                    </td>
                    <td className="pl-2 pr-4 py-0 whitespace-pre leading-5 text-surface-200">
                      {l.content}
                    </td>
                  </tr>
                );
              })}
              <HunkActions key={`act-${hunk.id}`} hunk={hunk} onAccept={onAccept} onReject={onReject} />
            </>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Hunk actions row ────────────────────────────────────────────────────────

function HunkActions({
  hunk,
  onAccept,
  onReject,
}: {
  hunk: Hunk;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const hasChanges = hunk.lines.some((l) => l.type !== "unchanged");
  if (!hasChanges) return null;

  return (
    <tr>
      <td colSpan={4} className="py-0.5 px-3 bg-surface-900/50">
        <div className="flex items-center gap-1">
          {hunk.status === "accepted" ? (
            <span className="text-[11px] text-green-400 flex items-center gap-1">
              <Check className="w-3 h-3" /> Applied
            </span>
          ) : hunk.status === "rejected" ? (
            <span className="text-[11px] text-surface-500 flex items-center gap-1">
              <X className="w-3 h-3" /> Reverted
            </span>
          ) : (
            <>
              <button
                onClick={() => onAccept(hunk.id)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-green-300 hover:bg-green-900/30 transition-colors"
              >
                <Check className="w-3 h-3" /> Accept hunk
              </button>
              <button
                onClick={() => onReject(hunk.id)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-surface-400 hover:bg-surface-800 transition-colors"
              >
                <X className="w-3 h-3" /> Reject hunk
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Helper: pair consecutive removed+added lines ────────────────────────────

type PairedEntry =
  | { type: "unchanged"; line: DiffLine }
  | { type: "pair"; removed: DiffLine; added: DiffLine }
  | { type: "single"; line: DiffLine };

function pairChangedLines(lines: DiffLine[]): PairedEntry[] {
  const result: PairedEntry[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.type === "unchanged") {
      result.push({ type: "unchanged", line });
      i++;
    } else if (line.type === "removed" && i + 1 < lines.length && lines[i + 1].type === "added") {
      result.push({ type: "pair", removed: line, added: lines[i + 1] });
      i += 2;
    } else {
      result.push({ type: "single", line });
      i++;
    }
  }
  return result;
}
