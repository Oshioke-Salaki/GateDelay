import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { uploadJSON, pinHash } from "@/lib/ipfsStore";

describe("GET /api/ipfs/gateway/[hash]", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_IPFS_GATEWAY", "");
  });

  function get(hash: string) {
    return GET(new Request(`http://localhost/api/ipfs/gateway/${hash}`), {
      params: Promise.resolve({ hash }),
    });
  }

  it("returns a public gateway URL and storage status for a known unpinned hash", async () => {
    const hash = await uploadJSON({ title: "gateway-smoke" });
    const res = await get(hash);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // #1188 — CIDv1: base32lower, starts with "b" (not the old pseudo-Qm)
    expect(body.data.url).toMatch(/^https:\/\/gateway\.pinata\.cloud\/ipfs\/b[a-z2-7]/);
    expect(body.data.url).not.toMatch(/localhost/);
    expect(body.data.stored).toBe(true);
    // #1190: not pinned yet (only pinned after explicit pinHash call)
    expect(body.data.pinned).toBe(false);
    expect(body.data.pinStatus).toBe("none");
  });

  it("returns pinned:true after provider confirms the pin", async () => {
    const hash = await uploadJSON({ title: "gateway-pinned" });
    await pinHash(hash, "gateway-test-pin");

    const res = await get(hash);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pinned).toBe(true);
    expect(body.data.pinStatus).toBe("pinned");
  });

  it("still resolves a gateway URL for an unknown hash without crashing", async () => {
    const hash = "QmUnknownHash12345678901234567890123456789012345678901234";
    const res = await get(hash);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.url).toContain(hash);
    expect(body.data.stored).toBe(false);
  });

  it("rejects a missing hash with VALIDATION_ERROR", async () => {
    const res = await get("");

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects a malformed hash with VALIDATION_ERROR", async () => {
    const res = await get("not a valid hash!");

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: "VALIDATION_ERROR",
    });
  });

  it("refuses a localhost gateway in the production path with CONFIG_ERROR", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_IPFS_GATEWAY", "http://localhost:8080/ipfs/");

    const res = await get("QmValidHash12345678901234567890123456789012345678901234");

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: "CONFIG_ERROR",
    });
  });

  it("surfaces an unexpected runtime fault as INTERNAL_ERROR instead of a blank screen", async () => {
    const ipfsStore = await import("@/lib/ipfsStore");
    const spy = vi
      .spyOn(ipfsStore, "getStorageStatus")
      .mockRejectedValue(new Error("unexpected storage failure"));

    const res = await get("QmValidHash12345678901234567890123456789012345678901234");

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: "INTERNAL_ERROR",
      error: "unexpected storage failure",
    });

    spy.mockRestore();
  });
});
