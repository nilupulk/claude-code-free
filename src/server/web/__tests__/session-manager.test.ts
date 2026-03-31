import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { EventEmitter } from "node:events";
import { SessionManager } from "../session-manager.js";
import type { IPty } from "node-pty";
import type { WebSocket } from "ws";

// --- Mock factories ---

function createMockPty(): IPty & {
  _dataHandler?: (d: string) => void;
  _exitHandler?: (e: { exitCode: number; signal: number }) => void;
} {
  const mockPty = {
    onData(handler: (data: string) => void) {
      mockPty._dataHandler = handler;
      return { dispose() {} };
    },
    onExit(handler: (e: { exitCode: number; signal: number }) => void) {
      mockPty._exitHandler = handler;
      return { dispose() {} };
    },
    write: mock.fn(),
    resize: mock.fn(),
    kill: mock.fn(),
    pid: 12345,
    cols: 80,
    rows: 24,
    process: "claude",
    handleFlowControl: false,
    pause: mock.fn(),
    resume: mock.fn(),
    clear: mock.fn(),
    _dataHandler: undefined as ((d: string) => void) | undefined,
    _exitHandler: undefined as
      | ((e: { exitCode: number; signal: number }) => void)
      | undefined,
  };
  return mockPty as unknown as IPty & {
    _dataHandler?: (d: string) => void;
    _exitHandler?: (e: { exitCode: number; signal: number }) => void;
  };
}

function createMockWs(): WebSocket & EventEmitter {
  const emitter = new EventEmitter();
  const ws = Object.assign(emitter, {
    OPEN: 1,
    CONNECTING: 0,
    readyState: 1,
    send: mock.fn(),
    close: mock.fn(),
  });
  return ws as unknown as WebSocket & EventEmitter;
}

describe("SessionManager", () => {
  it("creates a session and returns a token", () => {
    const mockPty = createMockPty();
    const manager = new SessionManager(5, () => mockPty);
    const ws = createMockWs();

    const token = manager.create(ws);
    assert.ok(token, "create() should return a token string");
    assert.equal(typeof token, "string");
    assert.equal(manager.activeCount, 1);

    const session = manager.getSession(token);
    assert.ok(session, "getSession() should return the stored session");
    assert.equal(session.ws, ws);
    assert.equal(session.pty, mockPty);
  });

  it("enforces max sessions limit", () => {
    const manager = new SessionManager(1, () => createMockPty());

    const token1 = manager.create(createMockWs());
    assert.ok(token1);

    // Second session should fail because we're at capacity
    const ws2 = createMockWs();
    const token2 = manager.create(ws2);
    assert.equal(token2, null);
    assert.equal(manager.activeCount, 1);
  });

  it("forwards PTY data to WebSocket", () => {
    const mockPty = createMockPty();
    const manager = new SessionManager(5, () => mockPty);
    const ws = createMockWs();

    manager.create(ws);

    // Simulate PTY output
    mockPty._dataHandler?.("hello world");
    assert.ok(
      (ws.send as ReturnType<typeof mock.fn>).mock.callCount() >= 1,
      "PTY data should be forwarded to WS",
    );
  });

  it("forwards WebSocket input to PTY", () => {
    const mockPty = createMockPty();
    const manager = new SessionManager(5, () => mockPty);
    const ws = createMockWs();

    manager.create(ws);

    // Simulate WebSocket input
    ws.emit("message", Buffer.from("ls\n"));
    assert.equal(
      (mockPty.write as ReturnType<typeof mock.fn>).mock.callCount(),
      1,
    );
  });

  it("handles resize messages", () => {
    const mockPty = createMockPty();
    const manager = new SessionManager(5, () => mockPty);
    const ws = createMockWs();

    manager.create(ws);

    ws.emit("message", JSON.stringify({ type: "resize", cols: 120, rows: 40 }));
    assert.equal(
      (mockPty.resize as ReturnType<typeof mock.fn>).mock.callCount(),
      1,
    );
  });

  it("handles ping messages with pong response", () => {
    const mockPty = createMockPty();
    const manager = new SessionManager(5, () => mockPty);
    const ws = createMockWs();

    manager.create(ws);

    ws.emit("message", JSON.stringify({ type: "ping" }));
    const calls = (ws.send as ReturnType<typeof mock.fn>).mock.calls;
    const lastCall = calls[calls.length - 1];
    assert.ok(lastCall);
    const parsed = JSON.parse(lastCall.arguments[0] as string);
    assert.equal(parsed.type, "pong");
  });

  it("starts grace period on WebSocket close (session stays alive)", () => {
    const mockPty = createMockPty();
    const manager = new SessionManager(5, () => mockPty, 30_000);
    const ws = createMockWs();

    const token = manager.create(ws);
    assert.ok(token);
    assert.equal(manager.activeCount, 1);

    // Simulate browser disconnect
    ws.emit("close");

    // Session should still exist during grace period
    assert.equal(manager.activeCount, 1);
    assert.ok(manager.getSession(token), "session should survive the grace period");
  });

  it("resumes a session and replays scrollback buffer", () => {
    const mockPty = createMockPty();
    const manager = new SessionManager(5, () => mockPty, 30_000);
    const ws1 = createMockWs();

    const token = manager.create(ws1);
    assert.ok(token);

    // Simulate PTY producing some output
    mockPty._dataHandler?.("hello from PTY\r\n");

    // Disconnect
    ws1.emit("close");
    assert.equal(manager.activeCount, 1);

    // Reconnect with a fresh WS
    const ws2 = createMockWs();
    const resumed = manager.resume(token!, ws2, 80, 24);
    assert.ok(resumed, "resume() should return true for a live session");

    const calls = (ws2.send as ReturnType<typeof mock.fn>).mock.calls;
    const msgs = calls.map((c) => c.arguments[0] as string | Buffer);

    // First message should be the "resumed" JSON control message
    const resumedMsg = JSON.parse(msgs[0] as string);
    assert.equal(resumedMsg.type, "resumed");
    assert.equal(resumedMsg.token, token);

    // Second message should be the scrollback replay (binary Buffer)
    assert.ok(Buffer.isBuffer(msgs[1]), "scrollback should be replayed as binary");
  });

  it("resume returns false for unknown token", () => {
    const manager = new SessionManager(5, () => createMockPty());
    const ws = createMockWs();
    const resumed = manager.resume("nonexistent-token", ws, 80, 24);
    assert.equal(resumed, false);
  });

  it("handles PTY spawn failure gracefully", () => {
    const manager = new SessionManager(5, () => {
      throw new Error("no pty available");
    });
    const ws = createMockWs();

    const token = manager.create(ws);
    assert.equal(token, null);
    assert.equal(
      (ws.close as ReturnType<typeof mock.fn>).mock.callCount(),
      1,
    );
  });

  it("destroyAll cleans up all sessions", () => {
    const manager = new SessionManager(5, () => createMockPty(), 30_000);

    manager.create(createMockWs());
    manager.create(createMockWs());
    assert.equal(manager.activeCount, 2);

    manager.destroyAll();
    assert.equal(manager.activeCount, 0);
  });

  it("getAllSessions returns id, userId, and createdAt timestamp", () => {
    const mockPty = createMockPty();
    const manager = new SessionManager(5, () => mockPty);
    const ws = createMockWs();

    const token = manager.create(ws);
    assert.ok(token);

    const all = manager.getAllSessions();
    assert.equal(all.length, 1);
    assert.equal(all[0].id, token);
    assert.equal(all[0].userId, "default");
    assert.equal(typeof all[0].createdAt, "number");
  });
});
