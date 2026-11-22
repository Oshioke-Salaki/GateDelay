import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, parseImportedSettings, settingsService } from "./settings";

const STORAGE_KEY = "gate_delay_user_settings";

describe("settingsService.importSettings validation (FE-012)", () => {
  beforeEach(() => {
    localStorage.clear();
    settingsService.resetSettings();
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    settingsService.updateSettings({ theme: "light", language: "fr" });
  });

  const rejected: Array<[string, unknown]> = [
    ["a top-level array", [{ theme: "dark" }]],
    ["an empty array", []],
    ["null", null],
    ["a number", 42],
    ["a string", "dark"],
    ["an unsupported theme", { theme: "neon" }],
    ["an unknown top-level key", { theme: "dark", hacked: true }],
    ["an unsupported language", { language: "xx" }],
    ["an unsupported currency", { currency: "BTC" }],
    ["an unsupported date format", { dateFormat: "YY" }],
    ["an unsupported time format", { timeFormat: "36h" }],
    ["a null category", { notifications: null }],
    ["an array category", { trading: [1, 2] }],
    ["a primitive category", { privacy: true }],
    ["an unknown nested key", { display: { compactMode: true, evil: 1 } }],
    ["a non-boolean toggle", { notifications: { email: "yes" } }],
    ["a NaN-like slippage string", { trading: { defaultSlippage: "NaN" } }],
    ["a numeric slippage string", { trading: { defaultSlippage: "1" } }],
    ["slippage below range", { trading: { defaultSlippage: 0 } }],
    ["negative slippage", { trading: { defaultSlippage: -5 } }],
    ["slippage above range", { trading: { defaultSlippage: 99 } }],
    ["null slippage", { trading: { defaultSlippage: null } }],
    ["an unsupported gas preference", { trading: { gasPreference: "ludicrous" } }],
    ["a prototype-pollution key", JSON.parse('{"__proto__": {"theme": "dark"}}')],
    ["a valid field alongside an invalid one", { theme: "dark", trading: { defaultSlippage: 1000 } }],
  ];

  it.each(rejected)("rejects %s without mutating settings or storage", (_label, doc) => {
    const before = settingsService.getSettings();
    const storedBefore = localStorage.getItem(STORAGE_KEY);
    const listener = vi.fn();
    const unsubscribe = settingsService.subscribe(listener);
    listener.mockClear();

    expect(settingsService.importSettings(JSON.stringify(doc))).toBe(false);

    expect(settingsService.getSettings()).toBe(before);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(storedBefore);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("rejects a 1e999 slippage that parses to Infinity", () => {
    const before = settingsService.getSettings();
    expect(settingsService.importSettings('{"trading":{"defaultSlippage":1e999}}')).toBe(false);
    expect(settingsService.getSettings()).toBe(before);
  });

  it("round-trips an exported document", () => {
    settingsService.updateNestedSetting("trading", { defaultSlippage: 2, gasPreference: "fast" });
    const exported = settingsService.exportSettings();
    settingsService.resetSettings();

    expect(settingsService.importSettings(exported)).toBe(true);
    expect(settingsService.getSettings()).toEqual(JSON.parse(exported));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toEqual(JSON.parse(exported));
  });

  it("fills omitted nested fields from defaults", () => {
    expect(
      settingsService.importSettings(JSON.stringify({ trading: { defaultSlippage: 50 } })),
    ).toBe(true);
    expect(settingsService.getSetting("trading")).toEqual({
      ...DEFAULT_SETTINGS.trading,
      defaultSlippage: 50,
    });
    expect(settingsService.getSetting("theme")).toBe(DEFAULT_SETTINGS.theme);
  });
});

describe("parseImportedSettings", () => {
  it("accepts an empty object as defaults", () => {
    expect(parseImportedSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("accepts the slippage range boundaries", () => {
    expect(parseImportedSettings({ trading: { defaultSlippage: 0.1 } })).not.toBeNull();
    expect(parseImportedSettings({ trading: { defaultSlippage: 50 } })).not.toBeNull();
  });

  it("does not share nested objects with DEFAULT_SETTINGS", () => {
    const result = parseImportedSettings({ display: { compactMode: true } });
    expect(result?.display).not.toBe(DEFAULT_SETTINGS.display);
    expect(DEFAULT_SETTINGS.display.compactMode).toBe(false);
  });
});
