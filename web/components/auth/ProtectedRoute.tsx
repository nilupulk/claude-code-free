"use client";

import { type ReactNode, useEffect } from "react";
import { useAuth } from "./AuthProvider";

interface ProtectedRouteProps {
  children: ReactNode;
  /** Where to redirect unauthenticated users. Default: /auth/login */
  loginHref?: string;
  /**
   * Custom loading UI rendered while the initial auth check is in flight.
   * Defaults to a full-screen spinner.
   */
  fallback?: ReactNode;
}

/**
 * Wraps a page or subtree and redirects to the login page if the user is not
 * authenticated.
 *
 * Works with both App Router (place in a `layout.tsx` or `page.tsx`) and
 * Pages Router (wrap the page component).
 *
 * @example
 * // app/dashboard/layout.tsx
 * export default function DashboardLayout({ children }) {
 *   return <ProtectedRoute>{children}</ProtectedRoute>
 * }
 */
export function ProtectedRoute({
  children,
  loginHref = "/auth/login",
  fallback,
}: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${loginHref}?next=${next}`;
    }
  }, [isLoading, isAuthenticated, loginHref]);

  if (isLoading) {
    return fallback ?? <DefaultLoadingScreen />;
  }

  if (!isAuthenticated) {
    // Render nothing while the redirect fires.
    return null;
  }

  return <>{children}</>;
}

// ── Loading UI ────────────────────────────────────────────────────────────────

function DefaultLoadingScreen() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-surface-950"
      role="status"
      aria-label="Loading…"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-700 border-t-brand-500" />
        <p className="text-sm text-surface-500">Loading…</p>
      </div>
    </div>
  );
}

// ── Admin gate ────────────────────────────────────────────────────────────────

interface AdminRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Restricts access to admin users. Non-admin authenticated users see a 403
 * message instead of being redirected to login.
 *
 * Nest inside `ProtectedRoute` to combine both checks:
 *
 * @example
 * <ProtectedRoute>
 *   <AdminRoute>
 *     <AdminDashboard />
 *   </AdminRoute>
 * </ProtectedRoute>
 */
export function AdminRoute({ children, fallback }: AdminRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (!user?.isAdmin) {
    return (
      fallback ?? (
        <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4">
          <div className="max-w-sm text-center">
            <p className="text-4xl font-bold text-surface-600">403</p>
            <p className="mt-2 text-surface-400">You don't have permission to access this page.</p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}
