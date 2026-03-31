import { describe, it, expect } from "vitest";
import { tokenize, excerpt, highlight } from "@/lib/search/highlighter";

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------
describe("tokenize", () => {
  it("splits on whitespace", () => {
    expect(tokenize("hello world")).toEqual(["hello", "world"]);
  });

  it("trims leading/trailing whitespace", () => {
    expect(tokenize("  foo  ")).toEqual(["foo"]);
  });

  it("filters empty tokens", () => {
    expect(tokenize("a  b   c")).toEqual(["a", "b", "c"]);
  });

  it("returns empty array for empty string", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(tokenize("   ")).toEqual([]);
  });

  it("does not lowercase tokens (callers do that)", () => {
    expect(tokenize("Hello World")).toEqual(["Hello", "World"]);
  });
});

// ---------------------------------------------------------------------------
// excerpt
// ---------------------------------------------------------------------------
describe("excerpt", () => {
  it("returns text sliced to maxLength when no query", () => {
    const text = "a".repeat(200);
    expect(excerpt(text, "")).toHaveLength(160);
  });

  it("centres around the first match", () => {
    const text = "padding".repeat(10) + "TARGET" + "padding".repeat(10);
    const result = excerpt(text, "TARGET", 30);
    expect(result.toLowerCase()).toContain("target");
  });

  it("adds ellipsis when text is truncated at start", () => {
    const text = "a".repeat(100) + "needle" + "b".repeat(100);
    const result = excerpt(text, "needle", 20);
    expect(result.startsWith("…")).toBe(true);
  });

  it("adds ellipsis when text is truncated at end", () => {
    const text = "needle" + "b".repeat(200);
    const result = excerpt(text, "needle", 20);
    expect(result.endsWith("…")).toBe(true);
  });

  it("returns the beginning when query is not found", () => {
    const text = "hello world foo bar";
    const result = excerpt(text, "notfound", 160);
    expect(result).toBe(text);
  });
});

// ---------------------------------------------------------------------------
// highlight
// ---------------------------------------------------------------------------
describe("highlight", () => {
  it("wraps matching term in <mark> tag", () => {
    const result = highlight("hello world", "hello");
    expect(result).toContain('<mark class="search-highlight">hello</mark>');
  });

  it("is case-insensitive", () => {
    const result = highlight("Hello World", "hello");
    expect(result).toContain('<mark class="search-highlight">Hello</mark>');
  });

  it("escapes HTML characters in the text", () => {
    const result = highlight("<script>alert(1)</script>", "script");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;");
  });

  it("highlights all occurrences", () => {
    const result = highlight("foo bar foo", "foo");
    const count = (result.match(/<mark/g) ?? []).length;
    expect(count).toBe(2);
  });

  it("returns escaped text when query is empty", () => {
    const result = highlight("hello & world", "");
    expect(result).toBe("hello &amp; world");
  });

  it("highlights multiple tokens", () => {
    const result = highlight("hello world", "hello world");
    expect(result).toContain('<mark class="search-highlight">hello</mark>');
    expect(result).toContain('<mark class="search-highlight">world</mark>');
  });
});
