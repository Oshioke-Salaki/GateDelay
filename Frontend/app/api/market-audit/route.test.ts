import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/market-audit", () => {
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

  it("forwards filters to the NestJS market-audit logs endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: "1" }],
      }),
    );

    const res = await GET(
      new Request(
        "http://localhost/api/market-audit?marketId=m1&limit=50&operation=trade",
      ),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: "1" }]);

    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(calledUrl).toContain("https://backend.test/api/market-audit/logs?");
    expect(calledUrl).toContain("marketId=m1");
    expect(calledUrl).toContain("limit=50");
    expect(calledUrl).toContain("operation=trade");
  });

  it("does not hard-code localhost in the production path", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    const res = await GET(new Request("http://localhost/api/market-audit?limit=10"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("CONFIG_ERROR");
    expect(JSON.stringify(body)).not.toMatch(/localhost:3000/);
  });

  it("returns 502 with an actionable error when upstream is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND")),
    );

    const res = await GET(new Request("http://localhost/api/market-audit"));
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({
      code: "BACKEND_UNREACHABLE",
    });
  });
});
