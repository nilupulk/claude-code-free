import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import type { IncomingMessage } from "node:http";
import { ConnectionRateLimiter, validateAuthToken } from "../auth.js";

function mockReq(url: string, host = "localhost:3000"): IncomingMessage {
  return { url, headers: { host } } as unknown as IncomingMessage;
}

describe("validateAuthToken", () => {
  const originalEnv = process.env.AUTH_TOKEN;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AUTH_TOKEN;
    } else {
      process.env.AUTH_TOKEN = originalEnv;
    }
  });

  it("allows all connections when AUTH_TOKEN is not set", () => {
    delete process.env.AUTH_TOKEN;
    assert.equal(validateAuthToken(mockReq("/ws")), true);
  });

  it("rejects connections without token when AUTH_TOKEN is set", () => {
    process.env.AUTH_TOKEN = "secret123";
    assert.equal(validateAuthToken(mockReq("/ws")), false);
  });

  it("rejects connections with wrong token", () => {
    process.env.AUTH_TOKEN = "secret123";
    assert.equal(validateAuthToken(mockReq("/ws?token=wrong")), false);
  });

  it("accepts connections with correct token", () => {
    process.env.AUTH_TOKEN = "secret123";
    assert.equal(validateAuthToken(mockReq("/ws?token=secret123")), true);
  });
});

describe("ConnectionRateLimiter", () => {
  it("allows connections under the limit", () => {
    const limiter = new ConnectionRateLimiter(3, 60_000);
    assert.equal(limiter.allow("1.2.3.4"), true);
    assert.equal(limiter.allow("1.2.3.4"), true);
    assert.equal(limiter.allow("1.2.3.4"), true);
  });

  it("blocks connections over the limit", () => {
    const limiter = new ConnectionRateLimiter(2, 60_000);
    assert.equal(limiter.allow("1.2.3.4"), true);
    assert.equal(limiter.allow("1.2.3.4"), true);
    assert.equal(limiter.allow("1.2.3.4"), false);
  });

  it("tracks IPs independently", () => {
    const limiter = new ConnectionRateLimiter(1, 60_000);
    assert.equal(limiter.allow("1.2.3.4"), true);
    assert.equal(limiter.allow("5.6.7.8"), true);
    assert.equal(limiter.allow("1.2.3.4"), false);
    assert.equal(limiter.allow("5.6.7.8"), false);
  });

  it("cleans up stale entries", () => {
    const limiter = new ConnectionRateLimiter(1, 1); // 1ms window
    limiter.allow("1.2.3.4");
    // Wait for window to expire
    const start = Date.now();
    while (Date.now() - start < 5) {
      // busy wait 5ms
    }
    limiter.cleanup();
    assert.equal(limiter.allow("1.2.3.4"), true);
  });
});
