"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useChatStore } from "@/lib/store";
import { useTheme } from "@/components/layout/ThemeProvider";
import { SettingRow, SectionHeader, Toggle, Slider } from "./SettingRow";
import { cn } from "@/lib/utils";
import type { TerminalTheme, TerminalEffects } from "@/lib/types";

const TERMINAL_THEMES: { id: TerminalTheme; label: string; accent: string }[] = [
  { id: "tokyo-night",    label: "Tokyo Night",    accent: "#7aa2f7" },
  { id: "dracula",        label: "Dracula",        accent: "#bd93f9" },
  { id: "solarized-dark", label: "Solarized Dark", accent: "#268bd2" },
  { id: "monokai",        label: "Monokai",        accent: "#a6e22e" },
  { id: "green-screen",   label: "Green Screen",   accent: "#00cc00" },
  { id: "amber",          label: "Amber",          accent: "#cc8800" },
];

export function GeneralSettings() {
  const { settings, updateSettings, resetSettings } = useChatStore();
  const { setTheme, setTerminalTheme } = useTheme();

  const themes = [
    { id: "light" as const, label: "Light", icon: Sun },
    { id: "dark" as const, label: "Dark", icon: Moon },
    { id: "system" as const, label: "System", icon: Monitor },
  ];

  function handleThemeChange(t: "light" | "dark" | "system") {
    updateSettings({ theme: t });
    setTheme(t);
  }

  function handleTerminalThemeChange(t: TerminalTheme) {
    updateSettings({ terminalTheme: t });
    setTerminalTheme(t);
  }

  function handleEffectToggle(key: keyof TerminalEffects, value: boolean) {
    updateSettings({
      terminalEffects: { ...settings.terminalEffects, [key]: value },
    });
  }

  return (
    <div>
      <SectionHeader title="General" onReset={() => resetSettings("general")} />

      <SettingRow
        label="Theme"
        description="Choose the color scheme for the interface."
      >
        <div className="flex gap-1.5">
          {themes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleThemeChange(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                settings.theme === id
                  ? "bg-brand-600 text-white"
                  : "bg-surface-800 text-surface-400 hover:text-surface-200"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow
        label="Chat font size"
        description="Font size for messages in the chat window."
        stack
      >
        <Slider
          value={settings.fontSize.chat}
          min={12}
          max={20}
          onChange={(v) =>
            updateSettings({ fontSize: { ...settings.fontSize, chat: v } })
          }
          unit="px"
        />
      </SettingRow>

      <SettingRow
        label="Code font size"
        description="Font size for code blocks and inline code."
        stack
      >
        <Slider
          value={settings.fontSize.code}
          min={10}
          max={18}
          onChange={(v) =>
            updateSettings({ fontSize: { ...settings.fontSize, code: v } })
          }
          unit="px"
        />
      </SettingRow>

      <SettingRow
        label="Send on Enter"
        description="Press Enter to send messages. When off, use Cmd+Enter or Ctrl+Enter."
      >
        <Toggle
          checked={settings.sendOnEnter}
          onChange={(v) => updateSettings({ sendOnEnter: v })}
        />
      </SettingRow>

      <SettingRow
        label="Show timestamps"
        description="Display the time each message was sent."
      >
        <Toggle
          checked={settings.showTimestamps}
          onChange={(v) => updateSettings({ showTimestamps: v })}
        />
      </SettingRow>

      <SettingRow
        label="Compact mode"
        description="Reduce spacing between messages for higher information density."
      >
        <Toggle
          checked={settings.compactMode}
          onChange={(v) => updateSettings({ compactMode: v })}
        />
      </SettingRow>

      <SectionHeader title="Terminal Theme" />

      <SettingRow
        label="Color palette"
        description="Terminal color scheme applied to the interface."
        stack
      >
        <div className="grid grid-cols-3 gap-1.5 w-full">
          {TERMINAL_THEMES.map(({ id, label, accent }) => (
            <button
              key={id}
              onClick={() => handleTerminalThemeChange(id)}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-mono transition-colors",
                settings.terminalTheme === id
                  ? "bg-surface-800 ring-1 text-surface-100"
                  : "bg-surface-900 text-surface-400 hover:text-surface-200"
              )}
              style={
                settings.terminalTheme === id ? { color: accent } : undefined
              }
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: accent }}
              />
              {label}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow
        label="Scanlines"
        description="Overlay subtle horizontal lines for a CRT monitor effect."
      >
        <Toggle
          checked={settings.terminalEffects?.scanlines ?? false}
          onChange={(v) => handleEffectToggle("scanlines", v)}
        />
      </SettingRow>

      <SettingRow
        label="Phosphor glow"
        description="Add a soft text glow reminiscent of phosphor displays."
      >
        <Toggle
          checked={settings.terminalEffects?.glow ?? false}
          onChange={(v) => handleEffectToggle("glow", v)}
        />
      </SettingRow>

      <SettingRow
        label="CRT curvature"
        description="Subtle barrel-distortion effect mimicking curved CRT screens."
      >
        <Toggle
          checked={settings.terminalEffects?.curvature ?? false}
          onChange={(v) => handleEffectToggle("curvature", v)}
        />
      </SettingRow>

      <SettingRow
        label="Screen flicker"
        description="Occasional brightness variation for an authentic retro feel."
      >
        <Toggle
          checked={settings.terminalEffects?.flicker ?? false}
          onChange={(v) => handleEffectToggle("flicker", v)}
        />
      </SettingRow>
    </div>
  );
}
