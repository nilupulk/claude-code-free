import { http, HttpResponse } from "msw";

const BASE = "http://localhost:3001";

export const handlers = [
  // Chat streaming endpoint
  http.post("/api/chat", () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"type":"text","content":"Hello"}\n\n')
        );
        controller.enqueue(
          encoder.encode('data: {"type":"text","content":" world"}\n\n')
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return new HttpResponse(stream, {
      headers: { "Content-Type": "text/event-stream" },
    });
  }),

  // Conversations list
  http.get(`${BASE}/api/conversations`, () => {
    return HttpResponse.json([
      {
        id: "conv-1",
        title: "Test Conversation",
        preview: "Hello there",
        updatedAt: Date.now(),
        createdAt: Date.now() - 3600_000,
        model: "claude-sonnet-4-6",
        isPinned: false,
        hasActiveTools: false,
      },
    ]);
  }),

  // Single conversation
  http.get(`${BASE}/api/conversations/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      title: "Test Conversation",
      messages: [],
      createdAt: Date.now() - 3600_000,
      updatedAt: Date.now(),
      model: "claude-sonnet-4-6",
    });
  }),

  // Health check
  http.get(`${BASE}/health`, () => {
    return HttpResponse.json({ status: "ok" });
  }),

  // Export
  http.get("/api/export", ({ request }) => {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "markdown";
    return new HttpResponse(`# Exported ${format}`, {
      headers: { "Content-Type": "text/plain" },
    });
  }),
];
