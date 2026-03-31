"use client";

/**
 * Web-adapted Settings panel.
 *
 * The terminal Settings (src/components/Settings/) renders modal tabs via Ink
 * dialogs.  This web version uses Radix UI Tabs + Dialog (already in the web
 * deps) to produce a full-screen settings drawer with sections matching the
 * terminal's Config / Status / Usage / MCP tabs.
 */

import * as React from "react";
import { useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import * as Switch from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/store";
import type { AppSettings } from "@/lib/types";
import { X, Plus, Trash2 } from "lucide-react";

// ─── Primitives ───────────────────────────────────────────────────────────────

function Label({
  htmlFor,
  children,
  description,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      <label
        htmlFor={htmlFor}
        className="text-sm text-surface-200 font-medium cursor-pointer"
      >
        {children}
      </label>
      {description && (
        <p className="text-xs text-surface-500 mt-0.5">{description}</p>
      )}
    </div>
  );
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-2.5 border-b border-surface-800 last:border-0", className)}>
      {children}
    </div>
  );
}

function TextInput({
  id, value, onChange, type = "text", placeholder, className,
}: {
  id?: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; className?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "bg-surface-800 border border-surface-700 rounded-md px-2.5 py-1.5",
        "text-sm text-surface-100 font-mono placeholder:text-surface-600",
        "focus:outline-none focus:border-brand-500 transition-colors w-44",
        className
      )}
    />
  );
}

function NumberInput({
  id, value, onChange, min, max, step = 1,
}: {
  id?: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <input
      id={id}
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={e => onChange(Number(e.target.value))}
      className={cn(
        "bg-surface-800 border border-surface-700 rounded-md px-2.5 py-1.5",
        "text-sm text-surface-100 font-mono w-28",
        "focus:outline-none focus:border-brand-500 transition-colors"
      )}
    />
  );
}

function Select({
  id, value, onChange, options,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn(
        "bg-surface-800 border border-surface-700 rounded-md px-2.5 py-1.5",
        "text-sm text-surface-100 font-mono w-44",
        "focus:outline-none focus:border-brand-500 transition-colors"
      )}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function ToggleRow({
  label, description, value, onChange, id,
}: {
  label: string; description?: string;
  value: boolean; onChange: (v: boolean) => void; id: string;
}) {
  return (
    <Row>
      <Label htmlFor={id} description={description}>{label}</Label>
      <Switch.Root
        id={id}
        checked={value}
        onCheckedChange={onChange}
        className={cn(
          "relative inline-flex h-5 w-9 rounded-full transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
          value ? "bg-brand-600" : "bg-surface-700"
        )}
      >
        <Switch.Thumb
          className={cn(
            "block h-4 w-4 rounded-full bg-white shadow transition-transform",
            "translate-x-0.5 data-[state=checked]:translate-x-4"
          )}
        />
      </Switch.Root>
    </Row>
  );
}

// ─── Tab: General ─────────────────────────────────────────────────────────────

function GeneralTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (s: Partial<AppSettings>) => void;
}) {
  return (
    <div className="space-y-0">
      <Row>
        <Label htmlFor="theme" description="Colour scheme for the interface">Theme</Label>
        <Select
          id="theme"
          value={settings.theme}
          onChange={v => update({ theme: v as AppSettings["theme"] })}
          options={[
            { value: "dark",   label: "Dark" },
            { value: "light",  label: "Light" },
            { value: "system", label: "System" },
          ]}
        />
      </Row>

      <ToggleRow
        id="send-on-enter"
        label="Send on Enter"
        description="Press Enter to send; Shift+Enter for newline"
        value={settings.sendOnEnter}
        onChange={v => update({ sendOnEnter: v })}
      />

      <ToggleRow
        id="show-timestamps"
        label="Show timestamps"
        description="Display message timestamps"
        value={settings.showTimestamps}
        onChange={v => update({ showTimestamps: v })}
      />

      <ToggleRow
        id="compact-mode"
        label="Compact mode"
        description="Dim older messages to focus on the current exchange"
        value={settings.compactMode}
        onChange={v => update({ compactMode: v })}
      />

      <ToggleRow
        id="streaming"
        label="Streaming"
        description="Stream responses as they are generated"
        value={settings.streamingEnabled}
        onChange={v => update({ streamingEnabled: v })}
      />

      <ToggleRow
        id="telemetry"
        label="Telemetry"
        description="Send anonymous usage statistics to improve Claude Code"
        value={settings.telemetryEnabled}
        onChange={v => update({ telemetryEnabled: v })}
      />
    </div>
  );
}

