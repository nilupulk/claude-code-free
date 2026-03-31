"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { createInputHistory } from "@/lib/input/history";
import { createImeHandler } from "@/lib/input/ime-handler";
import { processPaste, insertText } from "@/lib/input/paste-handler";
import { createVimState, processVimKey, type VimState } from "@/lib/input/vim-adapter";
import { VimModeIndicator } from "./VimModeIndicator";
import { TabCompletion, type TabCompletionItem } from "./TabCompletion";

// ── Public API ────────────────────────────────────────────────────────────────

export interface WebTextInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when the user submits (Enter without Shift, or vim `:submit`) */
  onSubmit?: () => void;
  /** Called when Ctrl+C is pressed and no text is selected */
  onInterrupt?: () => void;
  /** Called when Escape is pressed in non-vim mode */
  onEscape?: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Enable vim keybindings (default: false) */
  vimMode?: boolean;
  /** Maximum character count (no limit if undefined) */
  maxLength?: number;
  /** Tab-completion suggestions */
  completions?: TabCompletionItem[];
  /** Called when the user triggers tab-completion */
  onRequestCompletions?: (prefix: string) => void;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  className?: string;
  /** aria-label for the textarea */
  "aria-label"?: string;
}

export interface WebTextInputHandle {
  /** Focus the textarea */
  focus(): void;
  /** Clear the input */
  clear(): void;
  /** Insert text at the current cursor position */
  insertAtCursor(text: string): void;
}

// ── Shared history instance (module-level, persists across renders) ────────────

const sharedHistory = createInputHistory(500);

// ── Component ─────────────────────────────────────────────────────────────────

