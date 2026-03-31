import { describe, it, expect, vi, afterEach } from "vitest";
import { cn, formatDate, truncate, extractTextContent } from "@/lib/utils";

// ---------------------------------------------------------------------------
// cn
// ---------------------------------------------------------------------------
describe("cn", () => {
  it("merges class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("deduplicates conflicting Tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("ignores falsy values", () => {
    expect(cn("foo", false && "bar", undefined, null, "baz")).toBe("foo baz");
  });

  it("handles conditional objects", () => {
    expect(cn({ "text-red-500": true, "text-blue-500": false })).toBe("text-red-500");
  });
});

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------
describe("truncate", () => {
  it("returns string unchanged when within limit", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates and appends ellipsis at maxLength", () => {
    const result = truncate("hello world", 8);
    expect(result).toBe("hello...");
    expect(result.length).toBe(8);
  });

  it("handles exact-length strings without truncation", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// extractTextContent
// ---------------------------------------------------------------------------
describe("extractTextContent", () => {
  it("returns string content as-is", () => {
    expect(extractTextContent("hello")).toBe("hello");
  });

  it("extracts text blocks from an array", () => {
    const blocks = [
      { type: "text", text: "Hello " },
      { type: "text", text: "world" },
    ];
    expect(extractTextContent(blocks)).toBe("Hello world");
  });

  it("skips non-text blocks", () => {
    const blocks = [
      { type: "text", text: "visible" },
      { type: "tool_use", id: "x", name: "bash", input: {} },
      { type: "text", text: " text" },
    ];
    expect(extractTextContent(blocks)).toBe("visible text");
  });

  it("returns empty string for non-array, non-string values", () => {
    expect(extractTextContent(null)).toBe("");
    expect(extractTextContent(undefined)).toBe("");
    expect(extractTextContent(42)).toBe("");
  });

  it("returns empty string for empty array", () => {
    expect(extractTextContent([])).toBe("");
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe("formatDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for timestamps within the last minute', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:30Z"));
    const ts = new Date("2024-01-15T12:00:00Z").getTime();
    expect(formatDate(ts)).toBe("just now");
  });

  it("returns minutes ago for recent timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:30:00Z"));
    const ts = new Date("2024-01-15T12:00:00Z").getTime();
    expect(formatDate(ts)).toBe("30m ago");
  });

  it("returns hours ago within the same day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T15:00:00Z"));
    const ts = new Date("2024-01-15T12:00:00Z").getTime();
    expect(formatDate(ts)).toBe("3h ago");
  });

  it("returns days ago within the past week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-18T12:00:00Z"));
    const ts = new Date("2024-01-15T12:00:00Z").getTime();
    expect(formatDate(ts)).toBe("3d ago");
  });

  it("returns formatted date for timestamps older than a week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-15T12:00:00Z"));
    const ts = new Date("2024-01-01T12:00:00Z").getTime();
    const result = formatDate(ts);
    // Should be a locale date string
    expect(result).toMatch(/Jan/i);
    expect(result).toMatch(/1/);
  });
});