// ─── Tab: Model ───────────────────────────────────────────────────────────────

const MODEL_OPTIONS = [
  { value: "claude-opus-4-6",           label: "Claude Opus 4.6" },
  { value: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];

function ModelTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (s: Partial<AppSettings>) => void;
}) {
  return (
    <div className="space-y-0">
      <Row>
        <Label htmlFor="model" description="Model used for new conversations">Model</Label>
        <Select
          id="model"
          value={settings.model}
          onChange={v => update({ model: v })}
          options={MODEL_OPTIONS}
        />
      </Row>

      <Row>
        <Label htmlFor="max-tokens" description="Maximum output tokens per response">Max tokens</Label>
        <NumberInput
          id="max-tokens"
          value={settings.maxTokens}
          onChange={v => update({ maxTokens: v })}
          min={256}
          max={65536}
          step={256}
        />
      </Row>

      <Row>
        <Label htmlFor="temperature" description="Sampling temperature (0 = deterministic, 1 = creative)">Temperature</Label>
        <NumberInput
          id="temperature"
          value={settings.temperature}
          onChange={v => update({ temperature: v })}
          min={0}
          max={1}
          step={0.1}
        />
      </Row>

      <Row className="items-start">
        <Label htmlFor="system-prompt" description="System prompt prepended to every conversation">System prompt</Label>
        <textarea
          id="system-prompt"
          value={settings.systemPrompt}
          onChange={e => update({ systemPrompt: e.target.value })}
          rows={4}
          className={cn(
            "bg-surface-800 border border-surface-700 rounded-md px-2.5 py-1.5",
            "text-sm text-surface-100 font-mono placeholder:text-surface-600 w-64",
            "focus:outline-none focus:border-brand-500 transition-colors resize-y"
          )}
          placeholder="You are a helpful coding assistant…"
        />
      </Row>
    </div>
  );
}

// ─── Tab: API ─────────────────────────────────────────────────────────────────

function ApiTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (s: Partial<AppSettings>) => void;
}) {
  return (
    <div className="space-y-0">
      <Row>
        <Label htmlFor="api-url" description="Base URL for the Claude Code API server">API URL</Label>
        <TextInput
          id="api-url"
          value={settings.apiUrl}
          onChange={v => update({ apiUrl: v })}
          placeholder="http://localhost:3001"
          className="w-52"
        />
      </Row>

      <Row>
        <Label htmlFor="api-key" description="Anthropic API key (stored in browser only)">API key</Label>
        <TextInput
          id="api-key"
          value={settings.apiKey}
          onChange={v => update({ apiKey: v })}
          type="password"
          placeholder="sk-ant-…"
          className="w-52"
        />
      </Row>
    </div>
  );
}

// ─── Tab: MCP ─────────────────────────────────────────────────────────────────

function McpTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (s: Partial<AppSettings>) => void;
}) {
  const [newServer, setNewServer] = useState({ name: "", command: "", args: "" });

  const addServer = useCallback(() => {
    if (!newServer.name || !newServer.command) return;
    update({
      mcpServers: [
        ...settings.mcpServers,
        {
          id: crypto.randomUUID(),
          name: newServer.name,
          command: newServer.command,
          args: newServer.args.split(" ").filter(Boolean),
          env: {},
          enabled: true,
        },
      ],
    });
    setNewServer({ name: "", command: "", args: "" });
  }, [newServer, settings.mcpServers, update]);

  const removeServer = useCallback((id: string) => {
    update({ mcpServers: settings.mcpServers.filter(s => s.id !== id) });
  }, [settings.mcpServers, update]);

  return (
    <div className="space-y-3">
      {settings.mcpServers.length === 0 ? (
        <p className="text-sm text-surface-600 py-2">No MCP servers configured.</p>
      ) : (
        <div className="space-y-1.5">
          {settings.mcpServers.map(server => (
            <div
              key={server.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-800 border border-surface-700"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-surface-200 font-semibold truncate">{server.name}</p>
                <p className="text-xs text-surface-500 font-mono truncate">
                  {server.command} {server.args.join(" ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeServer(server.id)}
                className="text-surface-600 hover:text-error transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new server */}
      <div className="border border-surface-700 rounded-lg p-3 space-y-2">
        <p className="text-xs text-surface-500 font-semibold uppercase tracking-wide">Add server</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={newServer.name}
            onChange={e => setNewServer(s => ({ ...s, name: e.target.value }))}
            placeholder="Name"
            className="bg-surface-800 border border-surface-700 rounded px-2 py-1 text-sm text-surface-100 font-mono placeholder:text-surface-600 focus:outline-none focus:border-brand-500"
          />
          <input
            value={newServer.command}
            onChange={e => setNewServer(s => ({ ...s, command: e.target.value }))}
            placeholder="Command (e.g. npx)"
            className="bg-surface-800 border border-surface-700 rounded px-2 py-1 text-sm text-surface-100 font-mono placeholder:text-surface-600 focus:outline-none focus:border-brand-500"
          />
        </div>
        <input
          value={newServer.args}
          onChange={e => setNewServer(s => ({ ...s, args: e.target.value }))}
          placeholder="Arguments (space-separated)"
          className="w-full bg-surface-800 border border-surface-700 rounded px-2 py-1 text-sm text-surface-100 font-mono placeholder:text-surface-600 focus:outline-none focus:border-brand-500"
        />
        <button
          type="button"
          onClick={addServer}
          disabled={!newServer.name || !newServer.command}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
            newServer.name && newServer.command
              ? "bg-brand-600 text-white hover:bg-brand-700"
              : "bg-surface-700 text-surface-500 cursor-not-allowed"
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          Add server
        </button>
      </div>
    </div>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

export interface SettingsProps {
  /** Controlled open state. When omitted, uses the Zustand store. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Settings({ open: openProp, onOpenChange }: SettingsProps) {
  const { settings, updateSettings, settingsOpen, closeSettings } = useChatStore();
  const [tab, setTab] = useState("general");

  const isOpen   = openProp !== undefined ? openProp : settingsOpen;
  const handleClose = useCallback(() => {
    onOpenChange?.(false);
    closeSettings();
  }, [onOpenChange, closeSettings]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={o => { if (!o) handleClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 w-full max-w-lg",
            "bg-surface-950 border-l border-surface-800 shadow-2xl",
            "flex flex-col animate-slide-down"
          )}
          aria-describedby="settings-desc"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
            <Dialog.Title className="text-base font-semibold text-surface-100">
              Settings
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="text-surface-500 hover:text-surface-200 transition-colors"
                aria-label="Close settings"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>
          <p id="settings-desc" className="sr-only">Configure Claude Code web preferences</p>

          {/* Tabs */}
          <Tabs.Root
            value={tab}
            onValueChange={setTab}
            className="flex flex-col flex-1 min-h-0"
          >
            <Tabs.List className="flex border-b border-surface-800 px-5 gap-0">
              {(["general", "model", "api", "mcp"] as const).map(t => (
                <Tabs.Trigger
                  key={t}
                  value={t}
                  className={cn(
                    "px-3 py-2.5 text-sm font-mono capitalize border-b-2 transition-colors",
                    "focus:outline-none",
                    tab === t
                      ? "border-brand-500 text-brand-300"
                      : "border-transparent text-surface-500 hover:text-surface-300"
                  )}
                >
                  {t === "api" ? "API" : t === "mcp" ? "MCP" : t.charAt(0).toUpperCase() + t.slice(1)}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <Tabs.Content value="general">
                <GeneralTab settings={settings} update={updateSettings} />
              </Tabs.Content>
              <Tabs.Content value="model">
                <ModelTab settings={settings} update={updateSettings} />
              </Tabs.Content>
              <Tabs.Content value="api">
                <ApiTab settings={settings} update={updateSettings} />
              </Tabs.Content>
              <Tabs.Content value="mcp">
                <McpTab settings={settings} update={updateSettings} />
              </Tabs.Content>
            </div>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
