import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  settingsService,
  settingsValidation,
} from "./settings";

const STORAGE_KEY = "gate_delay_user_settings";

describe("settingsService happy path", () => {
  beforeEach(() => {
    localStorage.clear();
    settingsService.resetSettings();
    vi.restoreAllMocks();
  });

  it("starts from DEFAULT_SETTINGS after reset", () => {
    expect(settingsService.getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(settingsService.getSetting("theme")).toBe("system");
    expect(settingsService.getSetting("trading").defaultSlippage).toBe(0.5);
  });

  it("updates a setting, notifies subscribers, and persists to localStorage", () => {
    const seen: string[] = [];
    const unsubscribe = settingsService.subscribe((settings) => {
      seen.push(settings.theme);
    });

    settingsService.updateSettings({ theme: "dark" });

    expect(settingsService.getSetting("theme")).toBe("dark");
    expect(seen).toContain("dark");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").theme).toBe(
      "dark",
    );
    unsubscribe();
  });

  it("updates a nested trading setting without dropping sibling keys", () => {
    settingsService.updateNestedSetting("trading", { defaultSlippage: 1.5 });
    const trading = settingsService.getSetting("trading");
    expect(trading.defaultSlippage).toBe(1.5);
    expect(trading.confirmTransactions).toBe(true);
    expect(trading.gasPreference).toBe("standard");
  });

  it("rejects invalid import JSON and keeps current settings", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    settingsService.updateSettings({ theme: "light" });
    expect(settingsService.importSettings("not-json")).toBe(false);
    expect(settingsService.getSetting("theme")).toBe("light");
    expect(error).toHaveBeenCalled();
  });

  it("imports valid JSON by merging onto defaults", () => {
    const ok = settingsService.importSettings(
      JSON.stringify({ theme: "dark", language: "es" }),
    );
    expect(ok).toBe(true);
    const settings = settingsService.getSettings();
    expect(settings.theme).toBe("dark");
    expect(settings.language).toBe("es");
    expect(settings.currency).toBe(DEFAULT_SETTINGS.currency);
  });

  it("logs and keeps defaults when localStorage save fails", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    settingsService.updateSettings({ theme: "dark" });

    expect(settingsService.getSetting("theme")).toBe("dark");
    expect(error).toHaveBeenCalled();
  });
});

describe("settingsValidation", () => {
  it("accepts slippage inside 0.1–50 and rejects outside", () => {
    expect(settingsValidation.slippage(0.5)).toBe(true);
    expect(settingsValidation.slippage(0)).toBe(
      "Slippage must be between 0.1% and 50%",
    );
    expect(settingsValidation.slippage(Number.NaN)).toBe(
      "Slippage must be a number",
    );
  });

  it("accepts known languages and currencies only", () => {
    expect(settingsValidation.language("en")).toBe(true);
    expect(settingsValidation.language("xx")).toBe("Unsupported language");
    expect(settingsValidation.currency("USD")).toBe(true);
    expect(settingsValidation.currency("XYZ")).toBe("Unsupported currency");
  });
});
