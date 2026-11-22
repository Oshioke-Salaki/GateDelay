import { describe, expect, it } from "vitest";
import {
  CONNECTIVITY_PROBE_URL,
  isConnectivityProbeUrl,
  isNetworkFailureError,
  isNetworkFailureStatus,
  reconnectProgressPercent,
  requestUrl,
} from "./connectivity";

describe("connectivity helpers", () => {
  it("identifies the dedicated health probe URL", () => {
    expect(isConnectivityProbeUrl(`${CONNECTIVITY_PROBE_URL}?_nc=1`)).toBe(true);
    expect(isConnectivityProbeUrl("/api/market-audit")).toBe(false);
  });

  it("treats gateway failures as connectivity problems, not 4xx", () => {
    expect(isNetworkFailureStatus(502)).toBe(true);
    expect(isNetworkFailureStatus(503)).toBe(true);
    expect(isNetworkFailureStatus(504)).toBe(true);
    expect(isNetworkFailureStatus(404)).toBe(false);
    expect(isNetworkFailureStatus(401)).toBe(false);
  });

  it("recognises browser network errors", () => {
    expect(isNetworkFailureError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkFailureError(new Error("getaddrinfo ENOTFOUND"))).toBe(true);
    expect(isNetworkFailureError(new Error("validation failed"))).toBe(false);
  });

  it("never reports reconnect progress as complete before a successful probe", () => {
    expect(reconnectProgressPercent(0)).toBe(0);
    expect(reconnectProgressPercent(1)).toBeGreaterThan(0);
    expect(reconnectProgressPercent(99)).toBeLessThan(100);
  });

  it("extracts a URL from fetch inputs", () => {
    expect(requestUrl("/api/ping")).toBe("/api/ping");
    expect(requestUrl(new URL("https://example.test/api/ping"))).toContain("/api/ping");
  });
});
