import type { Conversation } from "./types";
import { extractTextContent } from "./utils";

/** Export a single conversation as a Markdown string. */
export function exportAsMarkdown(conv: Conversation): string {
  const lines: string[] = [
    `# ${conv.title}`,
    ``,
    `> Created: ${new Date(conv.createdAt).toLocaleString()}`,
    `> Model: ${conv.model ?? "unknown"}`,
    ``,
  ];

  for (const msg of conv.messages) {
    const role = msg.role === "user" ? "**You**" : msg.role === "assistant" ? "**Claude**" : `**${msg.role}**`;
    const text = extractTextContent(msg.content);
    lines.push(`### ${role}`);
    lines.push(``);
    lines.push(text || "_[no text content]_");
    lines.push(``);
  }

  return lines.join("\n");
}

/** Export a single conversation as a JSON string (pretty-printed). */
export function exportAsJson(conv: Conversation): string {
  return JSON.stringify(conv, null, 2);
}

/** Trigger a file download in the browser. */
export function downloadFile(filename: string, content: string, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export a single conversation to the browser as Markdown. */
export function exportConversation(conv: Conversation, format: "markdown" | "json" = "markdown") {
  const safe = conv.title.replace(/[^a-z0-9\-_]/gi, "_").slice(0, 60);
  if (format === "json") {
    downloadFile(`${safe}.json`, exportAsJson(conv), "application/json");
  } else {
    downloadFile(`${safe}.md`, exportAsMarkdown(conv), "text/markdown");
  }
}

/**
 * Export multiple conversations as a pseudo-ZIP (JSON lines archive).
 * A real ZIP would need a library like JSZip — this exports a newline-delimited
 * JSON file as a practical no-dependency alternative.
 */
export function exportConversationsAsZip(conversations: Conversation[]) {
  const content = conversations.map((c) => JSON.stringify(c)).join("\n");
  downloadFile(
    `conversations-${new Date().toISOString().slice(0, 10)}.jsonl`,
    content,
    "application/x-ndjson"
  );
}
