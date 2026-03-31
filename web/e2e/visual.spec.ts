import { test, expect } from "@playwright/test";

// Visual regression tests capture baseline screenshots and compare on subsequent runs.
// Run `npm run test:visual` to update baselines.
// These only run in chromium to avoid cross-browser rendering differences.
test.use({ ...{ browserName: "chromium" } });

test.describe("Visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Disable animations for stable screenshots
    await page.addStyleTag({
      content: `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }`,
    });
  });

  test("home page — dark theme (default)", async ({ page }) => {
    await expect(page).toHaveScreenshot("home-dark.png", {
      maxDiffPixelRatio: 0.02,
      fullPage: false,
    });
  });

  test("home page — empty chat input area", async ({ page }) => {
    const inputArea = page.locator(
      "[class*='border-t']",
      { hasText: "Message Claude Code" }
    ).first();

    if (await inputArea.isVisible()) {
      await expect(inputArea).toHaveScreenshot("chat-input-empty.png", {
        maxDiffPixelRatio: 0.02,
      });
    }
  });

  test("chat input with text", async ({ page }) => {
    const input = page.getByRole("textbox", { name: /message/i });
    await input.fill("This is a test message to verify the input styling.");

    await expect(page).toHaveScreenshot("home-with-input.png", {
      maxDiffPixelRatio: 0.02,
      fullPage: false,
    });
  });

  test("mobile viewport layout", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({
      content: `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }`,
    });
    await expect(page).toHaveScreenshot("home-mobile.png", {
      maxDiffPixelRatio: 0.02,
      fullPage: false,
    });
  });
});
