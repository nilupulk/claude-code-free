import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInput } from "@/components/chat/ChatInput";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockAddMessage = vi.fn().mockReturnValue("msg-assistant-id");
const mockUpdateMessage = vi.fn();

vi.mock("@/lib/store", () => ({
  useChatStore: vi.fn(() => ({
    conversations: [
      {
        id: "conv-1",
        title: "Test",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: "claude-sonnet-4-6",
      },
    ],
    settings: { model: "claude-sonnet-4-6" },
    addMessage: mockAddMessage,
    updateMessage: mockUpdateMessage,
  })),
}));

// Provide a simple async generator so streaming can be tested
const streamChunks = [
  { type: "text" as const, content: "Hello" },
  { type: "text" as const, content: " world" },
  { type: "done" as const },
];

vi.mock("@/lib/api", () => ({
  streamChat: vi.fn(async function* () {
    for (const chunk of streamChunks) {
      yield chunk;
    }
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
  const user = userEvent.setup();
  const utils = render(<ChatInput conversationId="conv-1" />);
  const textarea = screen.getByRole("textbox", { name: /message/i });
  return { user, textarea, ...utils };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Rendering ---

  it("renders the message textarea", () => {
    setup();
    expect(screen.getByRole("textbox", { name: /message/i })).toBeInTheDocument();
  });

  it("renders the send button (disabled when input is empty)", () => {
    setup();
    const sendBtn = screen.getByRole("button", { name: /send message/i });
    expect(sendBtn).toBeInTheDocument();
    expect(sendBtn).toHaveAttribute("aria-disabled", "true");
  });

  it("renders the attach file button", () => {
    setup();
    expect(screen.getByRole("button", { name: /attach file/i })).toBeInTheDocument();
  });

  // --- Input behaviour ---

  it("enables the send button when text is entered", async () => {
    const { user, textarea } = setup();
    await user.type(textarea, "Hello");
    const sendBtn = screen.getByRole("button", { name: /send message/i });
    expect(sendBtn).toHaveAttribute("aria-disabled", "false");
  });

  it("clears input after submitting", async () => {
    const { user, textarea } = setup();
    await user.type(textarea, "Hello");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(textarea).toHaveValue(""));
  });

  it("submits on Enter key (without Shift)", async () => {
    const { user, textarea } = setup();
    await user.type(textarea, "Hi");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(mockAddMessage).toHaveBeenCalled());
  });

  it("does not submit on Shift+Enter (new line)", async () => {
    const { user, textarea } = setup();
    await user.type(textarea, "Line 1");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(mockAddMessage).not.toHaveBeenCalled();
  });

  it("does not submit when input is only whitespace", async () => {
    const { user, textarea } = setup();
    await user.type(textarea, "   ");
    await user.keyboard("{Enter}");
    expect(mockAddMessage).not.toHaveBeenCalled();
  });

  // --- Message creation ---

  it("adds a user message and a streaming assistant placeholder on submit", async () => {
    const { user, textarea } = setup();
    await user.type(textarea, "Hello");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(mockAddMessage).toHaveBeenCalledTimes(2));
    const [userCall, assistantCall] = mockAddMessage.mock.calls;
    expect(userCall[1]).toMatchObject({ role: "user", content: "Hello" });
    expect(assistantCall[1]).toMatchObject({ role: "assistant", status: "streaming" });
  });

  // --- Streaming ---

  it("shows stop button while streaming and send button after completion", async () => {
    const { user, textarea } = setup();
    await user.type(textarea, "Hello");
    await user.keyboard("{Enter}");

    // Stop button should appear immediately while streaming
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /stop generation/i })).toBeInTheDocument()
    );

    // After stream completes, send button returns
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument()
    );
  });

  it("calls updateMessage with streamed content", async () => {
    const { user, textarea } = setup();
    await user.type(textarea, "Hello");
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(mockUpdateMessage).toHaveBeenCalledWith(
        "conv-1",
        "msg-assistant-id",
        expect.objectContaining({ content: expect.stringContaining("Hello") })
      )
    );
  });

  // --- Stop ---

  it("shows send button again after clicking stop", async () => {
    const { user, textarea } = setup();
    await user.type(textarea, "Hello");

    // Click send via button click instead of Enter
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    const stopBtn = await screen.findByRole("button", { name: /stop generation/i });
    await user.click(stopBtn);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument()
    );
  });
});
