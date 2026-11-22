import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/trending-markets", () => {
  it("returns 200 with a markets array", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("markets");
    expect(Array.isArray(body.markets)).toBe(true);
  });

  it("returns at least one market", async () => {
    const res = await GET();
    const { markets } = await res.json();
    expect(markets.length).toBeGreaterThan(0);
  });

  it("each market has the required shape", async () => {
    const res = await GET();
    const { markets } = await res.json();
    for (const market of markets) {
      expect(market).toHaveProperty("id");
      expect(market).toHaveProperty("title");
      expect(market).toHaveProperty("yesPrice");
      expect(market).toHaveProperty("noPrice");
      expect(market).toHaveProperty("volume");
      expect(market).toHaveProperty("status");
    }
  });

  it("yesPrice and noPrice are between 0 and 1", async () => {
    const res = await GET();
    const { markets } = await res.json();
    for (const market of markets) {
      expect(market.yesPrice).toBeGreaterThanOrEqual(0);
      expect(market.yesPrice).toBeLessThanOrEqual(1);
      expect(market.noPrice).toBeGreaterThanOrEqual(0);
      expect(market.noPrice).toBeLessThanOrEqual(1);
    }
  });

  it("responds with the correct content-type header", async () => {
    const res = await GET();
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });
});
