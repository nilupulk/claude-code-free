"use client";

import { useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import * as Select from "@radix-ui/react-select";
import {
  X, Link2, Globe, EyeOff, Lock, Check, Copy, ChevronDown, Trash2, AlertCircle,
} from "lucide-react";
import type { Conversation, ShareLink } from "@/lib/types";
import type { ShareVisibility, ShareExpiry } from "@/lib/share-store";
import { cn } from "@/lib/utils";
import { EmbedCodeGenerator } from "./EmbedCodeGenerator";

interface ShareDialogProps {
  conversation: Conversation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXPIRY_OPTIONS: { value: ShareExpiry; label: string }[] = [
  { value: "1h",    label: "1 hour" },
  { value: "24h",   label: "24 hours" },
  { value: "7d",    label: "7 days" },
  { value: "30d",   label: "30 days" },
  { value: "never", label: "Never" },
];

const VISIBILITY_OPTIONS: { value: ShareVisibility; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "public",   label: "Public",    icon: <Globe className="w-4 h-4" />,  desc: "Anyone with the link" },
  { value: "unlisted", label: "Unlisted",  icon: <EyeOff className="w-4 h-4" />, desc: "Link works but not discoverable" },
  { value: "password", label: "Password",  icon: <Lock className="w-4 h-4" />,   desc: "Requires password to view" },
];

export function ShareDialog({ conversation, open, onOpenChange }: ShareDialogProps) {
  const [visibility, setVisibility] = useState<ShareVisibility>("public");
  const [expiry, setExpiry]         = useState<ShareExpiry>("7d");
  const [password, setPassword]     = useState("");
  const [shareLink, setShareLink]   = useState<ShareLink | null>(null);
  const [creating, setCreating]     = useState(false);
  const [revoking, setRevoking]     = useState(false);
  const [copied, setCopied]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [showEmbed, setShowEmbed]   = useState(false);

  const handleCreate = useCallback(async () => {
    if (visibility === "password" && !password.trim()) {
      setError("Please enter a password.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation,
          visibility,
          password: visibility === "password" ? password : undefined,
          expiry,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create share link");
      }
      const data = await res.json();
      setShareLink(data as ShareLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }, [conversation, visibility, expiry, password]);

  const handleRevoke = useCallback(async () => {
    if (!shareLink) return;
    setRevoking(true);
    try {
      await fetch(`/api/share/${shareLink.id}`, { method: "DELETE" });
      setShareLink(null);
    } finally {
      setRevoking(false);
    }
  }, [shareLink]);

  const handleCopy = useCallback(async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareLink]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-describedby="share-dialog-description"
        >
          <div className="bg-surface-900 border border-surface-700 rounded-xl shadow-2xl w-full max-w-md flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
              <div>
                <Dialog.Title className="text-base font-semibold text-surface-100">
                  Share Conversation
                </Dialog.Title>
                <p id="share-dialog-description" className="text-xs text-surface-500 mt-0.5 truncate max-w-xs">
                  {conversation.title}
                </p>
              </div>
              <Dialog.Close className="p-1.5 rounded-md text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>

            <div className="p-5 flex flex-col gap-5">
              {!shareLink ? (
                <>
                  {/* Visibility */}
                  <div>
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-2">Visibility</p>
                    <div className="flex flex-col gap-1.5">
                      {VISIBILITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setVisibility(opt.value)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
                            visibility === opt.value
                              ? "border-brand-500 bg-brand-500/10 text-surface-100"
                              : "border-surface-700 bg-surface-800 text-surface-400 hover:border-surface-600 hover:text-surface-200"
                          )}
                        >
                          <span className={visibility === opt.value ? "text-brand-400" : "text-surface-500"}>
                            {opt.icon}
                          </span>
                          <div>
                            <p className="text-sm font-medium">{opt.label}</p>
                            <p className="text-xs text-surface-500">{opt.desc}</p>
                          </div>
                          {visibility === opt.value && (
                            <Check className="w-4 h-4 text-brand-400 ml-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Password input */}
                  {visibility === "password" && (
                    <div>
                      <label className="text-xs font-medium text-surface-500 uppercase tracking-wide block mb-1.5">
                        Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password…"
                        className="w-full px-3 py-2 rounded-md bg-surface-800 border border-surface-700 text-sm text-surface-100 placeholder-surface-600 focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  )}

                  {/* Expiry */}
                  <div>
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-1.5">Expires after</p>
                    <Select.Root value={expiry} onValueChange={(v) => setExpiry(v as ShareExpiry)}>
                      <Select.Trigger className="flex items-center justify-between w-full px-3 py-2 rounded-md bg-surface-800 border border-surface-700 text-sm text-surface-200 focus:outline-none focus:border-brand-500">
                        <Select.Value />
                        <Select.Icon><ChevronDown className="w-4 h-4 text-surface-500" /></Select.Icon>
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Content className="z-[60] bg-surface-800 border border-surface-700 rounded-lg shadow-xl overflow-hidden">
                          <Select.Viewport className="p-1">
                            {EXPIRY_OPTIONS.map((opt) => (
                              <Select.Item
                                key={opt.value}
                                value={opt.value}
                                className="flex items-center px-3 py-2 text-sm text-surface-200 rounded-md cursor-pointer hover:bg-surface-700 focus:bg-surface-700 focus:outline-none data-[state=checked]:text-brand-300"
                              >
                                <Select.ItemText>{opt.label}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                  </div>

                  {error && (
                    <p className="flex items-center gap-2 text-sm text-red-400">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </p>
                  )}

                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-md text-sm font-medium text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-60 transition-colors"
                  >
                    <Link2 className="w-4 h-4" />
                    {creating ? "Creating…" : "Generate Share Link"}
                  </button>
                </>
              ) : (
                <>
                  {/* Share link created */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 p-3 bg-surface-800 rounded-lg border border-surface-700">
                      <p className="flex-1 text-sm text-surface-200 font-mono truncate">{shareLink.url}</p>
                      <button
                        onClick={handleCopy}
                        className="p-1.5 rounded text-surface-400 hover:text-surface-100 hover:bg-surface-700 transition-colors"
                        title="Copy link"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-surface-500">
                      {VISIBILITY_OPTIONS.find((o) => o.value === shareLink.visibility)?.icon}
                      <span>{VISIBILITY_OPTIONS.find((o) => o.value === shareLink.visibility)?.label}</span>
                      <span>·</span>
                      <span>
                        {shareLink.expiresAt
                          ? `Expires ${new Date(shareLink.expiresAt).toLocaleDateString()}`
                          : "Never expires"}
                      </span>
                    </div>

                    {/* Embed toggle */}
                    <div className="flex items-center justify-between py-2 border-t border-surface-800">
                      <label htmlFor="show-embed" className="text-sm text-surface-300 cursor-pointer">
                        Show embed code
                      </label>
                      <Switch.Root
                        id="show-embed"
                        checked={showEmbed}
                        onCheckedChange={setShowEmbed}
                        className="w-9 h-5 rounded-full transition-colors data-[state=checked]:bg-brand-600 data-[state=unchecked]:bg-surface-700 cursor-pointer"
                      >
                        <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5" />
                      </Switch.Root>
                    </div>

                    {showEmbed && <EmbedCodeGenerator shareUrl={shareLink.url} shareId={shareLink.id} />}

                    <button
                      onClick={handleRevoke}
                      disabled={revoking}
                      className="flex items-center justify-center gap-2 w-full py-2 rounded-md text-sm text-red-400 bg-red-950/40 border border-red-900/50 hover:bg-red-950/70 disabled:opacity-60 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {revoking ? "Revoking…" : "Revoke Link"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
