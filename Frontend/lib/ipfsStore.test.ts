/**
 * Tests for lib/ipfsStore.ts
 *
 * Covers:
 *  #1189 – Persistent adapter abstraction (dev mock, no accidental Map leak)
 *  #1190 – Provider-confirmed pin status lifecycle
 */
import { describe, expect, it } from "vitest";
import {
  uploadJSON,
  uploadFile,
  retrieve,
  pinHash,
  getGatewayUrl,
  getStorageStatus,
  getEntry,
} from "./ipfsStore";

// ---------------------------------------------------------------------------
// #1189 – Storage adapter basics
// ---------------------------------------------------------------------------

describe("#1189 – Storage adapter", () => {
  it("uploadJSON returns a Qm-prefixed hash", async () => {
    const hash = await uploadJSON({ foo: "bar" });
    expect(hash).toMatch(/^Qm/);
    expect(hash.length).toBeGreaterThan(10);
  });

  it("stored entry can be retrieved by hash", async () => {
    const hash = await uploadJSON({ value: 42 }, { name: "test-doc" });
    const result = await retrieve(hash);
    expect(result).toEqual({ value: 42 });
  });

  it("retrieve throws for an unknown hash (never reports success on failure)", async () => {
    await expect(
      retrieve("QmUnknownHashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    ).rejects.toThrow(/not found/i);
  });

  it("uploadFile stores content and is retrievable", async () => {
    const hash = await uploadFile("hello ipfs", "hello.txt");
    expect(hash).toMatch(/^Qm/);
    const entry = await getEntry(hash);
    expect(entry).toBeDefined();
    expect((entry!.data as { fileName: string }).fileName).toBe("hello.txt");
  });

  it("metadata name is persisted alongside the data", async () => {
    const hash = await uploadJSON({ x: 1 }, { name: "named-doc" });
    const entry = await getEntry(hash);
    expect(entry?.metadata.name).toBe("named-doc");
    expect(entry?.metadata.uploadedAt).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// #1190 – Pin status lifecycle
// ---------------------------------------------------------------------------

describe("#1190 – Provider-confirmed pin status", () => {
  it("initial pinStatus after uploadJSON is 'none' (not pinned)", async () => {
    const hash = await uploadJSON({ status: "fresh" });
    const status = await getStorageStatus(hash);
    expect(status.pinStatus).toBe("none");
    expect(status.pinned).toBe(false);
  });

  it("pinHash transitions status to 'pinned' on provider confirmation", async () => {
    const hash = await uploadJSON({ ready: true });
    const confirmed = await pinHash(hash, "my-pin");
    expect(confirmed).toBe(true);

    const status = await getStorageStatus(hash);
    expect(status.pinStatus).toBe("pinned");
    expect(status.pinned).toBe(true);
  });

  it("pinHash throws for an unknown hash (never silently succeeds)", async () => {
    await expect(
      pinHash("QmUnknownHashYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY")
    ).rejects.toThrow(/not found/i);
  });

  it("pinHash works without a name", async () => {
    const hash = await uploadJSON({ nameless: true });
    const confirmed = await pinHash(hash);
    expect(confirmed).toBe(true);
    const status = await getStorageStatus(hash);
    expect(status.pinned).toBe(true);
  });

  it("getStorageStatus.stored is false for an unknown hash", async () => {
    const status = await getStorageStatus(
      "QmNotHereZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ"
    );
    expect(status.stored).toBe(false);
    expect(status.pinned).toBe(false);
    expect(status.pinStatus).toBe("none");
  });

  it("getStorageStatus.stored is true after upload", async () => {
    const hash = await uploadJSON({ stored: true });
    const status = await getStorageStatus(hash);
    expect(status.stored).toBe(true);
  });

  it("gateway URL is included in storage status", async () => {
    const hash = await uploadJSON({ withUrl: true });
    const status = await getStorageStatus(hash);
    expect(status.gatewayUrl).toMatch(/^https:\/\/gateway\.pinata\.cloud\/ipfs\//);
    expect(status.gatewayUrl).toContain(hash);
  });
});

// ---------------------------------------------------------------------------
// getGatewayUrl
// ---------------------------------------------------------------------------

describe("getGatewayUrl", () => {
  it("returns a pinata gateway URL for a valid hash", () => {
    const url = getGatewayUrl("Qmabc123");
    expect(url).toMatch(/^https:\/\/gateway\.pinata\.cloud\/ipfs\/QmaBC123/i);
  });

  it("throws for an empty hash", () => {
    expect(() => getGatewayUrl("")).toThrow();
  });
});
