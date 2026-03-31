"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/lib/store";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ChatWindow } from "./ChatWindow";
import { ChatInput } from "./ChatInput";
import { SkipToContent } from "@/components/a11y/SkipToContent";
import { AnnouncerProvider } from "@/components/a11y/Announcer";
import { MobileSidebar } from "@/components/mobile/MobileSidebar";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { MobileInput } from "@/components/mobile/MobileInput";
import { useViewportHeight } from "@/hooks/useViewportHeight";
import { useTouchGesture } from "@/hooks/useTouchGesture";
import { MODELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SettingsView } from "@/components/settings/SettingsView";
import {
  CommandRegistryProvider,
  useCommandRegistry,
} from "@/hooks/useCommandRegistry";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { ShortcutsHelp } from "@/components/shortcuts/ShortcutsHelp";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { CMD } from "@/lib/shortcuts";
import { useTheme } from "@/components/layout/ThemeProvider";
import { TypingIndicator } from "@/components/collaboration/TypingIndicator";

function KeyboardSetup() {
  const store = useChatStore();
  const { registerCommand, openPalette, openHelp } = useCommandRegistry();
  const { theme, setTheme } = useTheme();

  const storeRef = useRef(store);
  const themeRef = useRef({ theme, setTheme });

  useEffect(() => { storeRef.current = store; });
  useEffect(() => { themeRef.current = { theme, setTheme }; });

  useEffect(() => {
    const navigateConversation = (direction: "prev" | "next") => {
      const { conversations, activeConversationId, setActiveConversation } = storeRef.current;
      const idx = conversations.findIndex((c) => c.id === activeConversationId);
      if (idx === -1) return;
      const next = direction === "prev" ? idx - 1 : idx + 1;
      if (next >= 0 && next < conversations.length) setActiveConversation(conversations[next].id);
    };

    const cleanups = [
      registerCommand({ id: CMD.OPEN_PALETTE, keys: ["mod+k", "mod+shift+p"], label: "Open command palette", description: "Search and run any command", category: "Navigation", action: openPalette, global: true, icon: "Search" }),
      registerCommand({ id: CMD.NEW_CONVERSATION, keys: ["mod+n"], label: "New conversation", description: "Start a fresh chat", category: "Chat", action: () => storeRef.current.createConversation(), global: true, icon: "MessageSquarePlus" }),
      registerCommand({ id: CMD.TOGGLE_SIDEBAR, keys: ["mod+b", "mod+/"], label: "Toggle sidebar", description: "Show or hide the conversation list", category: "View", action: () => storeRef.current.toggleSidebar(), global: true, icon: "PanelLeftClose" }),
      registerCommand({ id: CMD.OPEN_SETTINGS, keys: ["mod+,"], label: "Open settings", description: "Configure Claude Code", category: "Navigation", action: () => storeRef.current.openSettings(), global: true, icon: "Settings" }),
      registerCommand({ id: CMD.TOGGLE_THEME, keys: ["mod+d"], label: "Toggle theme", description: "Cycle between dark, light, and system themes", category: "Theme", action: () => { const { theme: t, setTheme: st } = themeRef.current; st(t === "dark" ? "light" : t === "light" ? "system" : "dark"); }, global: true, icon: "Sun" }),
      registerCommand({ id: CMD.PREV_CONVERSATION, keys: ["mod+["], label: "Previous conversation", description: "Switch to the conversation above", category: "Navigation", action: () => navigateConversation("prev"), global: true }),
      registerCommand({ id: CMD.NEXT_CONVERSATION, keys: ["mod+]"], label: "Next conversation", description: "Switch to the conversation below", category: "Navigation", action: () => navigateConversation("next"), global: true }),
      registerCommand({ id: CMD.FOCUS_CHAT, keys: ["/"], label: "Focus chat input", description: "Jump to the message input", category: "Chat", action: () => document.querySelector<HTMLTextAreaElement>("textarea")?.focus(), icon: "Zap" }),
      registerCommand({ id: CMD.SHOW_HELP, keys: ["?"], label: "Keyboard shortcuts", description: "Show all keyboard shortcuts", category: "Help", action: openHelp, icon: "HelpCircle" }),
      registerCommand({ id: CMD.GLOBAL_SEARCH, keys: ["mod+shift+f"], label: "Global search", description: "Search across all conversations", category: "Navigation", action: () => storeRef.current.openSearch(), global: true, icon: "Search" }),
      ...[1,2,3,4,5,6,7,8,9].map((n) => registerCommand({ id: `switch-conversation-${n}`, keys: [`mod+${n}`], label: `Switch to conversation ${n}`, description: `Jump to conversation #${n} in the list`, category: "Navigation", action: () => { const conv = storeRef.current.conversations[n - 1]; if (conv) storeRef.current.setActiveConversation(conv.id); }, global: true })),
    ];

    return () => cleanups.forEach((c) => c());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerCommand, openPalette, openHelp]);

  useKeyboardShortcuts();
  return null;
}

function ChatLayoutInner() {
  const { conversations, createConversation, activeConversationId, settings, updateSettings, sidebarOpen } = useChatStore();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { viewportHeight, keyboardHeight } = useViewportHeight();

  useEffect(() => {
    if (conversations.length === 0) createConversation();
  }, []);

  const edgeSwipeHandlers = useTouchGesture({ onSwipeRight: () => setMobileSidebarOpen(true), threshold: 30 });
  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const conversationTitle = activeConversation?.title ?? "New Conversation";
  const containerStyle = viewportHeight > 0 ? { height: viewportHeight } : undefined;

  const modelBadge = (
    <select value={settings.model} onChange={(e) => updateSettings({ model: e.target.value })} className={cn("text-xs bg-surface-800 border border-surface-700 rounded-md px-2 py-1 h-[36px]", "text-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500")} aria-label="Select model">
      {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
    </select>
  );

  return (
    <AnnouncerProvider>
      <KeyboardSetup />
      <SkipToContent />
      <div className="fixed top-0 left-0 bottom-0 w-5 z-30 lg:hidden" {...edgeSwipeHandlers} aria-hidden="true" />
      <div className="flex bg-surface-950 text-surface-100 overflow-hidden" style={containerStyle ?? { height: "100dvh" }}>
        {/* Sidebar controls its own width via framer-motion */}
        <div className="hidden lg:flex h-full flex-shrink-0">
          <Sidebar />
        </div>
        <MobileSidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
        <div className="flex flex-col flex-1 min-w-0">
          <div className="hidden lg:block"><Header /></div>
          <MobileHeader className="lg:hidden" title={conversationTitle} onMenuOpen={() => setMobileSidebarOpen(true)} right={modelBadge} />
          <main id="main-content" aria-label="Chat" className="flex flex-col flex-1 min-h-0">
            {activeConversationId ? (
              <>
                <ChatWindow conversationId={activeConversationId} />
                <TypingIndicator />
                <div className="hidden lg:block"><ChatInput conversationId={activeConversationId} /></div>
                <div className="lg:hidden"><MobileInput conversationId={activeConversationId} keyboardHeight={keyboardHeight} /></div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-surface-500">Select or create a conversation</div>
            )}
          </main>
        </div>
      </div>
      <SettingsView />
      <CommandPalette />
      <ShortcutsHelp />
      <GlobalSearch />
    </AnnouncerProvider>
  );
}

export function ChatLayout() {
  return (
    <CommandRegistryProvider>
      <ChatLayoutInner />
    </CommandRegistryProvider>
  );
}
