import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsService } from "./settings";

afterEach(() => vi.restoreAllMocks());

describe("settings reliability", () => {
  it.each(["QuotaExceededError", "SecurityError"])("keeps session changes after %s and clears status on recovery", (name) => {
    const service = new SettingsService();
    const statuses = vi.fn();
    const stop = service.subscribePersistence(statuses);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", name);
    });
    service.updateSettings({ theme: "dark" });
    expect(service.getSetting("theme")).toBe("dark");
    expect(service.getPersistenceStatus()).toBe("session-only");
    const count = statuses.mock.calls.length;
    service.updateSettings({ language: "es" });
    expect(statuses).toHaveBeenCalledTimes(count);
    write.mockRestore();
    service.updateSettings({ theme: "light" });
    expect(service.getPersistenceStatus()).toBe("persisted");
    expect(JSON.parse(localStorage.getItem("gate_delay_user_settings")!).theme).toBe("light");
    stop();
  });

  it("handles unavailable storage, including a throwing property getter", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new Error("unavailable"); });
    const service = new SettingsService();
    service.updateSettings({ theme: "dark" });
    expect(service.getPersistenceStatus()).toBe("session-only");
    expect(service.getSetting("theme")).toBe("dark");
  });

  it("isolates initial and later failures, preserves order and unsubscribe even if logging throws", () => {
    const service = new SettingsService();
    const logger = vi.spyOn(console, "error").mockImplementation(() => { throw new Error("logger"); });
    const first = vi.fn(() => { throw new Error("first"); });
    const second = vi.fn(() => { throw new Error("second"); });
    const stopFirst = service.subscribe(first);
    const stopSecond = service.subscribe(second);
    const healthy = vi.fn();
    const stopHealthy = service.subscribe(healthy);
    expect(() => service.updateSettings({ theme: "dark" })).not.toThrow();
    expect(healthy.mock.lastCall?.[0].theme).toBe("dark");
    expect(first.mock.invocationCallOrder.at(-1)!).toBeLessThan(second.mock.invocationCallOrder.at(-1)!);
    expect(logger).toHaveBeenCalled();
    stopFirst(); stopSecond(); stopHealthy();
    service.updateSettings({ theme: "light" });
    expect(first).toHaveBeenCalledTimes(2);
    expect(healthy).toHaveBeenCalledTimes(2);
  });
});
