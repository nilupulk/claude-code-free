"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Search } from "lucide-react";
import { useChatStore } from "@/lib/store";
import { SettingsNav, type SettingsSection } from "./SettingsNav";
import { GeneralSettings } from "./GeneralSettings";
import { ModelSettings } from "./ModelSettings";
import { ApiSettings } from "./ApiSettings";
import { PermissionSettings } from "./PermissionSettings";
import { McpSettings } from "./McpSettings";
import { KeyboardSettings } from "./KeyboardSettings";
import { DataSettings } from "./DataSettings";
import { cn } from "@/lib/utils";

const SECTION_COMPONENTS: Record<SettingsSection, React.ComponentType> = {
  general: GeneralSettings,
  model: ModelSettings,
  api: ApiSettings,
  permissions: PermissionSettings,
  mcp: McpSettings,
  keyboard: KeyboardSettings,
  data: DataSettings,
};

export function SettingsView() {
  const { settingsOpen, closeSettings } = useChatStore();
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const [searchQuery, setSearchQuery] = useState("");

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && settingsOpen) closeSettings();
    },
    [settingsOpen, closeSettings]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Lock body scroll while open
  useEffect(() => {
    if (settingsOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  const SectionComponent = SECTION_COMPONENTS[activeSection];

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeSettings}
      />

      {/* Panel */}
      <div
        className={cn(
          "relative z-10 flex flex-col w-full max-w-4xl mx-auto my-8 rounded-xl",
          "bg-surface-900 border border-surface-800 shadow-2xl",
          "animate-in fade-in slide-in-from-bottom-4 duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 flex-shrink-0">
          <h1 className="text-base font-semibold text-surface-100">Settings</h1>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search settings..."
                className={cn(
                  "bg-surface-800 border border-surface-700 rounded-md pl-8 pr-3 py-1.5 text-sm w-56",
                  "text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                )}
              />
            </div>
            <button
              onClick={closeSettings}
              className="p-1.5 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors"
              title="Close settings (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left nav */}
          <div className="flex-shrink-0 px-3 py-2 border-r border-surface-800 overflow-y-auto">
            <SettingsNav
              active={activeSection}
              onChange={setActiveSection}
              searchQuery={searchQuery}
            />
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <SectionComponent />
          </div>
        </div>
      </div>
    </div>
  );
}
