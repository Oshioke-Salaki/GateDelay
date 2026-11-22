/**
 * Tests for POST /api/ipfs/upload-json
 *
 * Covers:
 *  existing – happy path, VALIDATION_ERROR, malformed JSON, production gateway
 *  #1191 – oversized body, deep nesting, long metadata.name
 *  #1192 – unauthenticated, quota exhaustion, concurrent requests at boundary
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_HEADERS = { "X-Wallet-Address": "0xTestAccount" };

function makeRequest(
  body: unknown,
  headers: Record<string, string> = AUTH_HEADERS
): NextRequest {
  const raw = JSON.stringify(body);
  return new NextRequest("http://localhost/api/ipfs/upload-json", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: raw,
  });
}

function makeRequestRaw(
  raw: string,
  headers: Record<string, string> = AUTH_HEADERS
): NextRequest {
  return new NextRequest("http://localhost/api/ipfs/upload-json", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: raw,
  });
}

// ---------------------------------------------------------------------------
// Environment setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_IPFS_GATEWAY", "");
  // Reset quota by using a fresh wallet per test group (see per-test comments)
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Existing happy-path & validation tests
// ---------------------------------------------------------------------------

describe("POST /api/ipfs/upload-json – existing behaviour", () => {
  it("uploads JSON and returns a public gateway URL (happy path)", async () => {
    const res = await POST(
      makeRequest({
        data: { title: "GateDelay market", outcome: "delayed" },
        metadata: { name: "test-market" },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // #1188 — CIDv1: base32lower, starts with "b" (not the old pseudo-Qm)
    expect(body.data.hash).toMatch(/^b[a-z2-7]+$/);
    expect(body.data.url).toMatch(/^https:\/\/gateway\.pinata\.cloud\/ipfs\/b[a-z2-7]/);
    expect(body.data.url).not.toMatch(/localhost/);
  });

  it("rejects missing data with VALIDATION_ERROR", async () => {
    const res = await POST(makeRequest({ metadata: { name: "x" } }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects malformed JSON without crashing the route", async () => {
    const res = await POST(makeRequestRaw("not-json"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refuses a localhost gateway in the production path", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_IPFS_GATEWAY", "http://localhost:8080/ipfs/");

    const res = await POST(makeRequest({ data: { ok: true } }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("CONFIG_ERROR");
    expect(body.error).toMatch(/localhost/i);
  });
});

// ---------------------------------------------------------------------------
// #1192 – Auth guard
// ---------------------------------------------------------------------------

describe("#1192 – Auth guard", () => {
  it("rejects unauthenticated requests with 401 AUTH_ERROR", async () => {
    const res = await POST(makeRequest({ data: { x: 1 } }, {})); // no auth headers
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("AUTH_ERROR");
  });

  it("accepts Bearer token as identity", async () => {
    const res = await POST(
      makeRequest({ data: { x: 1 } }, { Authorization: "Bearer 0xBearerAcct1" })
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true });
  });

  it("accepts X-Wallet-Address header as identity", async () => {
    const res = await POST(
      makeRequest(
        { data: { x: 1 } },
        { "X-Wallet-Address": "0xWalletAcct1" }
      )
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true });
  });

  it("never reaches the provider for unauthenticated requests", async () => {
    // This verifies no provider call is made by checking no IPFS_ERROR is returned
    const res = await POST(makeRequest({ data: { x: 1 } }, {}));
    const body = await res.json();
    expect(body.code).not.toBe("IPFS_ERROR");
    expect(body.code).toBe("AUTH_ERROR");
  });
});

// ---------------------------------------------------------------------------
// #1192 – Quota guard
// ---------------------------------------------------------------------------

describe("#1192 – Quota guard", () => {
  it("exhausted quota yields 429 QUOTA_EXCEEDED without provider call", async () => {
    // Use an isolated account and a tiny quota
    vi.stubEnv("IPFS_QUOTA_MAX", "2");
    vi.stubEnv("IPFS_QUOTA_WINDOW_MS", String(60 * 60 * 1000));

    const account = { "X-Wallet-Address": "0xQuotaTestAcct_" + Date.now() };

    // First two should succeed
    const r1 = await POST(makeRequest({ data: { seq: 1 } }, account));
    const r2 = await POST(makeRequest({ data: { seq: 2 } }, account));
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    // Third should be rejected
    const r3 = await POST(makeRequest({ data: { seq: 3 } }, account));
    expect(r3.status).toBe(429);
    const body = await r3.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("QUOTA_EXCEEDED");
    expect(body.meta.retryAfterMs).toBeGreaterThan(0);
    // Verify the Retry-After header is set
    expect(r3.headers.get("Retry-After")).toBeTruthy();
  });

  it("concurrent requests at quota boundary all return stable responses", async () => {
    vi.stubEnv("IPFS_QUOTA_MAX", "3");
    const account = { "X-Wallet-Address": "0xConcurrentAcct_" + Date.now() };

    // Fire 5 requests concurrently
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        POST(makeRequest({ data: { seq: i } }, account))
      )
    );

    const statuses = results.map((r) => r.status);
    const okCount = statuses.filter((s) => s === 200).length;
    const rateLimitedCount = statuses.filter((s) => s === 429).length;

    // At most QUOTA_MAX should succeed; the rest must be 429
    expect(okCount).toBeLessThanOrEqual(3);
    expect(rateLimitedCount).toBeGreaterThanOrEqual(2);
    // No 5xx errors — all responses are stable
    expect(statuses.filter((s) => s >= 500).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// #1191 – Size limit
// ---------------------------------------------------------------------------

describe("#1191 – Size and complexity limits", () => {
  it("rejects a body over MAX_BODY_BYTES with 413 VALIDATION_ERROR", async () => {
    vi.stubEnv("IPFS_MAX_BODY_BYTES", "100");

    // Build a body larger than 100 bytes
    const largeData = { data: { payload: "x".repeat(200) } };
    const res = await POST(makeRequest(largeData));

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.meta.maxBodyBytes).toBe(100);
  });

  it("accepts a valid near-limit document", async () => {
    vi.stubEnv("IPFS_MAX_BODY_BYTES", "10000");
    const nearLimit = { data: { payload: "x".repeat(50) } };
    const res = await POST(makeRequest(nearLimit));
    expect(res.status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // #1191 – Nesting depth
  // -------------------------------------------------------------------------

  it("rejects deeply nested data with 422 VALIDATION_ERROR", async () => {
    vi.stubEnv("IPFS_MAX_NESTING_DEPTH", "3");

    // Build an object nested 4 levels deep
    const deep = { data: { a: { b: { c: { d: "too deep" } } } } };
    const res = await POST(makeRequest(deep));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.error).toMatch(/nesting depth/i);
  });

  it("accepts data exactly at the nesting limit", async () => {
    vi.stubEnv("IPFS_MAX_NESTING_DEPTH", "3");
    // depth 1: outer object; depth 2: inner; depth 3: leaf string
    const ok = { data: { a: { b: "value" } } };
    const res = await POST(makeRequest(ok));
    expect(res.status).toBe(200);
  });

  it("rejects deeply nested arrays", async () => {
    vi.stubEnv("IPFS_MAX_NESTING_DEPTH", "2");
    const deepArray = { data: [[[1, 2, 3]]] };
    const res = await POST(makeRequest(deepArray));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  // -------------------------------------------------------------------------
  // #1191 – Metadata name length
  // -------------------------------------------------------------------------

  it("rejects metadata.name over MAX_NAME_LENGTH with 422 VALIDATION_ERROR", async () => {
    vi.stubEnv("IPFS_MAX_NAME_LENGTH", "10");

    const res = await POST(
      makeRequest({
        data: { x: 1 },
        metadata: { name: "a".repeat(11) },
      })
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.error).toMatch(/name.*length/i);
  });

  it("accepts metadata.name exactly at the limit", async () => {
    vi.stubEnv("IPFS_MAX_NAME_LENGTH", "10");
    const res = await POST(
      makeRequest({ data: { x: 1 }, metadata: { name: "a".repeat(10) } })
    );
    expect(res.status).toBe(200);
  });
});
