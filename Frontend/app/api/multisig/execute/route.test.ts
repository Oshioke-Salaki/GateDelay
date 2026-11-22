/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import {
  __resetMultisigStoreForTests,
  __setMultisigWalletsForTests,
  collectSignature,
  proposeTransaction,
  buildTransactionDigest,
  getTransactionStatus,
  type MultisigWallet,
} from "@/lib/multisigStore";
import { ethers } from "ethers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Known test wallet that uses valid full-length addresses. */
const OWNER_KEY_1 = ethers.Wallet.createRandom();
const OWNER_KEY_2 = ethers.Wallet.createRandom();
const OWNER_KEY_3 = ethers.Wallet.createRandom();

const TEST_WALLET: MultisigWallet = {
  address: "0x0000000000000000000000000000000000000099",
  owners: [
    OWNER_KEY_1.address,
    OWNER_KEY_2.address,
    OWNER_KEY_3.address,
  ],
  threshold: 2,
  scheme: "ECDSA",
};

/** Build an authenticated request where the actor signs the route proof. */
async function makeAuthRequest(
  body: unknown,
  signer: ethers.Wallet | ethers.HDNodeWallet,
  simulate = true,
): Promise<Request> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Multisig-Address": signer.address,
  };

  if (!simulate) {
    const { buildAuthProofMessage } = await import("@/lib/multisigAuth");
    const message = buildAuthProofMessage("execute", signer.address);
    const sig = await signer.signMessage(message);
    headers["X-Multisig-Signature"] = sig;
  }

  return new Request("http://localhost/api/multisig/execute", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/** Sign the canonical transaction digest and return the EIP-191 signature. */
async function signTx(
  txId: string,
  signer: ethers.Wallet | ethers.HDNodeWallet,
): Promise<string> {
  const tx = await getTransactionStatus(txId);
  const digest = buildTransactionDigest(tx);
  return signer.signMessage(ethers.getBytes(digest));
}

const VALID_TX_HASH = "0x" + "ab".repeat(32);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/multisig/execute", () => {
  afterEach(() => {
    __resetMultisigStoreForTests();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    __setMultisigWalletsForTests({ TEST_WALLET: TEST_WALLET });
    vi.stubEnv("NEXT_PUBLIC_MULTISIG_SIMULATE", "true");
  });

  // -------------------------------------------------------------------------
  // #1196 – Simulation path (dev only)
  // -------------------------------------------------------------------------
  it("simulation: maps TransactionExecuted event into the UI-facing response", async () => {
    const txId = await proposeTransaction(
      "TEST_WALLET",
      { target: "0x0000000000000000000000000000000000000099", value: "0", data: "0x" },
      OWNER_KEY_1.address,
    );
    const sig1 = await signTx(txId, OWNER_KEY_1);
    const sig2 = await signTx(txId, OWNER_KEY_2);
    await collectSignature(txId, OWNER_KEY_1.address, sig1);
    await collectSignature(txId, OWNER_KEY_2.address, sig2);

    const res = await POST(await makeAuthRequest({ txId }, OWNER_KEY_1));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("Executed");
    expect(body.data.txHash).toBeUndefined();
    expect(body.event).toEqual({
      name: "TransactionExecuted",
      args: { txId, executor: OWNER_KEY_1.address },
    });
  });

  // -------------------------------------------------------------------------
  // #1196 – Production path with a real receipt
  // -------------------------------------------------------------------------
  it("production: advances to Confirmed state with a confirmed receipt", async () => {
    vi.stubEnv("NEXT_PUBLIC_MULTISIG_SIMULATE", "false");

    const txId = await proposeTransaction(
      "TEST_WALLET",
      { target: "0x0000000000000000000000000000000000000099", value: "0", data: "0x" },
      OWNER_KEY_1.address,
    );
    const sig1 = await signTx(txId, OWNER_KEY_1);
    const sig2 = await signTx(txId, OWNER_KEY_2);
    await collectSignature(txId, OWNER_KEY_1.address, sig1);
    await collectSignature(txId, OWNER_KEY_2.address, sig2);

    const receipt = {
      txHash: VALID_TX_HASH,
      blockNumber: 42,
      status: "confirmed",
    };

    const res = await POST(
      await makeAuthRequest({ txId, receipt }, OWNER_KEY_1, false),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("Confirmed");
    expect(body.data.txHash).toBe(VALID_TX_HASH);
    expect(body.data.blockNumber).toBe(42);
    expect(body.event).toMatchObject({ name: "TransactionExecuted" });
  });

  it("production: advances to Failed state with a failed receipt", async () => {
    vi.stubEnv("NEXT_PUBLIC_MULTISIG_SIMULATE", "false");

    const txId = await proposeTransaction(
      "TEST_WALLET",
      { target: "0x0000000000000000000000000000000000000099", value: "0", data: "0x" },
      OWNER_KEY_1.address,
    );
    const sig1 = await signTx(txId, OWNER_KEY_1);
    const sig2 = await signTx(txId, OWNER_KEY_2);
    await collectSignature(txId, OWNER_KEY_1.address, sig1);
    await collectSignature(txId, OWNER_KEY_2.address, sig2);

    const receipt = { txHash: VALID_TX_HASH, status: "failed" };

    const res = await POST(
      await makeAuthRequest({ txId, receipt }, OWNER_KEY_1, false),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("Failed");
    expect(body.event).toMatchObject({ name: "TransactionRejected" });
  });

  it("production: rejects missing receipt when simulation is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_MULTISIG_SIMULATE", "false");

    const txId = await proposeTransaction(
      "TEST_WALLET",
      { target: "0x0000000000000000000000000000000000000099", value: "0", data: "0x" },
      OWNER_KEY_1.address,
    );
    const sig1 = await signTx(txId, OWNER_KEY_1);
    const sig2 = await signTx(txId, OWNER_KEY_2);
    await collectSignature(txId, OWNER_KEY_1.address, sig1);
    await collectSignature(txId, OWNER_KEY_2.address, sig2);

    const res = await POST(
      await makeAuthRequest({ txId }, OWNER_KEY_1, false),
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/broadcast receipt is required/);
  });

  // -------------------------------------------------------------------------
  // #1195 – Auth binding
  // -------------------------------------------------------------------------
  it("rejects requests with no authentication headers", async () => {
    const res = await POST(
      new Request("http://localhost/api/multisig/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txId: "tx_fake" }),
      }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("AUTH_ERROR");
  });

  it("rejects an executor address that is not in the owners list", async () => {
    const nonOwner = ethers.Wallet.createRandom();

    const txId = await proposeTransaction(
      "TEST_WALLET",
      { target: "0x0000000000000000000000000000000000000099", value: "0", data: "0x" },
      OWNER_KEY_1.address,
    );
    const sig1 = await signTx(txId, OWNER_KEY_1);
    const sig2 = await signTx(txId, OWNER_KEY_2);
    await collectSignature(txId, OWNER_KEY_1.address, sig1);
    await collectSignature(txId, OWNER_KEY_2.address, sig2);

    const res = await POST(await makeAuthRequest({ txId }, nonOwner));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not an owner/);
  });

  // -------------------------------------------------------------------------
  // Basic validation
  // -------------------------------------------------------------------------
  it("rejects missing txId with a clear validation error", async () => {
    const res = await POST(await makeAuthRequest({}, OWNER_KEY_1));
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
        headers: {
          "Content-Type": "application/json",
          "X-Multisig-Address": OWNER_KEY_1.address,
        },
        body: "{not-json",
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects a receipt with an invalid txHash format", async () => {
    const txId = await proposeTransaction(
      "TEST_WALLET",
      { target: "0x0000000000000000000000000000000000000099", value: "0", data: "0x" },
      OWNER_KEY_1.address,
    );
    const res = await POST(
      await makeAuthRequest(
        { txId, receipt: { txHash: "not-a-hash", status: "confirmed" } },
        OWNER_KEY_1,
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });
});
