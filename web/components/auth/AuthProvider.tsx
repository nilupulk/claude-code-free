"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  isAdmin: boolean;
}

export interface AuthContextValue {
  /** Authenticated user, or null when not signed in. */
  user: AuthUser | null;
  /** True while the initial /auth/me check is in flight. */
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Sign the current user out and redirect to /auth/login. */
  logout: () => Promise<void>;
  /** Re-fetch /auth/me — useful after an in-page login flow. */
  refresh: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  logout: async () => {},
  refresh: async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

/**
 * AuthProvider wraps the app and exposes authentication state via the
 * `useAuth` hook.
 *
 * On mount it calls `GET /auth/me` (the server-side session endpoint) to
 * resolve the current user. No token is stored in localStorage; auth state
 * is derived entirely from the server-side httpOnly cookie.
 *
 * Place this above any component that calls `useAuth` or `ProtectedRoute`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/auth/me", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = (await res.json()) as AuthUser;
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check auth state once on mount.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          // Forward the CSRF double-submit cookie value in the header.
          "x-csrf-token": getCsrfToken() ?? "",
        },
      });
    } finally {
      setUser(null);
      window.location.href = "/auth/login";
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Access the current authentication state from any client component. */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// ── CSRF helper ───────────────────────────────────────────────────────────────

/** Read the CSRF double-submit cookie value set by the server. */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)cc_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
