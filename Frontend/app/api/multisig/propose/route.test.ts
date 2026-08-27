import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { __resetMultisigStoreForTests } from "@/lib/multisigStore";

function jsonBody(body: unknown) {
  return new Request("http://localhost/api/multisig/propose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/multisig/propose", () => {
  afterEach(() => {
    __resetMultisigStoreForTests();
  });

  it("returns txId on happy path", async () => {
    const res = await POST(
      jsonBody({
        walletId: "MARKET_OPS",
        txData: { target: "0xTarget", value: "0", data: "0x" },
        proposer: "0xOwner1...",
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.txId).toMatch(/^tx_/);
  });

  it("returns 404 for unknown wallet", async () => {
    const res = await POST(
      jsonBody({
        walletId: "NONEXISTENT",
        txData: { target: "0x0" },
        proposer: "0xAddr",
      }),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("MULTISIG_ERROR");
  });

  it("returns 403 when proposer is not an owner", async () => {
    const res = await POST(
      jsonBody({
        walletId: "MARKET_OPS",
        txData: { target: "0x0" },
        proposer: "0xNotAnOwner...",
      }),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("rejects missing fields with clear validation error", async () => {
    const res = await POST(jsonBody({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects malformed JSON without throwing", async () => {
    const res = await POST(
      new Request("http://localhost/api/multisig/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects non-object txData", async () => {
    const res = await POST(
      jsonBody({
        walletId: "MARKET_OPS",
        txData: "not-an-object",
        proposer: "0xOwner1...",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });
});
