"use client";

type SpinnerColor = "blue" | "green" | "yellow" | "red" | "dim";

interface TerminalSpinnerProps {
  label?: string;
  color?: SpinnerColor;
  className?: string;
}

const colorClass: Record<SpinnerColor, string> = {
  blue:   "",
  green:  "terminal-spinner--green",
  yellow: "terminal-spinner--yellow",
  red:    "terminal-spinner--red",
  dim:    "terminal-spinner--dim",
};

export function TerminalSpinner({ label, color = "blue", className }: TerminalSpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label ?? "Loading…"}
      className={["terminal-spinner", colorClass[color], className]
        .filter(Boolean)
        .join(" ")}
    >
      {label && <span aria-hidden="true">{label}</span>}
    </span>
  );
}
