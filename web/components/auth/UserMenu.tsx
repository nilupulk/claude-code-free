"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut, Settings, Shield, ChevronDown } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  /** Open the settings panel when clicked. */
  onSettingsClick?: () => void;
  className?: string;
}

/**
 * Avatar dropdown with profile info, settings shortcut, and logout.
 *
 * Rendered as a `<button>` that opens a floating menu on click. Closes on
 * Escape, click-outside, and menu-item selection.
 */
export function UserMenu({ onSettingsClick, className }: UserMenuProps) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click-outside.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (!user) return null;

  const initials = getInitials(user.name, user.email);
  const displayName = user.name ?? user.email ?? user.id;
  const displayEmail = user.email;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
          "text-surface-300 hover:bg-surface-800 hover:text-surface-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        )}
      >
        <Avatar initials={initials} />
        <span className="hidden max-w-[120px] truncate sm:block">{displayName}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-surface-500 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-50 mt-1 w-56 origin-top-right",
            "rounded-xl border border-surface-700 bg-surface-900 shadow-xl",
            "animate-in fade-in-0 zoom-in-95 duration-100",
          )}
        >
          {/* User info */}
          <div className="border-b border-surface-800 px-3 py-3">
            <div className="flex items-center gap-3">
              <Avatar initials={initials} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-surface-100">{displayName}</p>
                {displayEmail && (
                  <p className="truncate text-xs text-surface-500">{displayEmail}</p>
                )}
              </div>
            </div>
            {user.isAdmin && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-900/50 px-2 py-0.5 text-xs font-medium text-brand-300 ring-1 ring-brand-700/50">
                <Shield className="h-3 w-3" aria-hidden="true" />
                Admin
              </span>
            )}
          </div>

          {/* Menu items */}
          <div className="p-1">
            {onSettingsClick && (
              <MenuItem
                icon={<Settings className="h-4 w-4" />}
                onClick={() => {
                  setOpen(false);
                  onSettingsClick();
                }}
              >
                Settings
              </MenuItem>
            )}
            <MenuItem
              icon={<LogOut className="h-4 w-4" />}
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              variant="danger"
            >
              Sign out
            </MenuItem>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface AvatarProps {
  initials: string;
  size?: "sm" | "lg";
}

function Avatar({ initials, size = "sm" }: AvatarProps) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-brand-700 font-medium text-white",
        size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm",
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

interface MenuItemProps {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
}

function MenuItem({ icon, children, onClick, variant = "default" }: MenuItemProps) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        variant === "danger"
          ? "text-red-400 hover:bg-red-950/50 hover:text-red-300"
          : "text-surface-300 hover:bg-surface-800 hover:text-surface-100",
      )}
    >
      <span className="shrink-0">{icon}</span>
      {children}
    </button>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name?: string, email?: string): string {
  const source = name ?? email ?? "?";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
