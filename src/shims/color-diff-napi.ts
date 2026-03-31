// Stub shim for color-diff-napi — native addon not available in this build.
// colorDiff.ts wraps all usage behind getColorModuleUnavailableReason() checks,
// so these stubs should never actually be called.

export type SyntaxTheme = Record<string, unknown>

export class ColorDiff {
  constructor(_: unknown) {}
  diff(_a: unknown, _b: unknown): unknown[] { return [] }
}

export class ColorFile {
  constructor(_: unknown) {}
  getColors(): unknown[] { return [] }
}

export function getSyntaxTheme(_themeName: string): SyntaxTheme | null {
  return null
}
