import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { makeMessage } from "@/__tests__/mocks/data";

// MarkdownContent pulls in shiki (heavy async loading). Mock it to a plain
// renderer so component tests stay fast and deterministic.
vi.mock("@/components/chat/MarkdownContent", () => ({
  MarkdownContent: ({ content }: { content: string }) => (
    <div data-testid="markdown-content">{content}</div>
  ),
}));

describe("MessageBubble", () => {
  // --- Role display ---

  it("renders an article with accessible label 'You' for user messages", () => {
    const msg = makeMessage({ role: "user", content: "Hello" });
    render(<MessageBubble message={msg} />);
    expect(screen.getByRole("article", { name: "You" })).toBeInTheDocument();
  });

  it("renders an article with accessible label 'Claude' for assistant messages", () => {
    const msg = makeMessage({ role: "assistant", content: "Hi there", status: "complete" });
    render(<MessageBubble message={msg} />);
    expect(screen.getByRole("article", { name: "Claude" })).toBeInTheDocument();
  });

  it("renders 'Error from Claude' label for error messages", () => {
    const msg = makeMessage({ role: "assistant", content: "Oops", status: "error" });
    render(<MessageBubble message={msg} />);
    expect(screen.getByRole("article", { name: "Error from Claude" })).toBeInTheDocument();
  });

  // --- Content rendering ---

  it("renders plain text content for user messages", () => {
    const msg = makeMessage({ role: "user", content: "Hello world" });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders MarkdownContent for assistant messages", () => {
    const msg = makeMessage({
      role: "assistant",
      content: "**Bold text**",
      status: "complete",
    });
    render(<MessageBubble message={msg} />);
    expect(screen.getByTestId("markdown-content")).toHaveTextContent("**Bold text**");
  });

  it("extracts text from ContentBlock array", () => {
    const msg = makeMessage({
      role: "user",
      content: [{ type: "text", text: "Block text" }],
    });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Block text")).toBeInTheDocument();
  });

  // --- Streaming indicator ---

  it("shows streaming cursor when status is 'streaming'", () => {
    const msg = makeMessage({
      role: "assistant",
      content: "Typing…",
      status: "streaming",
    });
    const { container } = render(<MessageBubble message={msg} />);
    // The streaming cursor is aria-hidden, so query by class
    const cursor = container.querySelector(".animate-pulse-soft");
    expect(cursor).toBeInTheDocument();
  });

  it("does not show streaming cursor when status is 'complete'", () => {
    const msg = makeMessage({
      role: "assistant",
      content: "Done",
      status: "complete",
    });
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.querySelector(".animate-pulse-soft")).not.toBeInTheDocument();
  });
});
