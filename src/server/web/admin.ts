import express from "express";
import { join } from "path";
import { readFileSync } from "fs";
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "./auth/adapter.js";
import type { SessionManager } from "./session-manager.js";
import type { UserStore } from "./user-store.js";

/**
 * Admin dashboard routes.
 *
 * All routes under /admin require the requesting user to have isAdmin = true.
 * The caller (pty-server.ts) is responsible for applying the auth middleware
 * before mounting this router.
 */

function requireAdmin(req: Request, res: Response, next: () => void): void {
  const user = (req as AuthenticatedRequest).user;
  if (!user?.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

export function createAdminRouter(
  sessionManager: SessionManager,
  userStore: UserStore,
) {
  const router = express.Router();

  // All admin routes require admin role.
  router.use(requireAdmin);

  // ── Dashboard UI ──────────────────────────────────────────────────────────

  router.get("/", (_req, res) => {
    try {
      const p = join(import.meta.dirname, "public/admin.html");
      res.setHeader("Content-Type", "text/html");
      res.send(readFileSync(p, "utf8"));
    } catch {
      res.setHeader("Content-Type", "text/html");
      res.send(INLINE_ADMIN_HTML);
    }
  });

  // ── API: all active sessions ──────────────────────────────────────────────

  /**
   * GET /admin/sessions
   * Returns all active sessions across all users.
   */
  router.get("/sessions", (_req, res) => {
    const sessions = sessionManager.getAllSessions().map((s) => ({
      id: s.id,
      userId: s.userId,
      createdAt: s.createdAt,
      ageMs: Date.now() - s.createdAt,
    }));
    res.json({ sessions });
  });

  // ── API: all connected users ──────────────────────────────────────────────

  /**
   * GET /admin/users
   * Returns all users that currently have at least one active session.
   */
  router.get("/users", (_req, res) => {
    res.json({ users: userStore.list() });
  });

  // ── API: force-kill a session ─────────────────────────────────────────────

  /**
   * DELETE /admin/sessions/:token
   * Force-kills the specified session regardless of which user owns it.
   */
  router.delete("/sessions/:token", (req, res) => {
    const { token } = req.params;
    const session = sessionManager.getSession(token);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    sessionManager.destroySession(token);
    res.json({ ok: true, destroyed: token });
  });

  return router;
}

// ── Inline admin dashboard HTML ───────────────────────────────────────────────

const INLINE_ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Claude Code — Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0d1117; color: #e6edf3; padding: 2rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .subtitle { color: #8b949e; font-size: 0.875rem; margin-bottom: 2rem; }
    h2 { font-size: 1rem; margin: 1.5rem 0 0.75rem; color: #8b949e; text-transform: uppercase; letter-spacing: .05em; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th { text-align: left; padding: 0.4rem 0.75rem; border-bottom: 1px solid #21262d; color: #8b949e; font-weight: 500; }
    td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #161b22; }
    tr:hover td { background: #161b22; }
    button.kill {
      background: #da3633; border: 1px solid #f85149; color: #fff;
      padding: 0.2rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;
    }
    button.kill:hover { background: #f85149; }
    .badge {
      display: inline-block; padding: 0.15rem 0.5rem; border-radius: 9999px;
      font-size: 0.75rem; background: #21262d; color: #8b949e;
    }
    .refresh { float: right; background: #21262d; border: 1px solid #30363d; color: #8b949e;
      padding: 0.3rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem; }
    .refresh:hover { color: #e6edf3; }
    #msg { margin-top: 1rem; font-size: 0.875rem; color: #3fb950; min-height: 1.2em; }
  </style>
</head>
<body>
  <h1>Admin Dashboard</h1>
  <p class="subtitle">Claude Code — multi-user session management</p>

  <button class="refresh" onclick="load()">&#8635; Refresh</button>

  <h2>Connected Users</h2>
  <table id="users-table">
    <thead><tr><th>User ID</th><th>Email / Name</th><th>Sessions</th><th>First seen</th></tr></thead>
    <tbody id="users-body"><tr><td colspan="4">Loading…</td></tr></tbody>
  </table>

  <h2>Active Sessions</h2>
  <table id="sessions-table">
    <thead><tr><th>Session ID</th><th>User ID</th><th>Age</th><th>Action</th></tr></thead>
    <tbody id="sessions-body"><tr><td colspan="4">Loading…</td></tr></tbody>
  </table>

  <div id="msg"></div>

  <script>
    const msg = document.getElementById('msg');
    function fmt(ms) {
      if (ms < 60000) return Math.round(ms/1000) + 's';
      if (ms < 3600000) return Math.round(ms/60000) + 'm';
      return Math.round(ms/3600000) + 'h';
    }
    async function load() {
      const [{ users }, { sessions }] = await Promise.all([
        fetch('/admin/users').then(r => r.json()),
        fetch('/admin/sessions').then(r => r.json()),
      ]);
      const ub = document.getElementById('users-body');
      ub.innerHTML = users.length === 0 ? '<tr><td colspan="4">No connected users</td></tr>' :
        users.map(u => \`<tr>
          <td><code>\${u.id}</code></td>
          <td>\${u.email || u.name || '—'}</td>
          <td><span class="badge">\${u.sessionCount}</span></td>
          <td>\${new Date(u.firstSeenAt).toLocaleTimeString()}</td>
        </tr>\`).join('');
      const sb = document.getElementById('sessions-body');
      sb.innerHTML = sessions.length === 0 ? '<tr><td colspan="4">No active sessions</td></tr>' :
        sessions.map(s => \`<tr>
          <td><code>\${s.id.slice(0,8)}…</code></td>
          <td><code>\${s.userId}</code></td>
          <td>\${fmt(s.ageMs)}</td>
          <td><button class="kill" onclick="kill('\${s.id}')">Kill</button></td>
        </tr>\`).join('');
    }
    async function kill(id) {
      if (!confirm('Kill session ' + id.slice(0,8) + '…?')) return;
      const r = await fetch('/admin/sessions/' + id, { method: 'DELETE' });
      const j = await r.json();
      msg.textContent = j.ok ? 'Session ' + id.slice(0,8) + '… destroyed.' : j.error;
      load();
    }
    load();
    setInterval(load, 10000);
  </script>
</body>
</html>`;
