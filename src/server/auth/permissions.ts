import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../web/auth/adapter.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Role = "admin" | "user" | "viewer";

export type Permission =
  | "conversation:create"
  | "conversation:read"
  | "conversation:delete"
  | "file:read"
  | "file:write"
  | "tool:execute"
  | "settings:read"
  | "settings:write"
  | "admin:sessions"
  | "admin:users";

// ── Role → permission map ─────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<Role, ReadonlyArray<Permission> | ["*"]> = {
  admin: ["*"],
  user: [
    "conversation:create",
    "conversation:read",
    "conversation:delete",
    "file:read",
    "file:write",
    "tool:execute",
    "settings:read",
    "settings:write",
  ],
  viewer: ["conversation:read", "file:read"],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve the effective role for a user. */
export function resolveRole(isAdmin: boolean): Role {
  return isAdmin ? "admin" : "user";
}

/** Returns true if the given role has the requested permission. */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (perms[0] === "*") return true;
  return (perms as ReadonlyArray<Permission>).includes(permission);
}

/** Returns true if the user (identified by isAdmin flag) has the permission. */
export function hasPermission(isAdmin: boolean, permission: Permission): boolean {
  return roleHasPermission(resolveRole(isAdmin), permission);
}

/** List all permissions granted to a role. */
export function listPermissions(role: Role): ReadonlyArray<Permission> | ["*"] {
  return ROLE_PERMISSIONS[role];
}

// ── Express middleware ────────────────────────────────────────────────────────

/**
 * Express middleware factory.
 * Assumes `requireAuth` (from the auth adapter) has already run and attached
 * `req.user`. Returns 401 if user is missing, 403 if permission is denied.
 *
 * @example
 *   router.post("/conversations", requirePermission("conversation:create"), handler)
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!hasPermission(user.isAdmin, permission)) {
      res.status(403).json({
        error: "Forbidden",
        required: permission,
        role: resolveRole(user.isAdmin),
      });
      return;
    }
    next();
  };
}

/**
 * Middleware that requires admin role specifically.
 * Shorthand for `requirePermission("admin:sessions")` when you want a broader
 * admin gate without tying it to a specific resource permission.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!user.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
