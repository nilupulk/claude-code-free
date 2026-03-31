/**
 * Server-Sent Events helpers.
 *
 * Usage:
 *   const stream = new SSEStream(res);
 *   stream.send({ type: "message_start", ... });
 *   stream.close();
 */

import type { Response } from "express";

// ── Event types (mirror Anthropic streaming event shapes) ─────────────────────

export interface SSEMessageStart {
  type: "message_start";
  message: { id: string; role: "assistant"; model: string };
}

export interface SSEContentBlockStart {
  type: "content_block_start";
  index: number;
  content_block: { type: "text"; text: "" } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
}

export interface SSEContentBlockDelta {
  type: "content_block_delta";
  index: number;
  delta: { type: "text_delta"; text: string } | { type: "input_json_delta"; partial_json: string };
}

export interface SSEContentBlockStop {
  type: "content_block_stop";
  index: number;
}

export interface SSEToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface SSEToolApprovalNeeded {
  type: "tool_approval_needed";
  tool_use_id: string;
  tool_name: string;
  input: Record<string, unknown>;
}

export interface SSEToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface SSEMessageStop {
  type: "message_stop";
  usage?: { input_tokens: number; output_tokens: number };
}

export interface SSEError {
  type: "error";
  error: { code: string; message: string };
}

export type SSEEvent =
  | SSEMessageStart
  | SSEContentBlockStart
  | SSEContentBlockDelta
  | SSEContentBlockStop
  | SSEToolUse
  | SSEToolApprovalNeeded
  | SSEToolResult
  | SSEMessageStop
  | SSEError
  | { type: string; [key: string]: unknown };

// ── SSEStream ─────────────────────────────────────────────────────────────────

export class SSEStream {
  private closed = false;

  constructor(private readonly res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
    res.flushHeaders();
  }

  /** Emit a JSON event on the stream. */
  send(event: SSEEvent): void {
    if (this.closed) return;
    this.res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  /** Emit a named SSE event (rarely needed; most callers use send()). */
  sendNamed(name: string, event: SSEEvent): void {
    if (this.closed) return;
    this.res.write(`event: ${name}\ndata: ${JSON.stringify(event)}\n\n`);
  }

  /** Send a keepalive comment to prevent proxy timeouts. */
  ping(): void {
    if (this.closed) return;
    this.res.write(": ping\n\n");
  }

  /** End the SSE stream cleanly. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.res.end();
  }

  get isClosed(): boolean {
    return this.closed;
  }
}

// ── Keepalive helper ──────────────────────────────────────────────────────────

/**
 * Returns a cleanup function that stops the keepalive interval.
 * Call it when the stream closes to avoid a dangling timer.
 */
export function withKeepalive(stream: SSEStream, intervalMs = 15_000): () => void {
  const timer = setInterval(() => {
    if (stream.isClosed) {
      clearInterval(timer);
      return;
    }
    stream.ping();
  }, intervalMs);
  return () => clearInterval(timer);
}
