import { describe, it, expect } from "vitest";
import { GET, HEAD } from "./route";

describe("GET /api/ping", () => {
  it("returns 200", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("returns ok:true and a numeric ts", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.ts).toBe("number");
    expect(body.ts).toBeGreaterThan(0);
  });

  it("ts is a recent unix timestamp (within the last minute)", async () => {
    const before = Date.now();
    const res = await GET();
    const after = Date.now();
    const { ts } = await res.json();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 5); // 5 ms tolerance
  });

  it("sets Cache-Control: no-store", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/);
  });

  it("sets Pragma: no-cache", async () => {
    const res = await GET();
    expect(res.headers.get("Pragma")).toBe("no-cache");
  });
});

describe("HEAD /api/ping", () => {
  it("returns 200 with no body", async () => {
    const res = await HEAD();
    expect(res.status).toBe(200);
    // HEAD responses have no body — body should be null/empty
    const text = await res.text();
    expect(text).toBe("");
  });

  it("sets Cache-Control: no-store", async () => {
    const res = await HEAD();
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/);
  });
});
