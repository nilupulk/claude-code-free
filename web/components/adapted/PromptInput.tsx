"use client";

/**
 * Web-adapted PromptInput.
 *
 * The terminal PromptInput (src/components/PromptInput/PromptInput.tsx) is a
 * large component that uses:
 *   - Ink's useInput / useTerminalSize for keyboard handling
 *   - Vim mode text editing (VimTextInput)
 *   - Paste handling for file attachments
 *   - A footer with cost/model info
 *   - Queue of pending commands
 *
 * This web version provides the same ergonomic surface — auto-growing textarea,
 * send/stop buttons, keyboard shortcut (Enter to send, Shift+Enter for newline),
 * file attachment via input[type=file], voice mode stub — using native browser
 * APIs.  Props mirror the shape callers pass to the terminal version where
 * practical, so swapping is mechanical.
 */

import * as React from "react";
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Send,
  Square,
  Paperclip,
  Mic,
  MicOff,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromptInputProps {
  /** Controlled value. If omitted the component manages its own state. */
  value?: string;
  /** Called whenever the text changes. */
  onChange?: (value: string) => void;
  /** Called when the user submits (Enter or send button). */
  onSubmit?: (value: string) => void;
  /** Called when the user presses the stop button during generation. */
  onStop?: () => void;
  /** Whether a response is currently streaming. */
  isStreaming?: boolean;
  /** Placeholder text. */
  placeholder?: string;
  /** When true, disable the input (e.g. during initialisation). */
  disabled?: boolean;
  /** Maximum character count. */
  maxLength?: number;
  /** Show the file attachment button. Default true. */
  showAttach?: boolean;
  /** Called when files are picked via the attachment button. */
  onAttach?: (files: FileList) => void;
  /** Model name shown in the footer. */
  model?: string;
  /** Extra class names for the outer wrapper. */
  className?: string;
}

export interface PromptInputHandle {
  /** Programmatically focus the textarea. */
  focus(): void;
  /** Clear the input. */
  clear(): void;
}

// ─── Auto-size hook ───────────────────────────────────────────────────────────

function useAutoSize(
  ref: React.RefObject<HTMLTextAreaElement>,
  value: string,
  maxHeightPx = 240
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeightPx)}px`;
  }, [ref, value]);
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PromptInput = forwardRef<PromptInputHandle, PromptInputProps>(
  function PromptInput(
    {
      value: valueProp,
      onChange,
      onSubmit,
      onStop,
      isStreaming = false,
      placeholder = "Message Claude Code…",
      disabled = false,
      maxLength,
      showAttach = true,
      onAttach,
      model,
      className,
    },
    ref
  ) {
    const [internalValue, setInternalValue] = useState("");
    const isControlled = valueProp !== undefined;
    const value = isControlled ? valueProp : internalValue;

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [voiceActive, setVoiceActive] = useState(false);

    useAutoSize(textareaRef, value);

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      clear: () => handleChange(""),
    }));

    const handleChange = useCallback(
      (next: string) => {
        const clamped = maxLength ? next.slice(0, maxLength) : next;
        if (!isControlled) setInternalValue(clamped);
        onChange?.(clamped);
      },
      [isControlled, maxLength, onChange]
    );

    const handleSubmit = useCallback(() => {
      const trimmed = value.trim();
      if (!trimmed || isStreaming || disabled) return;
      onSubmit?.(trimmed);
      handleChange("");
    }, [value, isStreaming, disabled, onSubmit, handleChange]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
      },
      [handleSubmit]
    );

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onAttach?.(files);
      }
      // Reset so the same file can be re-picked
      e.target.value = "";
    };

    const canSend = value.trim().length > 0 && !disabled;

    return (
      <div
        className={cn(
          "border-t border-surface-800 bg-surface-900/60 backdrop-blur-sm px-4 py-3",
          className
        )}
      >
        {/* Input area */}
        <div
          className={cn(
            "flex items-end gap-2 rounded-xl border px-3 py-2",
            "bg-surface-800 transition-colors",
            disabled
              ? "border-surface-700 opacity-60"
              : "border-surface-700 focus-within:border-brand-500"
          )}
        >
          {/* Attachment button */}
          {showAttach && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="p-1 text-surface-500 hover:text-surface-300 transition-colors flex-shrink-0 mb-0.5 disabled:opacity-40"
                aria-label="Attach file"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" aria-hidden />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="sr-only"
                tabIndex={-1}
                onChange={handleFileChange}
                aria-hidden
              />
            </>
          )}

          {/* Textarea */}
          <label htmlFor="prompt-input" className="sr-only">
            {placeholder}
          </label>
          <textarea
            id="prompt-input"
            ref={textareaRef}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isStreaming}
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent text-sm text-surface-100 font-mono",
              "placeholder:text-surface-500 focus:outline-none",
              "min-h-[24px] max-h-[240px] py-0.5 leading-relaxed"
            )}
            aria-multiline="true"
            aria-label="Message input"
          />

          {/* Voice stub */}
          <button
            type="button"
            onClick={() => setVoiceActive((v) => !v)}
            disabled={disabled || isStreaming}
            className={cn(
              "p-1 rounded transition-colors flex-shrink-0 mb-0.5 disabled:opacity-40",
              voiceActive
                ? "text-red-400 hover:text-red-300"
                : "text-surface-500 hover:text-surface-300"
            )}
            aria-label={voiceActive ? "Stop voice input" : "Start voice input"}
            title={voiceActive ? "Stop voice" : "Voice input"}
          >
            {voiceActive ? (
              <MicOff className="w-4 h-4" aria-hidden />
            ) : (
              <Mic className="w-4 h-4" aria-hidden />
            )}
          </button>

          {/* Send / Stop */}
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="p-1.5 rounded-lg bg-surface-700 text-surface-300 hover:bg-surface-600 transition-colors flex-shrink-0"
              aria-label="Stop generation"
              title="Stop (Escape)"
            >
              <Square className="w-4 h-4" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSend}
              className={cn(
                "p-1.5 rounded-lg transition-colors flex-shrink-0",
                canSend
                  ? "bg-brand-600 text-white hover:bg-brand-700"
                  : "bg-surface-700 text-surface-500 cursor-not-allowed"
              )}
              aria-label="Send message"
              aria-disabled={!canSend}
              title="Send (Enter)"
            >
              <Send className="w-4 h-4" aria-hidden />
            </button>
          )}
        </div>

        {/* Footer: hints + model */}
        <div className="flex items-center justify-between mt-1.5 px-0.5">
          <p className="text-xs text-surface-600">
            <kbd className="font-mono">Enter</kbd> to send ·{" "}
            <kbd className="font-mono">Shift+Enter</kbd> for newline
          </p>
          <div className="flex items-center gap-2">
            {maxLength && value.length > maxLength * 0.8 && (
              <span
                className={cn(
                  "text-xs tabular-nums",
                  value.length >= maxLength
                    ? "text-red-400"
                    : "text-surface-500"
                )}
                aria-live="polite"
              >
                {value.length}/{maxLength}
              </span>
            )}
            {model && (
              <span className="flex items-center gap-1 text-xs text-surface-600 font-mono">
                <ChevronUp className="w-3 h-3" aria-hidden />
                {model}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
);
