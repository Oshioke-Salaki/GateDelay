import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  SettingsService,
  settingsService,
  type UserSettings,
} from "./settings";

const STORAGE_KEY = "gate_delay_user_settings";

/**
 * Emulates what the browser does when *another* tab writes localStorage:
 * the value lands in the shared store and every other tab receives a
 * `storage` event. The writing tab itself never receives the event.
 */
function writeFromOtherTab(value: string | null): void {
  if (value === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, value);
  }
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: STORAGE_KEY,
      newValue: value,
      storageArea: localStorage,
    })
  );
}

describe("settings cross-tab synchronization (FE-014)", () => {
  beforeEach(() => {
    localStorage.clear();
    settingsService.resetSettings();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies another tab's update once and never re-saves it", () => {
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const service = new SettingsService();
    const seen: UserSettings[] = [];
    const stop = service.subscribe((settings) => seen.push(settings));

    writeFromOtherTab(JSON.stringify({ theme: "dark", language: "es" }));

    expect(service.getSetting("theme")).toBe("dark");
    expect(service.getSetting("language")).toBe("es");
    expect(service.getSetting("currency")).toBe(DEFAULT_SETTINGS.currency);
    expect(seen.filter((settings) => settings.theme === "dark")).toHaveLength(1);
    // Exactly one write: the one the "other tab" made. The receiving service
    // applied the change in memory without echoing it back to storage.
    expect(writes).toHaveBeenCalledTimes(1);
    stop();
  });

  it("does not notify again when the same remote value arrives twice", () => {
    const service = new SettingsService();
    const notifications = vi.fn();
    const stop = service.subscribe(notifications);

    const payload = JSON.stringify({ theme: "dark" });
    writeFromOtherTab(payload);
    writeFromOtherTab(payload);

    expect(notifications).toHaveBeenCalledTimes(2); // initial emit + one change
    stop();
  });

  it("ignores storage events for other keys, other storage areas, and synthetic events", () => {
    const service = new SettingsService();
    const notifications = vi.fn();
    const stop = service.subscribe(notifications);

    localStorage.setItem("unrelated-key", "1");
    window.dispatchEvent(
      new StorageEvent("storage", { key: "unrelated-key", newValue: "1", storageArea: localStorage })
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: JSON.stringify({ theme: "dark" }),
        storageArea: sessionStorage,
      })
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: JSON.stringify({ theme: "dark" }),
        storageArea: null,
      })
    );

    expect(notifications).toHaveBeenCalledTimes(1); // only the initial emit
    expect(service.getSetting("theme")).toBe("system");
    stop();
  });

  it("reuses default merging and theme normalization for remote payloads", () => {
    const service = new SettingsService();
    // A writing tab always persists complete nested objects
    // (updateNestedSetting merges onto its in-memory state before saving).
    const trading = { ...DEFAULT_SETTINGS.trading, defaultSlippage: 2.5 };

    writeFromOtherTab(JSON.stringify({ theme: "neon", trading }));

    expect(service.getSetting("theme")).toBe("system");
    expect(service.getSetting("trading").defaultSlippage).toBe(2.5);
    expect(service.getSetting("trading").confirmTransactions).toBe(true);
    expect(service.getSetting("currency")).toBe(DEFAULT_SETTINGS.currency);
  });

  it("keeps current settings and logs when the remote payload is malformed", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const service = new SettingsService();
    service.updateSettings({ theme: "light" });
    const notifications = vi.fn();
    const stop = service.subscribe(notifications);
    const before = service.getSettings();

    writeFromOtherTab("not-json{");

    expect(service.getSettings()).toEqual(before);
    expect(notifications).toHaveBeenCalledTimes(1); // no update, no notification
    expect(error).toHaveBeenCalledWith(
      "Failed to apply cross-tab settings update",
      expect.any(Error)
    );
    stop();
  });

  it("reverts to defaults when another tab removes the settings key", () => {
    const service = new SettingsService();
    service.updateSettings({ theme: "dark", language: "es" });
    const notifications = vi.fn();
    const stop = service.subscribe(notifications);

    writeFromOtherTab(null);

    expect(service.getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(notifications).toHaveBeenCalledTimes(2); // initial emit + revert
    stop();
  });

  it("does not dispatch a storage event when saving locally", () => {
    const service = new SettingsService();
    const dispatch = vi.spyOn(window, "dispatchEvent");

    service.updateSettings({ theme: "dark" });

    const storageDispatches = dispatch.mock.calls.filter(
      ([event]) => (event as Event).type === "storage"
    );
    expect(storageDispatches).toHaveLength(0);
  });

  it("the exported settingsService participates in cross-tab updates", () => {
    settingsService.resetSettings();
    const notifications = vi.fn();
    const stop = settingsService.subscribe(notifications);

    writeFromOtherTab(JSON.stringify({ theme: "dark" }));

    expect(settingsService.getSetting("theme")).toBe("dark");
    expect(notifications).toHaveBeenCalledTimes(2); // initial emit + one change
    stop();
    settingsService.resetSettings();
  });
});
