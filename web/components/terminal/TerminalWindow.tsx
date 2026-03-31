"use client";

import { useEffect, useRef, useState } from "react";
import { TerminalTitleBar } from "./TerminalTitleBar";

interface TerminalEffects {
  scanlines?: boolean;
  glow?: boolean;
  curvature?: boolean;
  flicker?: boolean;
}

interface TerminalWindowProps {
  children: React.ReactNode;
  title?: string;
  online?: boolean;
  statusText?: string;
  tabs?: string[];
  activeTab?: number;
  onTabChange?: (index: number) => void;
  /** Remove rounded corners and box-shadow (embed in full-page layout) */
  embedded?: boolean;
  effects?: TerminalEffects;
  /** Show status bar at the bottom */
  statusBar?: React.ReactNode;
  /** Show boot sequence animation on first mount */
  bootSequence?: boolean;
  className?: string;
}

const BOOT_LINES = [
  "Initializing Claude Code v1.0.0…",
  "Loading language models…",
  "Mounting workspace…",
  "Ready.",
];

export function TerminalWindow({
  children,
  title,
  online = true,
  statusText,
  tabs,
  activeTab,
  onTabChange,
  embedded = false,
  effects = {},
  statusBar,
  bootSequence = false,
  className,
}: TerminalWindowProps) {
  const [booting, setBooting] = useState(bootSequence);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const windowRef = useRef<HTMLDivElement>(null);

  // Build data-effect-* attributes
  const effectAttrs: Record<string, boolean | undefined> = {
    "data-effect-scanlines": effects.scanlines || undefined,
    "data-effect-glow": effects.glow || undefined,
    "data-effect-curvature": effects.curvature || undefined,
    "data-effect-flicker": effects.flicker || undefined,
  };

  // Filter to only present attributes
  const dataAttrs = Object.fromEntries(
    Object.entries(effectAttrs)
      .filter(([, v]) => v)
      .map(([k]) => [k, ""])
  );

  // Boot sequence animation
  useEffect(() => {
    if (!bootSequence) return;

    let i = 0;
    const interval = setInterval(() => {
      setBootLines((prev) => [...prev, BOOT_LINES[i]]);
      i++;
      if (i >= BOOT_LINES.length) {
        clearInterval(interval);
        // Hide overlay after last line + a short pause
        setTimeout(() => setBooting(false), 600);
      }
    }, 450);

    return () => clearInterval(interval);
  }, [bootSequence]);

  return (
    <div
      ref={windowRef}
      className={[
        "terminal-window",
        embedded ? "terminal-window--embedded" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...dataAttrs}
    >
      <TerminalTitleBar
        title={title}
        online={online}
        statusText={statusText}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />

      <div className="terminal-body terminal-root terminal-fade-in">
        {children}
      </div>

      {statusBar && (
        <div className="terminal-status-bar">
          {statusBar}
        </div>
      )}

      {/* Boot sequence overlay */}
      {booting && (
        <div className="terminal-boot-overlay" aria-hidden="true">
          {bootLines.map((line, i) => (
            <div
              key={i}
              className="terminal-boot-line"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
