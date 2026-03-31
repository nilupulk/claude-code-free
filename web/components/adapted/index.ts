/**
 * Barrel re-export for all web-adapted components.
 *
 * Import from here when you need the web versions of components that originated
 * in src/components/ (Ink/terminal).  Each export is a drop-in replacement for
 * the terminal version for use in browser/Next.js contexts.
 *
 * Usage:
 *   import { Spinner, Markdown, HighlightedCode, ... } from "@/components/adapted";
 */

// ─── Loading / animation ──────────────────────────────────────────────────────
export { Spinner, ShimmerBar, FlashingCursor } from "./Spinner";
export type { SpinnerProps, SpinnerMode } from "./Spinner";

// ─── Text rendering ───────────────────────────────────────────────────────────
export { Markdown, MarkdownTable } from "./Markdown";
export type { MarkdownProps, MarkdownTableProps } from "./Markdown";

// ─── Code / diff display ──────────────────────────────────────────────────────
export { HighlightedCode } from "./HighlightedCode";
export type { HighlightedCodeProps } from "./HighlightedCode";

export { StructuredDiff } from "./StructuredDiff";
export type { StructuredDiffProps, PatchHunk } from "./StructuredDiff";

// ─── Chat messages ────────────────────────────────────────────────────────────
export { Message } from "./Message";
export type { MessageProps, MessageRole, MessageStatus, ContentBlock, TextContent, ToolUseContent, ToolResultContent } from "./Message";

export { Messages } from "./Messages";
export type { MessagesProps, MessageItem } from "./Messages";

// ─── Input ────────────────────────────────────────────────────────────────────
export { PromptInput } from "./PromptInput";
export type { PromptInputProps, PromptInputHandle } from "./PromptInput";

// ─── Status / chrome ──────────────────────────────────────────────────────────
export { StatusLine } from "./StatusLine";
export type { StatusLineProps } from "./StatusLine";

export { Settings } from "./Settings";
export type { SettingsProps } from "./Settings";

// ─── Message response (assistant output) ─────────────────────────────────────
export { MessageResponse } from "./MessageResponse";
export type { MessageResponseProps } from "./MessageResponse";
