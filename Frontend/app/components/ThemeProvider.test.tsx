import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { ThemeProvider } from "./ThemeProvider";
import { settingsService } from "@/lib/settings";

beforeEach(() => settingsService.resetSettings());
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mediaMock(legacy = false) {
  const listeners = new Set<() => void>();
  const media = {
    matches: false,
    addEventListener: legacy ? undefined : vi.fn((_event: string, fn: () => void) => listeners.add(fn)),
    removeEventListener: legacy ? undefined : vi.fn((_event: string, fn: () => void) => listeners.delete(fn)),
    addListener: vi.fn((fn: () => void) => listeners.add(fn)),
    removeListener: vi.fn((fn: () => void) => listeners.delete(fn)),
  };
  vi.stubGlobal("matchMedia", () => media);
  return { media, listeners, change(dark: boolean) { act(() => { media.matches = dark; listeners.forEach(fn => fn()); }); } };
}

describe("runtime theme", () => {
  it.each([false, true])("tracks system changes and cleans up (legacy=%s)", (legacy) => {
    const { listeners, change } = mediaMock(legacy);
    const view = render(<ThemeProvider>content</ThemeProvider>);
    expect(listeners.size).toBe(1);
    change(true);
    expect(document.documentElement).toHaveClass("dark");
    act(() => settingsService.updateSettings({ theme: "light" }));
    expect(listeners.size).toBe(0);
    change(true);
    expect(document.documentElement).not.toHaveClass("dark");
    act(() => settingsService.updateSettings({ theme: "dark" }));
    change(false);
    expect(document.documentElement).toHaveClass("dark");
    act(() => settingsService.updateSettings({ theme: "system" }));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(listeners.size).toBe(1);
    act(() => settingsService.updateSettings({ language: "es" }));
    expect(listeners.size).toBe(1);
    view.unmount();
    expect(listeners.size).toBe(0);
  });

  it("works with no media API and no listener API", () => {
    vi.stubGlobal("matchMedia", undefined);
    const view = render(<ThemeProvider>content</ThemeProvider>);
    expect(document.documentElement).not.toHaveClass("dark");
    view.unmount();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    render(<ThemeProvider>content</ThemeProvider>);
    expect(document.documentElement).toHaveClass("dark");
  });

  it("applies an in-memory theme when persistence fails", () => {
    mediaMock();
    render(<ThemeProvider>content</ThemeProvider>);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    act(() => settingsService.updateSettings({ theme: "dark" }));
    expect(document.documentElement).toHaveClass("dark");
  });
});
