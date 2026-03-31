"use client";

interface TerminalTitleBarProps {
  title?: string;
  /** Whether to show the online status dot */
  online?: boolean;
  /** Optional right-side status text (e.g. session info) */
  statusText?: string;
  /** Extra tabs; active tab index */
  tabs?: string[];
  activeTab?: number;
  onTabChange?: (index: number) => void;
}

export function TerminalTitleBar({
  title = "Claude Code — ~/project",
  online = true,
  statusText,
  tabs,
  activeTab = 0,
  onTabChange,
}: TerminalTitleBarProps) {
  return (
    <>
      <div className="terminal-title-bar">
        {/* Traffic lights */}
        <div className="terminal-traffic-lights" aria-hidden="true">
          <span className="terminal-dot terminal-dot--close" />
          <span className="terminal-dot terminal-dot--min" />
          <span className="terminal-dot terminal-dot--max" />
        </div>

        {/* Centred title */}
        <span className="terminal-title" title={title}>
          {title}
        </span>

        {/* Right status */}
        <div className="terminal-title-status" aria-hidden="true">
          {statusText && <span>{statusText}</span>}
          <span
            className={[
              "terminal-status-dot",
              online ? "" : "terminal-status-dot--offline",
            ]
              .filter(Boolean)
              .join(" ")}
            title={online ? "Connected" : "Disconnected"}
          />
        </div>
      </div>

      {/* Optional tab bar */}
      {tabs && tabs.length > 0 && (
        <div className="terminal-tab-bar" role="tablist" aria-label="Terminal tabs">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              role="tab"
              aria-selected={i === activeTab}
              className={[
                "terminal-tab",
                i === activeTab ? "terminal-tab--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onTabChange?.(i)}
            >
              {tab}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
