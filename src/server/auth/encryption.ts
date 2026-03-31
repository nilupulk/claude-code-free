import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

/**
 * Standalone AES-256-GCM encryption utilities.
 *
 * The encryption key is derived from the ENCRYPTION_KEY environment variable.
 * If the variable is a 64-character hex string it is used directly; otherwise
 * it is stretched via HMAC-SHA256 so any string length is accepted.
 *
 * Layout of encrypted payloads: IV(12 bytes) | AuthTag(16 bytes) | Ciphertext
 */

// ── Key derivation ────────────────────────────────────────────────────────────

/** Derive a 32-byte key from an arbitrary secret string. */
export function deriveKey(secret: string, context = "cc-encryption-key-v1"): Buffer {
  const hmac = createHmac("sha256", secret);
  hmac.update(context);
  return hmac.digest();
}

let _defaultKey: Buffer | null = null;

function getDefaultKey(): Buffer {
  if (_defaultKey) return _defaultKey;

  const raw = process.env.ENCRYPTION_KEY ?? process.env.SESSION_SECRET;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required for API key encryption. " +
        "Set it to a random 32-byte hex string.",
    );
  }

  // Accept 64-char hex directly (already 32 bytes).
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    _defaultKey = Buffer.from(raw, "hex");
  } else {
    _defaultKey = deriveKey(raw);
  }
  return _defaultKey;
}

// ── Core encrypt / decrypt ────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Pass an explicit `key` to override the default from the environment.
 */
export function encrypt(plaintext: string, key?: Buffer): string {
  const k = key ?? getDefaultKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: IV(12) | AuthTag(16) | Ciphertext
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

/**
 * Decrypt a value produced by {@link encrypt}.
 * Returns null if decryption fails (wrong key, tampered ciphertext, etc.).
 */
export function decrypt(encoded: string, key?: Buffer): string | null {
  try {
    const k = key ?? getDefaultKey();
    const buf = Buffer.from(encoded, "base64url");
    if (buf.length < 29) return null; // too short: 12 IV + 16 tag + ≥1 byte
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", k, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
  } catch {
    return null;
  }
}

// ── Key generation helper ─────────────────────────────────────────────────────

/** Generate a cryptographically random 32-byte hex key for use in env vars. */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}
