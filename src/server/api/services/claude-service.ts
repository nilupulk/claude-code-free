/**
 * Claude service — wraps the Anthropic SDK for streaming chat.
 *
 * The service:
 *   1. Builds the message history from the DB
 *   2. Opens a streaming connection to the Anthropic API
 *   3. Emits typed events through an SSEStream
 *   4. Executes tool calls (with optional approval gating)
 *   5. Continues the conversation until message_stop
 */

import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/index.js";
import { SSEStream, withKeepalive } from "../streaming/sse.js";
import {
  addMessage,
  recordToolUse,
  updateToolUse,
  getMessages,
} from "./conversation-service.js";
import type { FileService } from "./file-service.js";
import type { ExecService } from "./exec-service.js";

// ── Available tools ───────────────────────────────────────────────────────────

function buildTools(): Tool[] {
  return [
    {
      name: "Read",
      description: "Read the contents of a file at a given path.",
      input_schema: {
        type: "object" as const,
        properties: {
          file_path: { type: "string", description: "Absolute path to the file." },
          limit: { type: "number", description: "Max lines to read." },
          offset: { type: "number", description: "Line offset to start from." },
        },
        required: ["file_path"],
      },
    },
    {
      name: "Write",
      description: "Write content to a file.",
      input_schema: {
        type: "object" as const,
        properties: {
          file_path: { type: "string" },
          content: { type: "string" },
        },
        required: ["file_path", "content"],
      },
    },
    {
      name: "Glob",
      description: "Find files matching a glob pattern.",
      input_schema: {
        type: "object" as const,
        properties: {
          pattern: { type: "string" },
          path: { type: "string" },
        },
        required: ["pattern"],
      },
    },
    {
      name: "Grep",
      description: "Search file contents with a regex pattern.",
      input_schema: {
        type: "object" as const,
        properties: {
          pattern: { type: "string" },
          path: { type: "string" },
          glob: { type: "string" },
        },
        required: ["pattern"],
      },
    },
    {
      name: "Bash",
      description: "Execute a shell command.",
      input_schema: {
        type: "object" as const,
        properties: {
          command: { type: "string" },
          timeout: { type: "number" },
        },
        required: ["command"],
      },
    },
    {
      name: "LS",
      description: "List directory contents.",
      input_schema: {
        type: "object" as const,
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  ];
}

// ── Tool execution ─────────────────────────────────────────────────────────────

export interface ToolExecutor {
  read(path: string, limit?: number, offset?: number): Promise<string>;
  write(path: string, content: string): Promise<void>;
  glob(pattern: string, dir?: string): Promise<string[]>;
  grep(pattern: string, path?: string, glob?: string): Promise<string>;
  bash(command: string, timeout?: number): Promise<string>;
  ls(path: string): Promise<string>;
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  executor: ToolExecutor,
): Promise<{ content: string; isError: boolean }> {
  try {
    switch (name) {
      case "Read": {
        const text = await executor.read(
          input.file_path as string,
          input.limit as number | undefined,
          input.offset as number | undefined,
        );
        return { content: text, isError: false };
      }
      case "Write": {
        await executor.write(input.file_path as string, input.content as string);
        return { content: "File written successfully.", isError: false };
      }
      case "Glob": {
        const matches = await executor.glob(
          input.pattern as string,
          input.path as string | undefined,
        );
        return { content: matches.join("\n"), isError: false };
      }
      case "Grep": {
        const result = await executor.grep(
          input.pattern as string,
          input.path as string | undefined,
          input.glob as string | undefined,
        );
        return { content: result, isError: false };
      }
      case "Bash": {
        const out = await executor.bash(
          input.command as string,
          input.timeout as number | undefined,
        );
        return { content: out, isError: false };
      }
      case "LS": {
        const listing = await executor.ls(input.path as string);
        return { content: listing, isError: false };
      }
      default:
        return { content: `Unknown tool: ${name}`, isError: true };
    }
  } catch (err) {
    return {
      content: err instanceof Error ? err.message : String(err),
      isError: true,
    };
  }
}

// ── Auto-approve config ───────────────────────────────────────────────────────

type AutoApprove = Record<string, boolean>;

const toolToPermission: Record<string, string> = {
  Read: "file_read",
  Glob: "file_read",
  Grep: "file_read",
  LS: "file_read",
  Write: "file_write",
  Bash: "bash",
};

function isAutoApproved(toolName: string, autoApprove: AutoApprove): boolean {
  const perm = toolToPermission[toolName];
  if (!perm) return true; // unknown tools — approve by default
  return autoApprove[perm] === true;
}

// ── Main streaming function ───────────────────────────────────────────────────

export interface StreamMessageOptions {
  conversationId: string;
  userId: string;
  userMessage: string;
  files?: Array<{ name: string; content: string; mediaType?: string }>;
  model: string;
  maxTokens: number;
  systemPrompt?: string;
  autoApprove?: AutoApprove;
  apiKey?: string;
  executor: ToolExecutor;
  stream: SSEStream;
}

/** Pending tool approvals. Maps tool_use_id → resolve(approved). */
const pendingApprovals = new Map<string, (approved: boolean) => void>();

/** Approve or deny a pending tool call. Called from the approval endpoint. */
export function resolveToolApproval(toolUseId: string, approved: boolean): boolean {
  const resolve = pendingApprovals.get(toolUseId);
  if (!resolve) return false;
  pendingApprovals.delete(toolUseId);
  resolve(approved);
  return true;
}

export async function streamMessage(opts: StreamMessageOptions): Promise<void> {
  const {
    conversationId,
    userId,
    userMessage,
    files,
    model,
    maxTokens,
    systemPrompt,
    autoApprove = {},
    apiKey,
    executor,
    stream,
  } = opts;

  const client = new Anthropic({
    apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
  });

  // Save user message to DB
  let userContent: unknown = userMessage;
  if (files && files.length > 0) {
    userContent = [
      { type: "text", text: userMessage },
      ...files.map((f) => ({
        type: "text",
        text: `<file name="${f.name}">\n${f.content}\n</file>`,
      })),
    ];
  }
  addMessage(conversationId, userId, { role: "user", content: userContent });

  const stopKeepalive = withKeepalive(stream);

  try {
    // Build full message history for API call
    const history = getMessages(conversationId, userId);
    const apiMessages: MessageParam[] = history.map((m) => {
      let content: unknown;
      try {
        content = JSON.parse(m.contentJson);
      } catch {
        content = m.contentJson;
      }
      return {
        role: m.role === "assistant" ? "assistant" : "user",
        content: content as MessageParam["content"],
      };
    });

    const tools = buildTools();
    const msgId = `msg_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

    stream.send({
      type: "message_start",
      message: { id: msgId, role: "assistant", model },
    });

    // ── Agentic loop ──────────────────────────────────────────────────────────

    let continueLoop = true;
    let inputTokensTotal = 0;
    let outputTokensTotal = 0;
    let assistantMessageId: string | null = null;

    while (continueLoop) {
      continueLoop = false;

      const response = client.messages.stream({
        model,
        max_tokens: maxTokens,
        system: systemPrompt || undefined,
        messages: apiMessages,
        tools,
      });

      let currentBlockIndex = -1;
      let currentToolId: string | null = null;
      let currentToolName: string | null = null;
      let currentToolInputJson = "";

      for await (const event of response) {
        if (stream.isClosed) break;

        switch (event.type) {
          case "content_block_start": {
            currentBlockIndex = event.index;
            const block = event.content_block;
            stream.send({
              type: "content_block_start",
              index: event.index,
              content_block:
                block.type === "text"
                  ? { type: "text", text: "" }
                  : { type: "tool_use", id: block.id, name: block.name, input: {} },
            });
            if (block.type === "tool_use") {
              currentToolId = block.id;
              currentToolName = block.name;
              currentToolInputJson = "";
            }
            break;
          }

          case "content_block_delta": {
            stream.send({
              type: "content_block_delta",
              index: event.index,
              delta: event.delta as { type: "text_delta"; text: string } | { type: "input_json_delta"; partial_json: string },
            });
            if (event.delta.type === "input_json_delta") {
              currentToolInputJson += event.delta.partial_json;
            }
            break;
          }

          case "content_block_stop": {
            stream.send({ type: "content_block_stop", index: currentBlockIndex });

            if (currentToolId && currentToolName) {
              let toolInput: Record<string, unknown> = {};
              try {
                toolInput = JSON.parse(currentToolInputJson) as Record<string, unknown>;
              } catch {
                toolInput = {};
              }

              stream.send({
                type: "tool_use",
                id: currentToolId,
                name: currentToolName,
                input: toolInput,
              });

              // Reset
              currentToolId = null;
              currentToolName = null;
              currentToolInputJson = "";
            }
            break;
          }

          case "message_delta": {
            if (event.usage) {
              outputTokensTotal += event.usage.output_tokens ?? 0;
            }
            break;
          }

          case "message_start": {
            if (event.message.usage) {
              inputTokensTotal += event.message.usage.input_tokens ?? 0;
              outputTokensTotal += event.message.usage.output_tokens ?? 0;
            }
            break;
          }

          case "message_stop":
            break;
        }
      }

      // Grab the full response snapshot for the API message history
      const snapshot = await response.finalMessage();

      // Save assistant message
      if (!assistantMessageId) {
        const dbMsg = addMessage(conversationId, userId, {
          role: "assistant",
          content: snapshot.content,
          model,
          inputTokens: inputTokensTotal,
          outputTokens: outputTokensTotal,
        });
        assistantMessageId = dbMsg.id;
      }

      // Add assistant response to history for next turn
      apiMessages.push({
        role: "assistant",
        content: snapshot.content as MessageParam["content"],
      });

      // ── Handle tool uses ──────────────────────────────────────────────────

      const toolUseBlocks = snapshot.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      if (toolUseBlocks.length === 0) break; // No tool calls → done

      continueLoop = true;
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const tu of toolUseBlocks) {
        const toolInput = tu.input as Record<string, unknown>;
        recordToolUse(assistantMessageId!, {
          id: tu.id,
          toolName: tu.name,
          inputJson: JSON.stringify(toolInput),
        });

        // Check if auto-approved
        const approved = isAutoApproved(tu.name, autoApprove)
          ? true
          : await new Promise<boolean>((resolve) => {
              stream.send({
                type: "tool_approval_needed",
                tool_use_id: tu.id,
                tool_name: tu.name,
                input: toolInput,
              });
              pendingApprovals.set(tu.id, resolve);
              // Timeout after 5 minutes
              setTimeout(() => {
                if (pendingApprovals.has(tu.id)) {
                  pendingApprovals.delete(tu.id);
                  resolve(false);
                }
              }, 5 * 60_000);
            });

        if (!approved) {
          updateToolUse(tu.id, { status: "denied" });
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: "Tool use was denied by the user.",
            is_error: true,
          });
          stream.send({
            type: "tool_result",
            tool_use_id: tu.id,
            content: "Tool use was denied by the user.",
            is_error: true,
          });
          continue;
        }

        const start = Date.now();
        updateToolUse(tu.id, { status: "approved" });

        const result = await executeTool(tu.name, toolInput, executor);
        const durationMs = Date.now() - start;

        updateToolUse(tu.id, {
          outputJson: JSON.stringify(result.content),
          status: result.isError ? "error" : "complete",
          durationMs,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: result.content,
          is_error: result.isError,
        });

        stream.send({
          type: "tool_result",
          tool_use_id: tu.id,
          content: result.content,
          is_error: result.isError,
        });
      }

      // Add tool results to history
      apiMessages.push({
        role: "user",
        content: toolResults,
      });

      // Save tool result message in DB
      addMessage(conversationId, userId, {
        role: "tool",
        content: toolResults,
      });
    }

    stream.send({
      type: "message_stop",
      usage: { input_tokens: inputTokensTotal, output_tokens: outputTokensTotal },
    });
  } catch (err) {
    stream.send({
      type: "error",
      error: {
        code: "CLAUDE_ERROR",
        message: err instanceof Error ? err.message : "Unknown error",
      },
    });
  } finally {
    stopKeepalive();
    stream.close();
  }
}
