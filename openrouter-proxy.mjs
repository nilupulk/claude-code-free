/**
 * Anthropic-to-OpenRouter Proxy v2
 * Full translation: Anthropic /v1/messages ↔ OpenAI /chat/completions
 * Supports: tools, streaming, tool_use/tool_result blocks
 */

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "qwen/qwen3.6-plus-preview:free";
const PORT = parseInt(process.env.PROXY_PORT || "4000");

if (!OPENROUTER_KEY) {
  console.error("\n❌ OPENROUTER_API_KEY not set!");
  console.error("   Get a free key at: https://openrouter.ai/keys");
  process.exit(1);
}

// ─── Anthropic → OpenAI conversion ───

function convertTools(anthropicTools) {
  if (!anthropicTools?.length) return undefined;
  return anthropicTools.map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description || "",
      parameters: t.input_schema || { type: "object", properties: {} },
    },
  }));
}

function convertMessages(anthropicBody) {
  const messages = [];

  // System
  if (anthropicBody.system) {
    const text = typeof anthropicBody.system === "string"
      ? anthropicBody.system
      : anthropicBody.system.map(b => b.text || "").join("\n");
    messages.push({ role: "system", content: text });
  }

  for (const msg of anthropicBody.messages || []) {
    if (msg.role === "assistant") {
      // Handle assistant messages with tool_use blocks
      if (Array.isArray(msg.content)) {
        let textParts = [];
        let toolCalls = [];
        for (const block of msg.content) {
          if (block.type === "text" && block.text) textParts.push(block.text);
          if (block.type === "tool_use") {
            toolCalls.push({
              id: block.id,
              type: "function",
              function: {
                name: block.name,
                arguments: typeof block.input === "string" ? block.input : JSON.stringify(block.input),
              },
            });
          }
        }
        const m = { role: "assistant", content: textParts.join("\n") || null };
        if (toolCalls.length) m.tool_calls = toolCalls;
        messages.push(m);
      } else {
        messages.push({ role: "assistant", content: msg.content || "" });
      }
    } else if (msg.role === "user") {
      if (Array.isArray(msg.content)) {
        // Check for tool_result blocks
        let hasToolResults = msg.content.some(b => b.type === "tool_result");
        if (hasToolResults) {
          for (const block of msg.content) {
            if (block.type === "tool_result") {
              let resultContent = "";
              if (typeof block.content === "string") {
                resultContent = block.content;
              } else if (Array.isArray(block.content)) {
                resultContent = block.content.map(c => c.text || JSON.stringify(c)).join("\n");
              } else {
                resultContent = JSON.stringify(block.content);
              }
              messages.push({
                role: "tool",
                tool_call_id: block.tool_use_id,
                content: resultContent,
              });
            } else if (block.type === "text" && block.text) {
              messages.push({ role: "user", content: block.text });
            }
          }
        } else {
          const text = msg.content.map(b => b.text || "").join("\n");
          messages.push({ role: "user", content: text });
        }
      } else {
        messages.push({ role: "user", content: msg.content || "" });
      }
    }
  }

  return messages;
}

function buildOpenRouterRequest(anthropicBody) {
  const req = {
    model: OPENROUTER_MODEL,
    messages: convertMessages(anthropicBody),
    stream: !!anthropicBody.stream,
    max_tokens: anthropicBody.max_tokens || 4096,
    temperature: anthropicBody.temperature ?? 0.7,
  };

  const tools = convertTools(anthropicBody.tools);
  if (tools) {
    req.tools = tools;
    req.tool_choice = "auto";
  }

  return req;
}

// ─── OpenAI → Anthropic conversion ───

