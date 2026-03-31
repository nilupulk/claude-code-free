// ─── Analytics Event Definitions ─────────────────────────────────────────────

export interface AnalyticsEvent {
  name: string;
  timestamp: number;
  sessionId: string;
  properties: Record<string, unknown>;
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface ConversationCreated {
  name: "conversation.created";
  properties: { model: string; source: "new" | "resume" };
}

export interface ConversationMessageSent {
  name: "conversation.message_sent";
  properties: { message_length: number; has_files: boolean; has_slash_command: boolean };
}

export interface ConversationResponseReceived {
  name: "conversation.response_received";
  properties: { tokens: number; duration_ms: number; stop_reason: string };
}

export interface ConversationExported {
  name: "conversation.exported";
  properties: { format: string };
}

export interface ConversationShared {
  name: "conversation.shared";
  properties: { access_level: string };
}

// ─── Tool ─────────────────────────────────────────────────────────────────────

export interface ToolExecuted {
  name: "tool.executed";
  properties: { tool_name: string; duration_ms: number; status: "success" | "error" };
}

export interface ToolApproved {
  name: "tool.approved";
  properties: { tool_name: string; auto: boolean };
}

export interface ToolDenied {
  name: "tool.denied";
  properties: { tool_name: string };
}

// ─── UI ───────────────────────────────────────────────────────────────────────

export interface UIThemeChanged {
  name: "ui.theme_changed";
  properties: { theme: string };
}

export interface UISidebarToggled {
  name: "ui.sidebar_toggled";
  properties: { open: boolean };
}

export interface UICommandPaletteUsed {
  name: "ui.command_palette_used";
  properties: { command: string };
}

export interface UIKeyboardShortcutUsed {
  name: "ui.keyboard_shortcut_used";
  properties: { shortcut: string };
}

export interface UIFileViewerOpened {
  name: "ui.file_viewer_opened";
  properties: { file_type: string };
}

export interface UISettingsChanged {
  name: "ui.settings_changed";
  properties: { setting_key: string };
}

// ─── Performance ──────────────────────────────────────────────────────────────

export interface PerformancePageLoad {
  name: "performance.page_load";
  properties: { duration_ms: number; route: string };
}

export interface PerformanceTTFB {
  name: "performance.ttfb";
  properties: { duration_ms: number };
}

export interface PerformanceStreamingLatency {
  name: "performance.streaming_latency";
  properties: { first_token_ms: number };
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export interface ErrorAPI {
  name: "error.api";
  properties: { status: number; endpoint: string };
}

export interface ErrorStreaming {
  name: "error.streaming";
  properties: { type: string };
}

export interface ErrorUI {
  name: "error.ui";
  properties: { component: string; error_type: string };
}

// ─── Union ────────────────────────────────────────────────────────────────────

export type TypedEvent =
  | ConversationCreated
  | ConversationMessageSent
  | ConversationResponseReceived
  | ConversationExported
  | ConversationShared
  | ToolExecuted
  | ToolApproved
  | ToolDenied
  | UIThemeChanged
  | UISidebarToggled
  | UICommandPaletteUsed
  | UIKeyboardShortcutUsed
  | UIFileViewerOpened
  | UISettingsChanged
  | PerformancePageLoad
  | PerformanceTTFB
  | PerformanceStreamingLatency
  | ErrorAPI
  | ErrorStreaming
  | ErrorUI;

export type EventName = TypedEvent["name"];

// ─── Batch payload ────────────────────────────────────────────────────────────

export interface EventBatch {
  events: AnalyticsEvent[];
  clientVersion?: string;
}
