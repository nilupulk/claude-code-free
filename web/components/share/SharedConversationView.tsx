"use client";

import { useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronRight, Bot, User, Wrench } from "lucide-react";
import type { SharedConversation } from "@/lib/types";
import type { Message, ContentBlock } from "@/lib/types";
import { MarkdownContent } from "@/components/chat/MarkdownContent";
import { extractTextContent } from "@/lib/utils";
import { cn } from "@/lib/utils";

function ToolUseBlock({ name, input }: { name: string; input: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="flex items-center gap-2 text-xs text-surface-500 hover:text-surface-300 transition-colors py-1 group">
        <ChevronRight className={cn("w-3 h-3 transition-transform", open && "rotate-90")} />
        <Wrench className="w-3 h-3 text-amber-500" />
        <span className="font-mono text-amber-400">{name}</span>
        <span className="text-surface-600 group-hover:text-surface-500">— click to expand</span>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <pre className="mt-1 text-xs font-mono bg-surface-900 border border-surface-800 rounded p-2.5 overflow-x-auto text-surface-400 whitespace-pre">
          {JSON.stringify(input, null, 2)}
        </pre>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

function ToolResultBlock({ content, isError }: { content: string | ContentBlock[]; isError?: boolean }) {
  const [open, setOpen] = useState(false);
  const text = typeof content === "string" ? content : extractTextContent(content);
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="flex items-center gap-2 text-xs text-surface-500 hover:text-surface-300 transition-colors py-1 group">
        <ChevronRight className={cn("w-3 h-3 transition-transform", open && "rotate-90")} />
        <span className={cn("font-medium", isError ? "text-red-400" : "text-green-400")}>
          {isError ? "Tool error" : "Tool result"}
        </span>
        <span className="text-surface-600 group-hover:text-surface-500">— click to expand</span>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <pre className="mt-1 text-xs font-mono bg-surface-900 border border-surface-800 rounded p-2.5 overflow-x-auto text-surface-400 whitespace-pre-wrap break-words max-h-48">
          {text.slice(0, 2000)}{text.length > 2000 ? "\n…[truncated]" : ""}
        </pre>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

function MessageBlock({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-4", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
          isUser ? "bg-brand-600 text-white" : "bg-surface-700 text-surface-300"
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-w-0 max-w-3xl", isUser && "flex justify-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm",
            isUser
              ? "bg-brand-600 text-white rounded-tr-sm"
              : "bg-surface-800 text-surface-100 rounded-tl-sm"
          )}
        >
          {typeof message.content === "string" ? (
            isUser ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              <MarkdownContent content={message.content} />
            )
          ) : (
            <div className="flex flex-col gap-2">
              {message.content.map((block, i) => {
                if (block.type === "text") {
                  return isUser ? (
                    <p key={i} className="whitespace-pre-wrap break-words">{block.text}</p>
                  ) : (
                    <MarkdownContent key={i} content={block.text} />
                  );
                }
                if (block.type === "tool_use") {
                  return <ToolUseBlock key={i} name={block.name} input={block.input} />;
                }
                if (block.type === "tool_result") {
                  return <ToolResultBlock key={i} content={block.content} isError={block.is_error} />;
                }
                return null;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SharedConversationViewProps {
  shared: SharedConversation;
}

export function SharedConversationView({ shared }: SharedConversationViewProps) {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-100">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface-950/80 backdrop-blur-sm border-b border-surface-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-surface-100 truncate">{shared.title}</h1>
            <p className="text-xs text-surface-500">
              {shared.messages.length} messages
              {shared.model && ` · ${shared.model}`}
            </p>
          </div>
          <a
            href="https://claude.ai/code"
            className="text-xs text-surface-500 hover:text-surface-300 transition-colors flex-shrink-0 ml-4"
          >
            Claude Code ↗
          </a>
        </div>
      </header>

      {/* Messages */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          {shared.messages.map((msg) => (
            <MessageBlock key={msg.id} message={msg} />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-800 py-6 mt-8">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <a
            href="https://claude.ai/code"
            className="text-xs text-surface-500 hover:text-brand-400 transition-colors"
          >
            Powered by Claude Code
          </a>
          <p className="text-xs text-surface-700 mt-1">
            Shared on {new Date(shared.shareCreatedAt).toLocaleDateString()}
          </p>
        </div>
      </footer>
    </div>
  );
}
