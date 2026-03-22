import { test, expect } from "@playwright/test";

test.describe("Smoke: page load", () => {
  test("loads the home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/UIGen/i);
  });

  test("shows the chat input", async ({ page }) => {
    await page.goto("/");
    const textarea = page.getByPlaceholder(
      "Describe the React component you want to create..."
    );
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeEnabled();
  });

  test("shows the preview welcome state before any component is generated", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Welcome to UI Generator")).toBeVisible();
  });
});

test.describe("Smoke: chat interaction", () => {
  test("typing in the input enables the send button", async ({ page }) => {
    await page.goto("/");
    const textarea = page.getByPlaceholder(
      "Describe the React component you want to create..."
    );
    const sendButton = page.locator('button[type="submit"]');

    await expect(sendButton).toBeDisabled();
    await textarea.fill("create a button");
    await expect(sendButton).toBeEnabled();
  });

  test("clearing the input disables the send button", async ({ page }) => {
    await page.goto("/");
    const textarea = page.getByPlaceholder(
      "Describe the React component you want to create..."
    );
    const sendButton = page.locator('button[type="submit"]');

    await textarea.fill("create a button");
    await expect(sendButton).toBeEnabled();
    await textarea.fill("");
    await expect(sendButton).toBeDisabled();
  });

  test("submitting a message shows it in the chat", async ({ page }) => {
    await page.goto("/");
    const textarea = page.getByPlaceholder(
      "Describe the React component you want to create..."
    );

    await textarea.fill("create a simple counter");
    await page.keyboard.press("Enter");

    await expect(page.getByText("create a simple counter")).toBeVisible({
      timeout: 5000,
    });
  });

  test("input is disabled while waiting for response", async ({ page }) => {
    await page.goto("/");
    const textarea = page.getByPlaceholder(
      "Describe the React component you want to create..."
    );

    await textarea.fill("create a button");
    await page.keyboard.press("Enter");

    // Immediately after submit, input should be disabled
    await expect(textarea).toBeDisabled({ timeout: 3000 });
  });
});

test.describe("Smoke: layout", () => {
  test("page has no horizontal scrollbar at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("page renders at mobile width without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });
});