export const WebTextInput = forwardRef<WebTextInputHandle, WebTextInputProps>(
  function WebTextInput(
    {
      value,
      onChange,
      onSubmit,
      onInterrupt,
      onEscape,
      placeholder = "Type a message…",
      disabled = false,
      vimMode = false,
      maxLength,
      completions = [],
      onRequestCompletions,
      autoFocus = false,
      className,
      "aria-label": ariaLabel,
    },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [vimState, setVimState] = useState<VimState>(() => createVimState());
    const [showCompletions, setShowCompletions] = useState(false);
    const [completionIndex, setCompletionIndex] = useState(0);

    // IME handler — one instance, reused across re-renders
    const imeRef = useRef(createImeHandler());

    // ── Expose imperative handle ─────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      focus() {
        textareaRef.current?.focus();
      },
      clear() {
        onChange("");
        sharedHistory.resetCursor();
      },
      insertAtCursor(text: string) {
        const el = textareaRef.current;
        if (!el) return;
        const { newValue, newCursorPos } = insertText(el, text, value);
        onChange(newValue);
        requestAnimationFrame(() => {
          el.selectionStart = newCursorPos;
          el.selectionEnd = newCursorPos;
        });
      },
    }));

    // ── Auto-focus ───────────────────────────────────────────────────────────
    useEffect(() => {
      if (autoFocus) textareaRef.current?.focus();
    }, [autoFocus]);

    // ── IME attachment ───────────────────────────────────────────────────────
    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      return imeRef.current.attach(el);
    }, []);

    // ── Auto-resize ──────────────────────────────────────────────────────────
    const adjustHeight = useCallback(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
    }, []);

    useEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    // ── Apply cursor position after state changes ────────────────────────────
    const pendingCursorRef = useRef<number | null>(null);
    useEffect(() => {
      if (pendingCursorRef.current !== null) {
        const el = textareaRef.current;
        if (el) {
          const pos = Math.max(0, Math.min(pendingCursorRef.current, el.value.length));
          el.selectionStart = pos;
          el.selectionEnd = pos;
        }
        pendingCursorRef.current = null;
      }
    });

    // ── Keyboard handler ─────────────────────────────────────────────────────
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const el = textareaRef.current;
        if (!el) return;

        // Don't process keybindings during IME composition
        if (imeRef.current.state.isComposing) return;
        // Also check nativeEvent.isComposing for browser compat
        if ((e.nativeEvent as KeyboardEvent).isComposing) return;

        const { key, shiftKey, ctrlKey, altKey, metaKey } = e;

        // ── Ctrl+C: interrupt (only when no text selected) ───────────────────
        if (ctrlKey && key === "c" && !shiftKey) {
          const hasSelection =
            el.selectionStart !== el.selectionEnd;
          if (!hasSelection) {
            e.preventDefault();
            onInterrupt?.();
            return;
          }
          // Allow browser copy if text is selected
          return;
        }

        // ── Ctrl+D: send EOF / exit signal ────────────────────────────────────
        if (ctrlKey && key === "d" && !shiftKey) {
          e.preventDefault();
          onInterrupt?.();
          return;
        }

        // ── Vim mode key processing ──────────────────────────────────────────
        if (vimMode && vimState.mode !== "INSERT") {
          const result = processVimKey(key, shiftKey, ctrlKey, el, vimState, (newVal) => {
            onChange(newVal);
          });

          if (result.handled) {
            e.preventDefault();
            setVimState(result.newState);
            if (result.newCursorPos !== undefined) {
              pendingCursorRef.current = result.newCursorPos;
            }
            return;
          }
        }

        // Capture Escape from vim INSERT mode transition
        if (vimMode && key === "Escape" && vimState.mode === "INSERT") {
          e.preventDefault();
          const result = processVimKey(key, shiftKey, ctrlKey, el, vimState, onChange);
          setVimState(result.newState);
          if (result.newCursorPos !== undefined) {
            pendingCursorRef.current = result.newCursorPos;
          }
          return;
        }

        // ── Tab completion navigation ────────────────────────────────────────
        if (key === "Tab" && showCompletions && completions.length > 0) {
          e.preventDefault();
          if (shiftKey) {
            setCompletionIndex((i) => (i - 1 + completions.length) % completions.length);
          } else {
            setCompletionIndex((i) => (i + 1) % completions.length);
          }
          return;
        }

        if (key === "Enter" && showCompletions && completions.length > 0) {
          e.preventDefault();
          const item = completions[completionIndex];
          if (item) {
            applyCompletion(item.value);
          }
          setShowCompletions(false);
          return;
        }

        if (key === "Escape" && showCompletions) {
          e.preventDefault();
          setShowCompletions(false);
          return;
        }

        // ── Tab: request completions ─────────────────────────────────────────
        if (key === "Tab" && !showCompletions) {
          e.preventDefault();
          const prefix = value.slice(0, el.selectionStart);
          onRequestCompletions?.(prefix);
          if (completions.length > 0) {
            setShowCompletions(true);
            setCompletionIndex(0);
          }
          return;
        }

        // ── Escape (non-vim, non-completion): delegate ───────────────────────
        if (key === "Escape") {
          onEscape?.();
          return;
        }

        // ── Enter: submit (unless Shift held for newline) ────────────────────
        if (key === "Enter" && !shiftKey && !ctrlKey && !altKey && !metaKey) {
          e.preventDefault();
          if (value.trim()) {
            sharedHistory.push(value);
            onSubmit?.();
          }
          return;
        }

        // ── History navigation ───────────────────────────────────────────────
        if (key === "ArrowUp" && !shiftKey && !ctrlKey && !metaKey) {
          // Only navigate history when the cursor is on the first line
          const beforeCursor = value.slice(0, el.selectionStart);
          const onFirstLine = !beforeCursor.includes("\n");
          if (onFirstLine) {
            e.preventDefault();
            const prev = sharedHistory.back(value);
            if (prev !== null) onChange(prev);
            return;
          }
        }
        if (key === "ArrowDown" && !shiftKey && !ctrlKey && !metaKey) {
          const afterCursor = value.slice(el.selectionStart);
          const onLastLine = !afterCursor.includes("\n");
          if (onLastLine) {
            e.preventDefault();
            const next = sharedHistory.forward();
            if (next !== null) onChange(next);
            return;
          }
        }

        // ── Emacs-style editing shortcuts ────────────────────────────────────
        if (ctrlKey && !shiftKey && !metaKey && !altKey) {
          switch (key) {
            case "a": {
              // Ctrl+A: move to start of line
              e.preventDefault();
              const lineStart = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
              el.selectionStart = lineStart;
              el.selectionEnd = lineStart;
              return;
            }
            case "e": {
              // Ctrl+E: move to end of line
              e.preventDefault();
              const nextNl = value.indexOf("\n", el.selectionStart);
              const lineEnd = nextNl === -1 ? value.length : nextNl;
              el.selectionStart = lineEnd;
              el.selectionEnd = lineEnd;
              return;
            }
            case "k": {
              // Ctrl+K: kill to end of line
              e.preventDefault();
              const nextNl2 = value.indexOf("\n", el.selectionStart);
              const killEnd = nextNl2 === -1 ? value.length : nextNl2;
              const newVal = value.slice(0, el.selectionStart) + value.slice(killEnd);
              onChange(newVal);
              return;
            }
            case "u": {
              // Ctrl+U: kill to start of line
              e.preventDefault();
              const lineStart2 = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
              const newVal = value.slice(0, lineStart2) + value.slice(el.selectionStart);
              onChange(newVal);
              pendingCursorRef.current = lineStart2;
              return;
            }
            case "w": {
              // Ctrl+W: kill previous word
              e.preventDefault();
              const cur = el.selectionStart;
              let i = cur - 1;
              while (i > 0 && value[i] === " ") i--;
              while (i > 0 && value[i - 1] !== " " && value[i - 1] !== "\n") i--;
              const newVal = value.slice(0, i) + value.slice(cur);
              onChange(newVal);
              pendingCursorRef.current = i;
              return;
            }
          }
        }

        // Any other key — reset history cursor so typing fresh clears navigation
        if (key.length === 1) {
          sharedHistory.resetCursor();
        }
      },
      [
        value,
        onChange,
        onSubmit,
        onInterrupt,
        onEscape,
        vimMode,
        vimState,
        showCompletions,
        completions,
        completionIndex,
        onRequestCompletions,
      ],
    );

    // ── Paste handler ────────────────────────────────────────────────────────
    const handlePaste = useCallback(
      async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const result = await processPaste(e.nativeEvent as ClipboardEvent);
        if (!result) return;

        if (result.type === "text") {
          const el = textareaRef.current;
          if (!el) return;
          const { newValue, newCursorPos } = insertText(el, result.text, value);
          const capped = maxLength ? newValue.slice(0, maxLength) : newValue;
          onChange(capped);
          pendingCursorRef.current = Math.min(newCursorPos, capped.length);
        }
        // image / file: parent handles via onPaste prop if needed
      },
      [value, onChange, maxLength],
    );

    // ── Completion application ───────────────────────────────────────────────
    const applyCompletion = useCallback(
      (completionValue: string) => {
        const el = textareaRef.current;
        if (!el) return;
        // Replace the current "word" before the cursor with the completion
        const cur = el.selectionStart;
        const before = value.slice(0, cur);
        const wordMatch = before.match(/\S+$/);
        const wordStart = wordMatch ? cur - wordMatch[0].length : cur;
        const newValue = value.slice(0, wordStart) + completionValue + value.slice(cur);
        onChange(newValue);
        pendingCursorRef.current = wordStart + completionValue.length;
      },
      [value, onChange],
    );

    // ── Render ───────────────────────────────────────────────────────────────
    const isNormalMode = vimMode && vimState.mode !== "INSERT";

    return (
      <div className="relative">
        {/* Vim mode indicator */}
        {vimMode && <VimModeIndicator state={vimState} />}

        {/* Main textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            const capped = maxLength ? raw.slice(0, maxLength) : raw;
            onChange(capped);
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            isNormalMode ? undefined : placeholder
          }
          disabled={disabled}
          rows={1}
          aria-label={ariaLabel ?? "Text input"}
          aria-multiline="true"
          spellCheck={!isNormalMode}
          // In NORMAL/VISUAL vim mode, suppress native selection behaviour
          readOnly={isNormalMode}
          className={cn(
            "w-full resize-none bg-transparent text-sm leading-relaxed",
            "placeholder:text-surface-500 focus:outline-none",
            "min-h-[24px] max-h-[300px] py-0.5",
            isNormalMode && "caret-transparent select-none cursor-default",
            className,
          )}
        />

        {/* Tab completion menu */}
        {showCompletions && completions.length > 0 && (
          <TabCompletion
            items={completions}
            selectedIndex={completionIndex}
            onSelect={(item) => {
              applyCompletion(item.value);
              setShowCompletions(false);
              textareaRef.current?.focus();
            }}
            onDismiss={() => setShowCompletions(false)}
          />
        )}
      </div>
    );
  },
);
