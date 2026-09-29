import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/market-sentiment", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://backend.test/api");
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 400 when marketId is missing", async () => {
    const res = await GET(new Request("http://localhost/api/market-sentiment"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("proxies a successful sentiment payload", async () => {
    const payload = {
      marketId: "m1",
      signal: { direction: "bullish", confidence: 80, rationale: "up" },
      generatedAt: "2026-08-25T00:00:00.000Z",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => payload,
      }),
    );

    const res = await GET(
      new Request("http://localhost/api/market-sentiment?marketId=m1"),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(
      "https://backend.test/api/ai/sentiment/m1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("surfaces a clear 502 when the backend is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")),
    );

    const res = await GET(
      new Request("http://localhost/api/market-sentiment?marketId=m1"),
    );
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({
      code: "BACKEND_UNREACHABLE",
      marketId: "m1",
    });
  });

  it("refuses to guess localhost in production when API URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    const res = await GET(
      new Request("http://localhost/api/market-sentiment?marketId=m1"),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("CONFIG_ERROR");
    expect(body.error).toMatch(/NEXT_PUBLIC_API_URL/);
  });
});
