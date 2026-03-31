"use client";

import { useState, useRef } from "react";
import { X, CheckCircle, Circle, Reply } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getInitials } from "@/lib/collaboration/presence";
import { canAddAnnotations } from "@/lib/collaboration/permissions";
import { useCollaborationContextOptional } from "./CollaborationProvider";
import type { CollabAnnotation } from "@/lib/collaboration/types";
import type { AnnotationReply } from "@/lib/collaboration/socket";
import { cn } from "@/lib/utils";

// ─── Single Reply ─────────────────────────────────────────────────────────────

function ReplyItem({ reply }: { reply: AnnotationReply }) {
  const timestamp = new Date(reply.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex gap-2 pl-4 border-l border-surface-700">
      <div
        className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white mt-0.5"
        style={{ backgroundColor: reply.author.color }}
      >
        {getInitials(reply.author.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-medium text-surface-200">
            {reply.author.name}
          </span>
          <span className="text-[10px] text-surface-500">{timestamp}</span>
        </div>
        <p className="text-xs text-surface-300 mt-0.5">{reply.text}</p>
      </div>
    </div>
  );
}

// ─── Single Annotation ────────────────────────────────────────────────────────

interface AnnotationItemProps {
  annotation: CollabAnnotation;
  canReply: boolean;
  canResolve: boolean;
  onResolve: () => void;
  onReply: (text: string) => void;
}

function AnnotationItem({
  annotation,
  canReply,
  canResolve,
  onResolve,
  onReply,
}: AnnotationItemProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const timestamp = new Date(annotation.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleReply = () => {
    if (!replyText.trim()) return;
    onReply(replyText.trim());
    setReplyText("");
    setShowReply(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border p-3 space-y-2",
        annotation.resolved
          ? "border-surface-700 bg-surface-800/50 opacity-60"
          : "border-surface-600 bg-surface-800"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <div
          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
          style={{ backgroundColor: annotation.author.color }}
        >
          {getInitials(annotation.author.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-1">
            <span className="text-xs font-medium text-surface-200">
              {annotation.author.name}
            </span>
            <span className="text-[10px] text-surface-500 flex-shrink-0">
              {timestamp}
            </span>
          </div>
          <p className="text-xs text-surface-300 mt-0.5">{annotation.text}</p>
        </div>
      </div>

      {/* Replies */}
      {annotation.replies.length > 0 && (
        <div className="space-y-2">
          {annotation.replies.map((r) => (
            <ReplyItem key={r.id} reply={r} />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {canReply && (
          <button
            onClick={() => setShowReply((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-surface-400 hover:text-surface-200 transition-colors"
          >
            <Reply className="w-3 h-3" />
            Reply
          </button>
        )}
        {canResolve && (
          <button
            onClick={onResolve}
            className={cn(
              "flex items-center gap-1 text-[10px] transition-colors ml-auto",
              annotation.resolved
                ? "text-green-400 hover:text-surface-400"
                : "text-surface-400 hover:text-green-400"
            )}
          >
            {annotation.resolved ? (
              <>
                <CheckCircle className="w-3 h-3" /> Resolved
              </>
            ) : (
              <>
                <Circle className="w-3 h-3" /> Resolve
              </>
            )}
          </button>
        )}
      </div>

      {/* Reply input */}
      <AnimatePresence>
        {showReply && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 pt-1">
              <input
                autoFocus
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleReply();
                  if (e.key === "Escape") setShowReply(false);
                }}
                placeholder="Reply…"
                className={cn(
                  "flex-1 text-xs bg-surface-700 border border-surface-600 rounded px-2 py-1",
                  "text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                )}
              />
              <button
                onClick={handleReply}
                disabled={!replyText.trim()}
                className="text-xs px-2 py-1 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── AnnotationThread ─────────────────────────────────────────────────────────

interface AnnotationThreadProps {
  messageId: string;
  onClose: () => void;
}

export function AnnotationThread({ messageId, onClose }: AnnotationThreadProps) {
  const ctx = useCollaborationContextOptional();
  const [newText, setNewText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!ctx) return null;

  const annotations = ctx.annotations[messageId] ?? [];
  const myRole = ctx.myRole;
  const canWrite = myRole ? canAddAnnotations(myRole) : false;

  const handleAdd = () => {
    if (!newText.trim()) return;
    ctx.addAnnotation(messageId, newText.trim());
    setNewText("");
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-surface-700 bg-surface-900 shadow-xl",
        "flex flex-col max-h-[400px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-700">
        <h3 className="text-xs font-semibold text-surface-200">
          Comments{" "}
          {annotations.length > 0 && (
            <span className="text-surface-500">({annotations.length})</span>
          )}
        </h3>
        <button
          onClick={onClose}
          className="text-surface-500 hover:text-surface-200 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        <AnimatePresence initial={false}>
          {annotations.length === 0 ? (
            <p className="text-xs text-surface-500 text-center py-4">
              No comments yet
            </p>
          ) : (
            annotations.map((ann) => (
              <AnnotationItem
                key={ann.id}
                annotation={ann}
                canReply={canWrite}
                canResolve={canWrite}
                onResolve={() => ctx.resolveAnnotation(ann.id, !ann.resolved)}
                onReply={(text) => ctx.replyAnnotation(ann.id, text)}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* New comment input */}
      {canWrite && (
        <div className="border-t border-surface-700 px-3 py-2 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Add a comment…"
            className={cn(
              "flex-1 text-xs bg-surface-800 border border-surface-700 rounded px-2 py-1.5",
              "text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            )}
          />
          <button
            onClick={handleAdd}
            disabled={!newText.trim()}
            className="text-xs px-2.5 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Post
          </button>
        </div>
      )}
    </div>
  );
}
