"use client";

import { createContext, useContext, useMemo } from "react";
import { useCollaboration } from "@/hooks/useCollaboration";
import { usePresence } from "@/hooks/usePresence";
import type { CollabUser, CollabRole } from "@/lib/collaboration/socket";
import type { CollabAnnotation, PendingToolUse, LinkExpiry, ShareLink } from "@/lib/collaboration/types";
import type { PresenceState } from "@/lib/collaboration/presence";
import { createShareLink } from "@/lib/collaboration/permissions";

// ─── Context Shape ────────────────────────────────────────────────────────────

interface CollaborationContextValue {
  // Connection
  isConnected: boolean;
  sessionId: string;
  currentUser: CollabUser;

  // Roles & policy
  myRole: CollabRole | null;
  toolApprovalPolicy: "owner-only" | "any-collaborator";

  // Presence
  presence: PresenceState;
  otherUsers: CollabUser[];
  typingUsers: CollabUser[];

  // Tool approvals
  pendingToolUses: PendingToolUse[];
  approveTool: (toolUseId: string) => void;
  denyTool: (toolUseId: string) => void;

  // Annotations
  annotations: Record<string, CollabAnnotation[]>;
  addAnnotation: (messageId: string, text: string) => void;
  resolveAnnotation: (annotationId: string, resolved: boolean) => void;
  replyAnnotation: (annotationId: string, text: string) => void;

  // Presence actions
  sendCursorUpdate: (pos: number, start?: number, end?: number) => void;
  notifyTyping: () => void;
  stopTyping: () => void;

  // Session management
  generateShareLink: (role: CollabRole, expiry: LinkExpiry) => ShareLink;
  revokeAccess: (userId: string) => void;
  changeRole: (userId: string, role: CollabRole) => void;
  transferOwnership: (userId: string) => void;
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface CollaborationProviderProps {
  sessionId: string;
  currentUser: CollabUser;
  wsUrl?: string;
  children: React.ReactNode;
}

export function CollaborationProvider({
  sessionId,
  currentUser,
  wsUrl,
  children,
}: CollaborationProviderProps) {
  // useCollaboration creates the socket synchronously (via useRef) and returns it
  const collab = useCollaboration({ sessionId, currentUser, wsUrl });

  // usePresence subscribes to the same socket for presence-specific events
  const presence = usePresence({
    socket: collab.socket,
    sessionId,
    currentUser,
  });

  const generateShareLink = useMemo(
    () => (role: CollabRole, expiry: LinkExpiry) =>
      createShareLink(sessionId, role, expiry, currentUser.id),
    [sessionId, currentUser.id]
  );

  const value: CollaborationContextValue = {
    isConnected: collab.isConnected,
    sessionId,
    currentUser,
    myRole: collab.myRole,
    toolApprovalPolicy: collab.toolApprovalPolicy,
    presence: presence.presence,
    otherUsers: presence.otherUsers,
    typingUsers: presence.typingUsers,
    pendingToolUses: collab.pendingToolUses,
    approveTool: collab.approveTool,
    denyTool: collab.denyTool,
    annotations: collab.annotations,
    addAnnotation: collab.addAnnotation,
    resolveAnnotation: collab.resolveAnnotation,
    replyAnnotation: collab.replyAnnotation,
    sendCursorUpdate: presence.sendCursorUpdate,
    notifyTyping: presence.notifyTyping,
    stopTyping: presence.stopTyping,
    generateShareLink,
    revokeAccess: collab.revokeAccess,
    changeRole: collab.changeRole,
    transferOwnership: collab.transferOwnership,
  };

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
}

// ─── Consumer Hooks ───────────────────────────────────────────────────────────

export function useCollaborationContext(): CollaborationContextValue {
  const ctx = useContext(CollaborationContext);
  if (!ctx) {
    throw new Error(
      "useCollaborationContext must be used inside <CollaborationProvider>"
    );
  }
  return ctx;
}

/**
 * Returns null when there is no active collaboration session.
 * Safe to call in components that render both inside and outside a session.
 */
export function useCollaborationContextOptional(): CollaborationContextValue | null {
  return useContext(CollaborationContext);
}
