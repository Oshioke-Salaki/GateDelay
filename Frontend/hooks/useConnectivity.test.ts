import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectivity } from "./useConnectivity";
import { NETWORK_FAILURE_THRESHOLD } from "../lib/connectivity";

describe("useConnectivity", () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, statusText: "OK" })),
    );
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalOnLine) {
      Object.defineProperty(navigator, "onLine", originalOnLine);
    }
  });

  it("starts without an offline banner state when the browser is online", async () => {
    const { result } = renderHook(() => useConnectivity());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isOffline).toBe(false);
    expect(result.current.isReconnecting).toBe(false);
    expect(result.current.unreachableReason).toBeNull();
  });

  it("marks the session offline when the browser fires an offline event", async () => {
    const { result } = renderHook(() => useConnectivity());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => false,
      });
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current.isOffline).toBe(true);
    expect(result.current.unreachableReason).toBe("browser");
    expect(result.current.isReconnecting).toBe(false);
  });

  it("returns to online after a browser online event when the probe succeeds", async () => {
    const { result } = renderHook(() => useConnectivity());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => false,
      });
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current.isOffline).toBe(true);

    await act(async () => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => true,
      });
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });

    expect(result.current.isOffline).toBe(false);
    expect(result.current.unreachableReason).toBeNull();
  });

  it("collapses repeated failed requests into a single unreachable state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return { ok: false, status: 502, statusText: "Bad Gateway" };
      }),
    );

    const { result } = renderHook(() => useConnectivity());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      for (let i = 0; i < NETWORK_FAILURE_THRESHOLD + 3; i += 1) {
        await fetch("/api/market-audit");
      }
    });

    expect(result.current.isOffline).toBe(true);
    expect(result.current.unreachableReason).toBe("backend");
    expect(result.current.isReconnecting).toBe(true);
    expect(result.current.reconnectProgress).toBeGreaterThan(0);
  });

  it("does not treat a successful non-probe request as restored while the probe fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/ping")) {
          throw new TypeError("Failed to fetch");
        }
        return { ok: true, status: 200, statusText: "OK" };
      }),
    );

    const { result } = renderHook(() => useConnectivity());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      result.current.reportRequestFailure();
      result.current.reportRequestFailure();
      await fetch("/api/trending-markets");
      await Promise.resolve();
    });

    expect(result.current.isOffline).toBe(true);
    expect(result.current.unreachableReason).toBe("backend");
  });
});
