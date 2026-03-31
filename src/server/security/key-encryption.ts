import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;  // 96-bit IV for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

function deriveKey(encryptionKey: string): Buffer {
  // Derive a 32-byte key from the env var using SHA-256
  return createHash("sha256").update(encryptionKey, "utf8").digest();
}

function encryptWithKey(plaintext: string, encryptionKey: string): string {
  const key = deriveKey(encryptionKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (hex-encoded, colon-separated)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptWithKey(ciphertext: string, encryptionKey: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }
  const [ivHex, authTagHex, dataHex] = parts;
  const key = deriveKey(encryptionKey);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Encrypt an API key with AES-256-GCM using ENCRYPTION_KEY env var */
export function encrypt(plaintext: string): string {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY environment variable not set");
  }
  return encryptWithKey(plaintext, encryptionKey);
}

/** Decrypt an API key encrypted with encrypt() */
export function decrypt(ciphertext: string): string {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY environment variable not set");
  }
  return decryptWithKey(ciphertext, encryptionKey);
}

/**
 * Re-encrypt a value with a new encryption key (key rotation).
 * The current ENCRYPTION_KEY env var is used to decrypt, then re-encrypted
 * with newEncryptionKey. The caller is responsible for updating the env var.
 */
export function rotateEncryption(ciphertext: string, newEncryptionKey: string): string {
  const plaintext = decrypt(ciphertext);
  return encryptWithKey(plaintext, newEncryptionKey);
}

/**
 * Mask an API key for safe display in UI.
 * e.g. "sk-ant-api03-abc...xyz" → "sk-ant-api03-...****"
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) return "****";
  const prefix = apiKey.slice(0, Math.min(14, Math.floor(apiKey.length / 3)));
  return `${prefix}...****`;
}

/**
 * Scrub API keys and secrets from arbitrary strings (for log sanitization).
 * Matches common patterns: sk-ant-..., Bearer tokens, api_key= patterns.
 */
export function scrubApiKey(text: string): string {
  return text
    .replace(/sk-ant-[A-Za-z0-9\-_]{10,}/g, "sk-ant-****")
    .replace(/(Bearer\s+)[A-Za-z0-9\-_.]{20,}/gi, "$1****")
    .replace(/(api[_-]?key["'\s:=]+)[A-Za-z0-9\-_]{20,}/gi, "$1****")
    .replace(/(password["'\s:=]+)[^\s"',;]{8,}/gi, "$1****");
}
