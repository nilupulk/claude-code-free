"use client";

/**
 * React error boundary with Sentry integration.
 *
 * Wraps a subtree and catches render / lifecycle errors before they crash the
 * whole page.  Automatically reports to Sentry when NEXT_PUBLIC_SENTRY_DSN is
 * set; always logs to the console.
 *
 * Usage:
 *   <ErrorBoundary fallback={<p>Something went wrong.</p>}>
 *     <YourComponent />
 *   </ErrorBoundary>
 */

import React from "react";
import * as Sentry from "@sentry/nextjs";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  /** Custom fallback UI. Receives the error and a reset callback. */
  fallback?: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
  /** Called after the error is captured — useful for additional telemetry. */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
}

// ── ErrorBoundary ─────────────────────────────────────────────────────────────

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null, eventId: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ErrorBoundary] Caught render error:", error, errorInfo);

    let eventId: string | null = null;

    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      eventId = Sentry.captureException(error, {
        extra: { componentStack: errorInfo.componentStack },
      });
    }

    this.setState({ eventId: eventId ?? null });
    this.props.onError?.(error, errorInfo);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null, eventId: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    const { fallback } = this.props;

    if (typeof fallback === "function") {
      return fallback(this.state.error!, this.reset);
    }

    if (fallback) return fallback;

    return (
      <DefaultFallback
        error={this.state.error!}
        eventId={this.state.eventId}
        onReset={this.reset}
      />
    );
  }
}

// ── Default fallback UI ───────────────────────────────────────────────────────

function DefaultFallback({
  error,
  eventId,
  onReset,
}: {
  error: Error;
  eventId: string | null;
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950">
      <div className="text-2xl" aria-hidden>
        ⚠️
      </div>
      <h2 className="text-base font-semibold text-red-800 dark:text-red-200">
        Something went wrong
      </h2>
      <p className="max-w-sm text-sm text-red-700 dark:text-red-300">
        {error.message || "An unexpected error occurred."}
      </p>
      {eventId && (
        <p className="text-xs text-red-500 dark:text-red-400">
          Error ID: <code className="font-mono">{eventId}</code>
        </p>
      )}
      <button
        onClick={onReset}
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-red-700 dark:hover:bg-red-600"
      >
        Try again
      </button>
    </div>
  );
}

// ── Convenience HOC ───────────────────────────────────────────────────────────

/**
 * Wrap a component with an error boundary.
 *
 * @example
 * export default withErrorBoundary(MyComponent, <p>Oops</p>);
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: Props["fallback"],
): React.ComponentType<P> {
  const displayName = Component.displayName ?? Component.name ?? "Component";

  function Wrapped(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  }

  Wrapped.displayName = `withErrorBoundary(${displayName})`;
  return Wrapped;
}
