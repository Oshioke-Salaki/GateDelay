import { expect, test } from "@playwright/test";

test("loads the app shell and wallet no-wallet mode", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /predict flight outcomes/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /connect wallet/i })).toBeVisible();
});

test("opens market detail and reaches the inline trade UI", async ({ page }) => {
  await page.goto("/markets/1");

  await expect(page.getByText(/market #1/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /place trade/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /buy yes/i })).toBeVisible();
});

test("trade route handles unavailable demo market without crashing", async ({ page }) => {
  await page.goto("/trade/market-1");

  await expect(page.getByRole("heading", { name: /market not found/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /back to markets/i })).toBeVisible();
});
