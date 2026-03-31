"use client";

interface CursorBlinkProps {
  variant?: "block" | "beam" | "underline";
  className?: string;
}

export function CursorBlink({ variant = "block", className }: CursorBlinkProps) {
  const variantClass =
    variant === "beam"
      ? "terminal-cursor--beam"
      : variant === "underline"
        ? "terminal-cursor--underline"
        : "";

  return (
    <span
      className={["terminal-cursor", variantClass, className]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    />
  );
}
