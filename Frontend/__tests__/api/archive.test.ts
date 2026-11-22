import { describe, it, expect } from "vitest";
import { GET } from "../../app/api/archive/route";
import { NextRequest } from "next/server";

describe("GET /api/archive API Route", () => {
  it("returns archived markets list with status 200", async () => {
    const request = new NextRequest("http://localhost:3000/api/archive");
    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("markets");
    expect(Array.isArray(data.markets)).toBe(true);
    expect(data.markets.length).toBeGreaterThan(0);

    const firstMarket = data.markets[0];
    expect(firstMarket).toHaveProperty("id");
    expect(firstMarket).toHaveProperty("title");
    expect(firstMarket).toHaveProperty("resolvedOutcome");
    expect(firstMarket).toHaveProperty("volume");
  });

  it("returns error 500 when fail parameter is true", async () => {
    const request = new NextRequest("http://localhost:3000/api/archive?fail=true");
    const response = await GET(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data).toHaveProperty("error", "Failed to fetch archive data from server");
  });
});
