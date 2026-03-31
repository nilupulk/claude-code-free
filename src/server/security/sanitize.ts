/** HTML entity map for escaping user content rendered in HTML context */
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

/** Escape a string for safe embedding in HTML (prevents XSS in text nodes/attributes) */
export function escapeHtml(str: string): string {
  return String(str).replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] ?? char);
}

/** Strip null bytes and dangerous control characters (keep \t, \n, \r) */
export function sanitizeString(input: string): string {
  return input
    .replace(/\0/g, "")                           // null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""); // C0 controls (keep tab/LF/CR)
}

/** Sanitize a filename: strip path separators and illegal characters */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\:*?"<>|]/g, "-")   // replace illegal chars
    .replace(/\.\./g, "")            // remove dotdot sequences
    .replace(/^\.+/, "")             // no leading dots
    .slice(0, 255);                  // max filename length
}

/** Validate a string is within the maximum allowed length */
export function validateLength(
  input: string,
  maxLength: number,
  fieldName = "input"
): string {
  if (input.length > maxLength) {
    throw new Error(
      `${fieldName} exceeds maximum length of ${maxLength} characters (got ${input.length})`
    );
  }
  return input;
}

/** Assert a value is a non-empty string, throw with a descriptive error if not */
export function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required and must be a non-empty string`);
  }
  return value;
}

/** Assert a value is one of the allowed enum members */
export function requireEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string
): T {
  if (!allowed.includes(value as T)) {
    throw new Error(`${fieldName} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

/** Strip ANSI escape codes (for safe display of terminal output) */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

/**
 * Validate a content-type/file extension against an allowlist.
 * Returns true if the extension is in the allowed set.
 */
export function isAllowedExtension(ext: string, allowlist: readonly string[]): boolean {
  return allowlist.includes(ext.toLowerCase().replace(/^\./, ""));
}
