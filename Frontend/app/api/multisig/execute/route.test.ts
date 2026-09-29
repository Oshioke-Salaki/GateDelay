import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import {
  __resetMultisigStoreForTests,
  collectSignature,
  proposeTransaction,
} from "@/lib/multisigStore";

describe("POST /api/multisig/execute", () => {
  afterEach(() => {
    __resetMultisigStoreForTests();
  });

  it("maps MultiSigWallet TransactionExecuted into the UI-facing response", async () => {
    const txId = await proposeTransaction(
      "MARKET_OPS",
      { target: "0xTarget", value: "0", data: "0x" },
      "0xOwner1...",
    );
    await collectSignature(txId, "0xOwner1...", "0xsig1");
    await collectSignature(txId, "0xOwner2...", "0xsig2");

    const res = await POST(
      new Request("http://localhost/api/multisig/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txId, executor: "0xOwner1..." }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("Executed");
    expect(body.data.txHash).toBeUndefined();
    expect(body.event).toEqual({
      name: "TransactionExecuted",
      args: { txId, executor: "0xOwner1..." },
    });
    expect(body.data.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "TransactionCreated" }),
        expect.objectContaining({ name: "TransactionApproved" }),
        {
          name: "TransactionExecuted",
          args: { txId, executor: "0xOwner1..." },
        },
      ]),
    );
  });

  it("rejects missing txId with a clear validation error", async () => {
    const res = await POST(
      new Request("http://localhost/api/multisig/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects malformed JSON without throwing", async () => {
    const res = await POST(
      new Request("http://localhost/api/multisig/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
