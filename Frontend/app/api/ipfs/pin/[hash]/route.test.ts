import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { uploadJSON } from "@/lib/ipfsStore";

describe("POST /api/ipfs/pin/[hash]", () => {
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

  it("pins an uploaded hash and returns success (happy path)", async () => {
    const hash = await uploadJSON(
      { title: "GateDelay pin smoke" },
      { name: "pin-smoke" },
    );

    const res = await pin(hash, { name: "GateDelay-Market-Pin" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain(hash);
    expect(body.data).toEqual({ hash, pinned: true });
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
    expect(body).toMatchObject({
      success: false,
      code: "NOT_FOUND",
    });
    expect(body.error).toMatch(/upload-json/i);
  });

  it("surfaces an unexpected runtime fault as INTERNAL_ERROR instead of a blank screen", async () => {
    const hash = await uploadJSON({ title: "fault" });
    const ipfsStore = await import("@/lib/ipfsStore");
    const spy = vi.spyOn(ipfsStore, "pinHash").mockRejectedValue(
      new Error("unexpected pin failure"),
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
