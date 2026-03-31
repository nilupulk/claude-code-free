import { test, expect } from "@playwright/test";

test.describe("Chat flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("page loads and shows main UI", async ({ page }) => {
    // Basic smoke test: the app shell should render
    await expect(page).toHaveTitle(/Claude/i);
    await expect(page.locator("main, [role='main']").first()).toBeVisible();
  });

  test("chat input is present and focusable", async ({ page }) => {
    const input = page.getByRole("textbox", { name: /message/i });
    await expect(input).toBeVisible();
    await input.click();
    await expect(input).toBeFocused();
  });

  test("send button is disabled when input is empty", async ({ page }) => {
    const sendBtn = page.getByRole("button", { name: /send message/i });
    await expect(sendBtn).toHaveAttribute("aria-disabled", "true");
  });

  test("send button becomes active after typing", async ({ page }) => {
    const input = page.getByRole("textbox", { name: /message/i });
    await input.fill("Hello Claude");
    const sendBtn = page.getByRole("button", { name: /send message/i });
    await expect(sendBtn).toHaveAttribute("aria-disabled", "false");
  });

  test("input clears after pressing Enter", async ({ page }) => {
    const input = page.getByRole("textbox", { name: /message/i });
    await input.fill("Test message");
    await input.press("Enter");
    await expect(input).toHaveValue("");
  });

  test("Shift+Enter inserts a newline instead of submitting", async ({ page }) => {
    const input = page.getByRole("textbox", { name: /message/i });
    await input.fill("Line one");
    await input.press("Shift+Enter");
    // Input should still have content (not cleared)
    const value = await input.inputValue();
    expect(value).toContain("Line one");
  });

  test("attach file button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /attach file/i })
    ).toBeVisible();
  });
});
