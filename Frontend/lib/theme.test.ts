import { afterEach, describe, expect, it, vi } from "vitest";
import { themeInitializationScript, SETTINGS_STORAGE_KEY } from "./theme";
import { GET } from "@/app/theme-init.js/route";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("pre-paint initializer", () => {
  it.each([
    ['{"theme":"dark"}', false, true],
    ['{"theme":"light"}', true, false],
    ['{"theme":"system"}', false, false],
    ['{"theme":"system"}', true, true],
    [null, true, true],
    ['broken json', true, true],
    ['null', false, false],
    ['{"theme":"invalid"}', true, true],
  ])("resolves %s with OS dark=%s", (stored, osDark, expected) => {
    localStorage.clear();
    if (stored !== null) localStorage.setItem(SETTINGS_STORAGE_KEY, stored);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("matchMedia", () => ({ matches: osDark }));
    // Execute the actual script body served before React loads.
    window.eval(themeInitializationScript);
    expect(document.documentElement.classList.contains("dark")).toBe(expected);
  });

  it("falls back safely when storage and matchMedia are unavailable", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new Error("blocked"); });
    vi.stubGlobal("matchMedia", undefined);
    expect(() => window.eval(themeInitializationScript)).not.toThrow();
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("serves the shared initializer as external JavaScript", async () => {
    const response = GET();
    expect(response.headers.get("Content-Type")).toContain("application/javascript");
    expect(await response.text()).toBe(themeInitializationScript);
  });
});
