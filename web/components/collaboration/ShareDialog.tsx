"use client";

import { useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Share2, X, Copy, Check, Link, Mail, Clock, Users, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  buildShareUrl,
  labelForRole,
  descriptionForRole,
  canManageAccess,
} from "@/lib/collaboration/permissions";
import { CollaboratorList } from "./CollaboratorList";
import { useCollaborationContextOptional } from "./CollaborationProvider";
import type { CollabRole } from "@/lib/collaboration/socket";
import type { LinkExpiry } from "@/lib/collaboration/types";
import { cn } from "@/lib/utils";

// ─── Role Selector ────────────────────────────────────────────────────────────

const ROLES: CollabRole[] = ["collaborator", "viewer"];
const EXPIRY_OPTIONS: { value: LinkExpiry; label: string }[] = [
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "never", label: "Never" },
];

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
        copied
          ? "bg-green-700 text-white"
          : "bg-surface-700 text-surface-200 hover:bg-surface-600"
      )}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" /> Copied!
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" /> Copy
        </>
      )}
    </button>
  );
}

// ─── Section Heading ──────────────────────────────────────────────────────────

function SectionHeading({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-3.5 h-3.5 text-surface-400" />
      <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
        {title}
      </h3>
    </div>
  );
}

// ─── ShareDialog ──────────────────────────────────────────────────────────────

interface ShareDialogProps {
  /** Allow fully custom trigger. Defaults to a "Share" button. */
  trigger?: React.ReactNode;
}

export function ShareDialog({ trigger }: ShareDialogProps) {
  const ctx = useCollaborationContextOptional();

  const [role, setRole] = useState<CollabRole>("viewer");
  const [expiry, setExpiry] = useState<LinkExpiry>("24h");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [anyoneCanView, setAnyoneCanView] = useState(false);

  if (!ctx) return null;

  const { myRole, generateShareLink } = ctx;
  const canManage = myRole ? canManageAccess(myRole) : false;

  const handleGenerateLink = () => {
    const link = generateShareLink(role, expiry);
    const url = buildShareUrl(link.id, role);
    setGeneratedUrl(url);
  };

  const handleInviteByEmail = () => {
    if (!email.trim() || !generatedUrl) return;
    // In a real app, POST to /api/collab/invite
    setEmailSent(true);
    setEmail("");
    setTimeout(() => setEmailSent(false), 3000);
  };

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <button
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              "bg-brand-600 text-white hover:bg-brand-700"
            )}
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />

        <Dialog.Content
          className={cn(
            "fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-lg max-h-[90vh] overflow-y-auto",
            "rounded-2xl border border-surface-700 bg-surface-900 shadow-2xl",
            "focus:outline-none"
          )}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
              <Dialog.Title className="text-base font-semibold text-surface-100">
                Share session
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-surface-500 hover:text-surface-200 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="px-5 py-4 space-y-6">
              {/* ── Generate Link ── */}
              <section>
                <SectionHeading icon={Link} title="Invite link" />

                {/* Role + Expiry */}
                <div className="flex gap-2 mb-3">
                  {/* Role picker */}
                  <div className="relative flex-1">
                    <select
                      value={role}
                      onChange={(e) => {
                        setRole(e.target.value as CollabRole);
                        setGeneratedUrl(null);
                      }}
                      className={cn(
                        "w-full appearance-none text-xs bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 pr-7",
                        "text-surface-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      )}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {labelForRole(r)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-2.5 w-3.5 h-3.5 text-surface-400" />
                  </div>

                  {/* Expiry picker */}
                  <div className="relative flex-1">
                    <select
                      value={expiry}
                      onChange={(e) => {
                        setExpiry(e.target.value as LinkExpiry);
                        setGeneratedUrl(null);
                      }}
                      className={cn(
                        "w-full appearance-none text-xs bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 pr-7",
                        "text-surface-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      )}
                    >
                      {EXPIRY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          Expires: {o.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-2.5 w-3.5 h-3.5 text-surface-400" />
                  </div>
                </div>

                {/* Role description */}
                <p className="text-xs text-surface-500 mb-3">
                  {descriptionForRole(role)}
                </p>

                {/* Generated link or generate button */}
                {generatedUrl ? (
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={generatedUrl}
                      className={cn(
                        "flex-1 text-xs bg-surface-800 border border-surface-700 rounded-lg px-3 py-2",
                        "text-surface-300 focus:outline-none"
                      )}
                    />
                    <CopyButton text={generatedUrl} />
                  </div>
                ) : (
                  <button
                    onClick={handleGenerateLink}
                    disabled={!canManage}
                    className={cn(
                      "w-full py-2 rounded-lg text-xs font-medium transition-colors",
                      canManage
                        ? "bg-brand-600 text-white hover:bg-brand-700"
                        : "bg-surface-800 text-surface-500 cursor-not-allowed"
                    )}
                  >
                    Generate link
                  </button>
                )}
              </section>

              {/* ── Invite by Email ── */}
              {canManage && (
                <section>
                  <SectionHeading icon={Mail} title="Invite by email" />
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleInviteByEmail()}
                      placeholder="colleague@example.com"
                      className={cn(
                        "flex-1 text-xs bg-surface-800 border border-surface-700 rounded-lg px-3 py-2",
                        "text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      )}
                    />
                    <button
                      onClick={handleInviteByEmail}
                      disabled={!email.trim() || !generatedUrl}
                      className={cn(
                        "px-3 py-2 rounded-lg text-xs font-medium transition-all",
                        email.trim() && generatedUrl
                          ? emailSent
                            ? "bg-green-700 text-white"
                            : "bg-brand-600 text-white hover:bg-brand-700"
                          : "bg-surface-700 text-surface-500 cursor-not-allowed"
                      )}
                    >
                      {emailSent ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        "Send"
                      )}
                    </button>
                  </div>
                  {!generatedUrl && (
                    <p className="text-[10px] text-surface-600 mt-1.5">
                      Generate a link first to send via email.
                    </p>
                  )}
                </section>
              )}

              {/* ── Public access toggle ── */}
              {canManage && (
                <section>
                  <SectionHeading icon={Clock} title="Link settings" />
                  <label className="flex items-start gap-3 cursor-pointer">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        checked={anyoneCanView}
                        onChange={(e) => setAnyoneCanView(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div
                        className={cn(
                          "w-8 h-4 rounded-full transition-colors",
                          anyoneCanView ? "bg-brand-600" : "bg-surface-700"
                        )}
                      />
                      <div
                        className={cn(
                          "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                          anyoneCanView ? "translate-x-4.5 left-0.5" : "left-0.5"
                        )}
                      />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-surface-200">
                        Anyone with the link can view
                      </p>
                      <p className="text-[10px] text-surface-500">
                        No authentication required for viewers
                      </p>
                    </div>
                  </label>
                </section>
              )}

              {/* ── Collaborator List ── */}
              <section>
                <SectionHeading icon={Users} title="People with access" />
                <CollaboratorList />
              </section>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-surface-800 flex justify-end">
              <Dialog.Close asChild>
                <button className="text-xs text-surface-400 hover:text-surface-200 transition-colors">
                  Done
                </button>
              </Dialog.Close>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
