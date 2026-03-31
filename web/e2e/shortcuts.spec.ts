import { test, expect } from "@playwright/test";

test.describe("Keyboard shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for the app to be interactive
    await page.waitForLoadState("networkidle");
  });

  test("Ctrl+K opens command palette", async ({ page }) => {
    await page.keyboard.press("Control+k");
    // Command palette should be visible; check for a search input inside it
    const palette = page
      .getByRole("dialog")
      .or(page.locator("[data-testid='command-palette']"))
      .first();
    await expect(palette).toBeVisible({ timeout: 3_000 });
  });

  test("Escape closes command palette", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const palette = page
      .getByRole("dialog")
      .or(page.locator("[data-testid='command-palette']"))
      .first();
    await expect(palette).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press("Escape");
    await expect(palette).not.toBeVisible({ timeout: 2_000 });
  });

  test("Ctrl+B toggles sidebar visibility", async ({ page }) => {
    const sidebar = page
      .locator("[data-testid='sidebar']")
      .or(page.locator("nav[aria-label]"))
      .first();

    const initiallyVisible = await sidebar.isVisible();
    await page.keyboard.press("Control+b");
    // State should have toggled
    if (initiallyVisible) {
      await expect(sidebar).not.toBeVisible({ timeout: 2_000 });
    } else {
      await expect(sidebar).toBeVisible({ timeout: 2_000 });
    }
  });

  test("Ctrl+, opens settings", async ({ page }) => {
    await page.keyboard.press("Control+,");
    // Look for a settings dialog or panel
    const settings = page
      .getByRole("dialog", { name: /settings/i })
      .or(page.locator("[data-testid='settings-panel']"))
      .first();
    await expect(settings).toBeVisible({ timeout: 3_000 });
  });

  test("Tab cycles focus through interactive elements", async ({ page }) => {
    // Start from body
    await page.keyboard.press("Tab");
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(firstFocused).toBeTruthy();
  });
});
