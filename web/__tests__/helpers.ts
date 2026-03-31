import { render, type RenderOptions } from "@testing-library/react";
import { type ReactElement } from "react";

/**
 * Custom render that wraps elements with any global providers needed.
 * Extend this as providers are added (ThemeProvider, etc.).
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, options);
}

/**
 * Wait for all pending micro-tasks and timers.
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Advance fake timers and flush promises together.
 */
export async function advanceTimersAndFlush(ms = 0) {
  const { vi } = await import("vitest");
  vi.advanceTimersByTime(ms);
  await flushPromises();
}
