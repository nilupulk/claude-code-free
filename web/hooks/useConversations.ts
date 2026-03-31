"use client";

import { useCallback } from "react";
import { useChatStore } from "@/lib/store";
import { conversationAPI } from "@/lib/api/conversations";
import type { Conversation } from "@/lib/types";

export interface UseConversationsOptions {
  limit?: number;
  offset?: number;
}

export interface UseConversationsReturn {
  conversations: Conversation[];
  activeConversationId: string | null;
  /** Create a new conversation and make it active. */
  create: (opts?: { title?: string; model?: string }) => Promise<Conversation>;
  /** Permanently delete a conversation. */
  remove: (id: string) => Promise<void>;
  /** Update title or model of a conversation. */
  update: (
    id: string,
    updates: Partial<Pick<Conversation, "title" | "model">>
  ) => Promise<Conversation>;
  /** Make a conversation the active one. */
  setActive: (id: string) => void;
  /** Export a conversation as JSON or Markdown and trigger a download. */
  exportAndDownload: (
    id: string,
    format: "json" | "markdown"
  ) => Promise<void>;
}

/**
 * Manages the conversation list with real-time updates from the Zustand store.
 *
 * Because conversations live entirely client-side (localStorage via Zustand),
 * updates are synchronous and reflected instantly — no network round-trip.
 *
 * @example
 * const { conversations, create, remove, setActive } = useConversations();
 */
export function useConversations(
  opts?: UseConversationsOptions
): UseConversationsReturn {
  const { limit = 50, offset = 0 } = opts ?? {};

  // Subscribe to the relevant slice of the store so the component re-renders
  // whenever conversations change.
  const allConversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore(
    (state) => state.activeConversationId
  );
  const setActiveConversation = useChatStore(
    (state) => state.setActiveConversation
  );

  const conversations = allConversations.slice(offset, offset + limit);

  const create = useCallback(
    async (createOpts?: { title?: string; model?: string }) => {
      return conversationAPI.create(createOpts);
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    return conversationAPI.delete(id);
  }, []);

  const update = useCallback(
    async (
      id: string,
      updates: Partial<Pick<Conversation, "title" | "model">>
    ) => {
      return conversationAPI.update(id, updates);
    },
    []
  );

  const setActive = useCallback(
    (id: string) => {
      setActiveConversation(id);
    },
    [setActiveConversation]
  );

  const exportAndDownload = useCallback(
    async (id: string, format: "json" | "markdown") => {
      const blob = await conversationAPI.export(id, format);
      const conv = allConversations.find((c) => c.id === id);
      const filename =
        format === "json"
          ? `${conv?.title ?? id}.json`
          : `${conv?.title ?? id}.md`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    [allConversations]
  );

  return {
    conversations,
    activeConversationId,
    create,
    remove,
    update,
    setActive,
    exportAndDownload,
  };
}
