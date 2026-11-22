import { expect, test } from "@playwright/test";

for (const [theme, colorScheme, dark] of [
  ["dark", "light", true], ["light", "dark", false],
  ["system", "dark", true], ["system", "light", false],
] as const) {
  test(`pre-paint ${theme} with OS ${colorScheme}, then hydrate and reload`, async ({ page, context }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme });
    await context.addInitScript((savedTheme) => {
      if (!sessionStorage.getItem("theme-seeded")) {
        localStorage.setItem("gate_delay_user_settings", JSON.stringify({ theme: savedTheme }));
        sessionStorage.setItem("theme-seeded", "true");
      }
    }, theme);
    const diagnostics: string[] = [];
    page.on("console", message => {
      if (/hydration|didn't match|did not match|content security policy|refused to (execute|load).*script/i.test(message.text())) {
        diagnostics.push(message.text());
      }
    });
    page.on("pageerror", error => diagnostics.push(error.message));
    // Hold the React chunks to prove that the class is set independently of hydration.
    let release!: () => void;
    const hydrationGate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/_next/static/**/*.js*", async route => {
      await hydrationGate;
      await route.continue();
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    try {
      await page.goto("/settings", { waitUntil: "commit" });
      await expect(page.locator("body")).toBeAttached({ timeout: 60_000 });
      await expect.poll(() => page.locator("html").evaluate(el => el.classList.contains("dark")), { timeout: 60_000 }).toBe(dark);
      expect(await page.locator('head script[src="/theme-init.js"]').count()).toBe(1);
    } finally { release(); }
    await page.getByRole("radio", { name: /always use dark theme/i }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    await expect.poll(() => page.locator("html").evaluate(el => el.classList.contains("dark"))).toBe(true);
    expect(diagnostics).toEqual([]);
  });
}

test("external initializer runs under strict script CSP without inline permission", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", message => {
    if (/content security policy|refused to (execute|load).*script/i.test(message.text())) violations.push(message.text());
  });
  // Isolate the initializer from Next's existing inline bootstrap scripts.
  await page.route("**/theme-csp-check", route => route.fulfill({
    contentType: "text/html",
    headers: { "Content-Security-Policy": "default-src 'none'; script-src 'self'; img-src 'self'" },
    body: '<!doctype html><html><head><script src="/theme-init.js"></script></head><body>Theme CSP check</body></html>',
  }));
  await page.addInitScript(() => localStorage.setItem("gate_delay_user_settings", '{"theme":"dark"}'));
  await page.goto("/theme-csp-check");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(violations).toEqual([]);
});