function convertResponseToAnthropic(openRouterData, requestModel) {
  const choice = openRouterData.choices?.[0];
  const message = choice?.message;
  const contentBlocks = [];

  // Add text content
  if (message?.content) {
    contentBlocks.push({ type: "text", text: message.content });
  }

  // Add tool calls
  if (message?.tool_calls?.length) {
    for (const tc of message.tool_calls) {
      let input = {};
      try { input = JSON.parse(tc.function.arguments); } catch { input = { raw: tc.function.arguments }; }
      contentBlocks.push({
        type: "tool_use",
        id: tc.id || ("toolu_" + Math.random().toString(36).slice(2, 14)),
        name: tc.function.name,
        input,
      });
    }
  }

  if (contentBlocks.length === 0) {
    contentBlocks.push({ type: "text", text: "" });
  }

  const hasToolUse = contentBlocks.some(b => b.type === "tool_use");

  return {
    id: "msg_" + (openRouterData.id || Math.random().toString(36).slice(2, 14)),
    type: "message",
    role: "assistant",
    content: contentBlocks,
    model: requestModel || "claude-sonnet-4-6",
    stop_reason: hasToolUse ? "tool_use" : (choice?.finish_reason === "length" ? "max_tokens" : "end_turn"),
    stop_sequence: null,
    usage: {
      input_tokens: openRouterData.usage?.prompt_tokens || 100,
      output_tokens: openRouterData.usage?.completion_tokens || 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  };
}

// ─── Streaming ───

function sse(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function handleStream(resp, requestModel) {
  const msgId = "msg_" + Math.random().toString(36).slice(2, 14);
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(ctrl) {
      ctrl.enqueue(enc.encode(sse("message_start", {
        type: "message_start",
        message: {
          id: msgId, type: "message", role: "assistant", content: [],
          model: requestModel || "claude-sonnet-4-6",
          stop_reason: null, stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        },
      })));

      let contentStarted = false;
      let toolIndex = 0;
      let currentToolId = null;
      let currentToolName = null;
      let toolArgBuffer = "";
      let totalOutput = 0;
      let hasToolUse = false;

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += dec.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();

            if (raw === "[DONE]") {
              // Close any open content block
              if (contentStarted) {
                ctrl.enqueue(enc.encode(sse("content_block_stop", { type: "content_block_stop", index: 0 })));
              }
              // Close any open tool block
              if (currentToolId) {
                ctrl.enqueue(enc.encode(sse("content_block_delta", {
                  type: "content_block_delta", index: toolIndex,
                  delta: { type: "input_json_delta", partial_json: "" },
                })));
                ctrl.enqueue(enc.encode(sse("content_block_stop", { type: "content_block_stop", index: toolIndex })));
              }

              ctrl.enqueue(enc.encode(sse("message_delta", {
                type: "message_delta",
                delta: { stop_reason: hasToolUse ? "tool_use" : "end_turn", stop_sequence: null },
                usage: { output_tokens: totalOutput },
              })));
              ctrl.enqueue(enc.encode(sse("message_stop", { type: "message_stop" })));
              continue;
            }

            try {
              const chunk = JSON.parse(raw);
              const delta = chunk.choices?.[0]?.delta;
              if (!delta) continue;

              // Text content
              if (delta.content) {
                if (!contentStarted) {
                  ctrl.enqueue(enc.encode(sse("content_block_start", {
                    type: "content_block_start", index: 0,
                    content_block: { type: "text", text: "" },
                  })));
                  contentStarted = true;
                }
                totalOutput += delta.content.length;
                ctrl.enqueue(enc.encode(sse("content_block_delta", {
                  type: "content_block_delta", index: 0,
                  delta: { type: "text_delta", text: delta.content },
                })));
              }

              // Tool calls
              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.id && tc.id !== currentToolId) {
                    // Close previous text block if open
                    if (contentStarted && !currentToolId) {
                      ctrl.enqueue(enc.encode(sse("content_block_stop", { type: "content_block_stop", index: 0 })));
                    }
                    // Close previous tool block
                    if (currentToolId) {
                      ctrl.enqueue(enc.encode(sse("content_block_stop", { type: "content_block_stop", index: toolIndex })));
                    }

                    hasToolUse = true;
                    toolIndex = contentStarted ? 1 + (tc.index || 0) : tc.index || 0;
                    currentToolId = tc.id;
                    currentToolName = tc.function?.name || "";
                    toolArgBuffer = "";

                    ctrl.enqueue(enc.encode(sse("content_block_start", {
                      type: "content_block_start", index: toolIndex,
                      content_block: { type: "tool_use", id: currentToolId, name: currentToolName, input: {} },
                    })));
                  }

                  if (tc.function?.arguments) {
                    toolArgBuffer += tc.function.arguments;
                    totalOutput += tc.function.arguments.length;
                    ctrl.enqueue(enc.encode(sse("content_block_delta", {
                      type: "content_block_delta", index: toolIndex,
                      delta: { type: "input_json_delta", partial_json: tc.function.arguments },
                    })));
                  }
                }
              }
            } catch {}
          }
        }
      } catch (err) {
        console.error("Stream error:", err.message);
      }
      ctrl.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}

// ─── Server ───

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health" || url.pathname === "/") {
      return Response.json({ status: "ok", model: OPENROUTER_MODEL });
    }

    if (url.pathname === "/v1/messages" && req.method === "POST") {
      try {
        const body = await req.json();
        const orReq = buildOpenRouterRequest(body);
        const requestModel = body.model;
        const toolCount = body.tools?.length || 0;

        console.log(`[${new Date().toLocaleTimeString()}] ${requestModel} -> ${OPENROUTER_MODEL} | tools: ${toolCount} | stream: ${orReq.stream}`);

        const resp = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENROUTER_KEY}`,
            "HTTP-Referer": "http://localhost:4000",
            "X-Title": "Claude Code Local",
          },
          body: JSON.stringify(orReq),
        });

        if (!resp.ok) {
          const err = await resp.text();
          console.error("OpenRouter error:", err);
          return Response.json({ type: "error", error: { type: "api_error", message: err } }, { status: 500 });
        }

        if (orReq.stream) return handleStream(resp, requestModel);

        const data = await resp.json();
        return Response.json(convertResponseToAnthropic(data, requestModel));
      } catch (err) {
        console.error("Proxy error:", err.message);
        return Response.json({ type: "error", error: { type: "api_error", message: String(err) } }, { status: 500 });
      }
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`
╔══════════════════════════════════════════════════╗
║   Anthropic → OpenRouter Proxy v2               ║
║   Port: ${String(PORT).padEnd(40)}║
║   Model: ${OPENROUTER_MODEL.padEnd(39)}║
║   Tools: ✅ Supported                           ║
╚══════════════════════════════════════════════════╝
`);
