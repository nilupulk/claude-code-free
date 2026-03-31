import type { IPty } from "node-pty";
import type { WebSocket } from "ws";
import { ScrollbackBuffer } from "./scrollback-buffer.js";

const DEFAULT_GRACE_MS = 5 * 60_000; // 5 minutes
const DEFAULT_SCROLLBACK_BYTES = 100 * 1024; // 100 KB

export type StoredSession = {
  token: string;
  /** ID of the user who owns this session. */
  userId: string;
  pty: IPty;
  scrollback: ScrollbackBuffer;
  ws: WebSocket | null;
  createdAt: Date;
  lastActive: Date;
  graceTimer: ReturnType<typeof setTimeout> | null;
};

export type SessionInfo = {
  token: string;
  /** ID of the user who owns this session. */
  userId: string;
  created: string;
  lastActive: string;
  alive: boolean;
};

/**
 * In-memory session store with TTL-based cleanup.
 *
 * Sessions survive WebSocket disconnects for `gracePeriodMs` before being
 * permanently destroyed. This lets clients reconnect and resume their PTY
 * without losing conversation state.
 */
export class SessionStore {
  private sessions = new Map<string, StoredSession>();
  private readonly gracePeriodMs: number;
  private readonly scrollbackBytes: number;

  constructor(
    gracePeriodMs = DEFAULT_GRACE_MS,
    scrollbackBytes = DEFAULT_SCROLLBACK_BYTES,
  ) {
    this.gracePeriodMs = gracePeriodMs;
    this.scrollbackBytes = scrollbackBytes;
  }

  /**
   * Register a newly spawned PTY under a fresh session token.
   * @param userId - ID of the owning user (defaults to "default" for single-user deployments).
   */
  register(pty: IPty, userId = "default"): StoredSession {
    const token = crypto.randomUUID();
    const session: StoredSession = {
      token,
      userId,
      pty,
      scrollback: new ScrollbackBuffer(this.scrollbackBytes),
      ws: null,
      createdAt: new Date(),
      lastActive: new Date(),
      graceTimer: null,
    };
    this.sessions.set(token, session);
    return session;
  }

  get(token: string): StoredSession | undefined {
    return this.sessions.get(token);
  }

  /**
   * Attach a new WebSocket to an existing session.
   * Cancels any running grace timer.
   * Returns null if the session does not exist.
   */
  reattach(token: string, ws: WebSocket): StoredSession | null {
    const session = this.sessions.get(token);
    if (!session) return null;

    if (session.graceTimer) {
      clearTimeout(session.graceTimer);
      session.graceTimer = null;
    }
    session.ws = ws;
    session.lastActive = new Date();
    return session;
  }

  /**
   * Detach the WebSocket from a session and start the grace period timer.
   * After `gracePeriodMs` with no reconnect, `onExpire` is called and the
   * session is destroyed.
   */
  startGrace(token: string, onExpire: () => void): void {
    const session = this.sessions.get(token);
    if (!session) return;

    session.ws = null;
    session.lastActive = new Date();

    if (session.graceTimer) {
      clearTimeout(session.graceTimer);
    }

    const remainingSec = Math.round(this.gracePeriodMs / 1000);
    console.log(
      `[session ${token.slice(0, 8)}] Disconnected — grace period: ${remainingSec}s`,
    );

    session.graceTimer = setTimeout(() => {
      session.graceTimer = null;
      console.log(
        `[session ${token.slice(0, 8)}] Grace period expired — cleaning up`,
      );
      this.destroy(token);
      onExpire();
    }, this.gracePeriodMs);
  }

  /**
   * Immediately kill the PTY and remove the session.
   */
  destroy(token: string): void {
    const session = this.sessions.get(token);
    if (!session) return;

    this.sessions.delete(token);

    if (session.graceTimer) {
      clearTimeout(session.graceTimer);
      session.graceTimer = null;
    }

    if (
      session.ws &&
      session.ws.readyState !== 2 /* CLOSING */ &&
      session.ws.readyState !== 3 /* CLOSED */
    ) {
      session.ws.close(1000, "Session destroyed");
    }

    try {
      session.pty.kill("SIGHUP");
    } catch {
      // PTY may already be dead
    }
    setTimeout(() => {
      try {
        session.pty.kill("SIGKILL");
      } catch {
        // Already dead
      }
    }, 5000);
  }

  /** Returns summary info for all sessions (used by the REST API). */
  list(): SessionInfo[] {
    return [...this.sessions.values()].map((s) => ({
      token: s.token,
      userId: s.userId,
      created: s.createdAt.toISOString(),
      lastActive: s.lastActive.toISOString(),
      alive: s.ws !== null && s.ws.readyState === 1 /* OPEN */,
    }));
  }

  /** Returns summary info for sessions owned by a specific user. */
  listByUser(userId: string): SessionInfo[] {
    return this.list().filter((s) => s.userId === userId);
  }

  /** How many sessions are owned by the given user. */
  countByUser(userId: string): number {
    let n = 0;
    for (const s of this.sessions.values()) {
      if (s.userId === userId) n++;
    }
    return n;
  }

  /** Returns all raw StoredSession objects (used internally by SessionManager). */
  getAll(): StoredSession[] {
    return [...this.sessions.values()];
  }

  get size(): number {
    return this.sessions.size;
  }

  destroyAll(): void {
    for (const token of [...this.sessions.keys()]) {
      this.destroy(token);
    }
  }
}
