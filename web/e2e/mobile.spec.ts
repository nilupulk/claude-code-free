import { test, expect, devices } from "@playwright/test";

// These tests use the mobile projects defined in playwright.config.ts.
// They also run fine on desktop with viewport override.

test.describe("Mobile layout", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("desktop sidebar is hidden on mobile viewport", async ({ page }) => {
    // The main desktop sidebar should not be visible at narrow widths
    const desktopSidebar = page.locator(
      "[data-testid='sidebar']:not([data-testid='mobile-sidebar'])"
    );
    // It may be hidden via CSS rather than removed from DOM
    const isVisible = await desktopSidebar.first().isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  test("mobile menu button is visible on small screens", async ({ page }) => {
    const mobileMenu = page
      .locator("[data-testid='mobile-menu']")
      .or(page.getByRole("button", { name: /menu/i }))
      .first();
    await expect(mobileMenu).toBeVisible();
  });

  test("chat input is visible on mobile", async ({ page }) => {
    const input = page.getByRole("textbox", { name: /message/i });
    await expect(input).toBeVisible();
  });

  test("mobile sidebar opens when menu button is clicked", async ({ page }) => {
    const mobileMenu = page
      .locator("[data-testid='mobile-menu']")
      .or(page.getByRole("button", { name: /menu/i }))
      .first();

    const menuExists = await mobileMenu.isVisible().catch(() => false);
    if (!menuExists) {
      test.skip();
      return;
    }

    await mobileMenu.click();
    // A drawer/sheet or sidebar should become visible
    const mobileSidebar = page
      .locator("[data-testid='mobile-sidebar']")
      .or(page.getByRole("navigation"))
      .first();
    await expect(mobileSidebar).toBeVisible({ timeout: 2_000 });
  });

  test("tap on send button submits the message", async ({ page }) => {
    const input = page.getByRole("textbox", { name: /message/i });
    await input.fill("Hello from mobile");
    const sendBtn = page.getByRole("button", { name: /send message/i });
    await sendBtn.tap();
    await expect(input).toHaveValue("");
  });
});

test.describe("Tablet layout", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("page renders correctly at tablet size", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main, [role='main']").first()).toBeVisible();
  });
});
