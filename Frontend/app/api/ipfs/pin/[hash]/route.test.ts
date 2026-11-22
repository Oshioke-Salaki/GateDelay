/**
 * Tests for POST /api/ipfs/pin/[hash]
 *
 * Covers:
 *  existing – happy path, VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR
 *  #1190 – provider-confirmed pinStatus in response; no false 'pinned' state
 */
import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { uploadJSON } from "@/lib/ipfsStore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pin(hash: string, body?: unknown, rawBody?: string) {
  const init: RequestInit = { method: "POST" };
  if (rawBody !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = rawBody;
  } else if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return POST(new Request(`http://localhost/api/ipfs/pin/${hash}`, init), {
    params: Promise.resolve({ hash }),
  });
}

// ---------------------------------------------------------------------------
// Existing behaviour
// ---------------------------------------------------------------------------

describe("POST /api/ipfs/pin/[hash] – existing behaviour", () => {
  it("pins an uploaded hash and returns success (happy path)", async () => {
    const hash = await uploadJSON(
      { title: "GateDelay pin smoke" },
      { name: "pin-smoke" }
    );

    const res = await pin(hash, { name: "GateDelay-Market-Pin" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain(hash);
    expect(body.data).toMatchObject({ hash, pinned: true });
  });

  it("pins without a body because name is optional", async () => {
    const hash = await uploadJSON({ title: "optional-name" });
    const res = await pin(hash);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      data: { hash, pinned: true },
    });
  });

  it("rejects a missing hash with VALIDATION_ERROR", async () => {
    const res = await pin("");
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects a malformed hash with VALIDATION_ERROR", async () => {
    const res = await pin("not a valid hash!");
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects invalid JSON with VALIDATION_ERROR instead of pinning silently", async () => {
    const hash = await uploadJSON({ title: "bad-json" });
    const res = await pin(hash, undefined, "not-json");

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: "VALIDATION_ERROR",
      error: "Request body must be valid JSON when provided",
    });
  });

  it("rejects a non-string pin name with VALIDATION_ERROR", async () => {
    const hash = await uploadJSON({ title: "bad-name" });
    const res = await pin(hash, { name: 42 });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: "VALIDATION_ERROR",
    });
  });

  it("returns NOT_FOUND with an actionable message for an unknown hash", async () => {
    const hash = "QmUnknownHash12345678901234567890123456789012345678901234";
    const res = await pin(hash, { name: "missing" });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, code: "NOT_FOUND" });
    expect(body.error).toMatch(/upload-json/i);
  });

  it("surfaces an unexpected runtime fault as INTERNAL_ERROR instead of a blank screen", async () => {
    const hash = await uploadJSON({ title: "fault" });
    const ipfsStore = await import("@/lib/ipfsStore");
    const spy = vi.spyOn(ipfsStore, "pinHash").mockRejectedValue(
      new Error("unexpected pin failure")
    );

    const res = await pin(hash, { name: "fault" });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: "INTERNAL_ERROR",
      error: "unexpected pin failure",
    });

    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// #1190 – Provider-confirmed pin status
// ---------------------------------------------------------------------------

describe("#1190 – Provider-confirmed pin status in pin route", () => {
  it("response includes pinStatus: 'pinned' on success", async () => {
    const hash = await uploadJSON({ lifecycle: "confirmed" });
    const res = await pin(hash, { name: "confirm-test" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pinStatus).toBe("pinned");
    expect(body.data.pinned).toBe(true);
  });

  it("provider failure yields 502 PIN_FAILED with status details", async () => {
    const hash = await uploadJSON({ lifecycle: "fail" });
    const ipfsStore = await import("@/lib/ipfsStore");

    // Simulate a provider rejection (pinHash returns false, not throws)
    const spy = vi.spyOn(ipfsStore, "pinHash").mockResolvedValue(false);

    const res = await pin(hash, { name: "will-fail" });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("PIN_FAILED");
    expect(body.data.pinned).toBe(false);

    spy.mockRestore();
  });

  it("pinned is false when upload is fresh (before any pinHash call)", async () => {
    const hash = await uploadJSON({ notYetPinned: true });
    const ipfsStore = await import("@/lib/ipfsStore");
    const status = await ipfsStore.getStorageStatus(hash);
    expect(status.pinned).toBe(false);
    expect(status.pinStatus).toBe("none");
  });

  it("pinned transitions to true only after provider confirms", async () => {
    const hash = await uploadJSON({ willBeConfirmed: true });

    // Before pinning
    const ipfsStore = await import("@/lib/ipfsStore");
    let status = await ipfsStore.getStorageStatus(hash);
    expect(status.pinned).toBe(false);

    // After pinning
    await pin(hash);
    status = await ipfsStore.getStorageStatus(hash);
    expect(status.pinned).toBe(true);
    expect(status.pinStatus).toBe("pinned");
  });
});
