/**
 * @vitest-environment node
 *
 * multisigStore.test.ts
 *
 * Covers all four issue acceptance criteria:
 *
 *  #1193 – loadMultisigWalletsFromDeployment / buildWalletRegistry
 *  #1194 – collectSignature cryptographic verification
 *  #1195 – indirectly via auth layer; store-level: actor is checked against owners
 *  #1196 – processTransaction lifecycle states
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ethers } from "ethers";
import {
  __resetMultisigStoreForTests,
  __setMultisigWalletsForTests,
  buildTransactionDigest,
  collectSignature,
  getTransactionStatus,
  getWallet,
  listWallets,
  loadMultisigWalletsFromDeployment,
  processTransaction,
  proposeTransaction,
  verifyOwnerSignature,
  type BroadcastReceipt,
  type MultisigWallet,
} from "./multisigStore";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const KEY_1 = ethers.Wallet.createRandom();
const KEY_2 = ethers.Wallet.createRandom();
const KEY_3 = ethers.Wallet.createRandom();

const TEST_WALLET: MultisigWallet = {
  address: "0x0000000000000000000000000000000000000099",
  owners: [KEY_1.address, KEY_2.address, KEY_3.address],
  threshold: 2,
  scheme: "ECDSA",
};

const VALID_REGISTRY = JSON.stringify({
  contracts: [
    {
      name: "MultiSigMarketOps",
      address: "0x0000000000000000000000000000000000000001",
      chainId: 1,
      abiVersion: "1.0.0",
      multisigId: "MARKET_OPS",
      owners: [KEY_1.address, KEY_2.address, KEY_3.address],
      threshold: 2,
      scheme: "ECDSA",
    },
    {
      name: "MultiSigTreasury",
      address: "0x0000000000000000000000000000000000000002",
      chainId: 1,
      abiVersion: "1.0.0",
      multisigId: "TREASURY",
      owners: [KEY_1.address, KEY_2.address, KEY_3.address],
      threshold: 3,
      scheme: "ECDSA",
    },
    // Non-multisig entry — should be silently skipped
    {
      name: "MarketBridge",
      address: "0x0000000000000000000000000000000000000003",
      chainId: 1,
      abiVersion: "1.0.0",
    },
  ],
});

const VALID_TX_HASH = "0x" + "ab".repeat(32);

async function signDigest(txId: string, wallet: ethers.Signer): Promise<string> {
  const tx = await getTransactionStatus(txId);
  const digest = buildTransactionDigest(tx);
  return wallet.signMessage(ethers.getBytes(digest));
}

// ---------------------------------------------------------------------------
// #1193 – Deployment-backed wallet registry
// ---------------------------------------------------------------------------

describe("#1193 loadMultisigWalletsFromDeployment", () => {
  it("loads valid multisig entries from deployment registry", () => {
    const wallets = loadMultisigWalletsFromDeployment(VALID_REGISTRY);
    expect(Object.keys(wallets)).toContain("MARKET_OPS");
    expect(Object.keys(wallets)).toContain("TREASURY");
    expect(Object.keys(wallets)).not.toContain("MarketBridge"); // no multisigId
  });

  it("populates address, owners, threshold, and scheme", () => {
    const wallets = loadMultisigWalletsFromDeployment(VALID_REGISTRY);
    const ops = wallets["MARKET_OPS"];
    expect(ops.address).toBe("0x0000000000000000000000000000000000000001");
    expect(ops.owners).toHaveLength(3);
    expect(ops.threshold).toBe(2);
    expect(ops.scheme).toBe("ECDSA");
  });

  it("rejects an abbreviated (non-full-length) owner address", () => {
    const badRegistry = JSON.stringify({
      contracts: [
        {
          name: "Bad",
          address: "0x0000000000000000000000000000000000000001",
          chainId: 1,
          abiVersion: "1.0.0",
          multisigId: "BAD_WALLET",
          owners: ["0xOwner1...", "0xOwner2..."],
          threshold: 1,
        },
      ],
    });
    // Should produce an empty map (entries skipped due to invalid owner address)
    const wallets = loadMultisigWalletsFromDeployment(badRegistry);
    expect(wallets).toEqual({});
  });

  it("rejects entries with threshold out of range", () => {
    const badRegistry = JSON.stringify({
      contracts: [
        {
          name: "Bad",
          address: "0x0000000000000000000000000000000000000001",
          chainId: 1,
          abiVersion: "1.0.0",
          multisigId: "BAD_WALLET",
          owners: [KEY_1.address],
          threshold: 5, // > owners.length
        },
      ],
    });
    expect(loadMultisigWalletsFromDeployment(badRegistry)).toEqual({});
  });

  it("getWallet throws clearly when no registry is configured in production", () => {
    vi.stubEnv("NEXT_PUBLIC_DEPLOYMENT_REGISTRY_JSON", "");
    vi.stubEnv("NODE_ENV", "production");

    // Force registry to be empty (as it would be in production without config)
    __setMultisigWalletsForTests({});

    expect(() => getWallet("MARKET_OPS")).toThrow(
      /No multisig wallets are configured/,
    );

    vi.unstubAllEnvs();
  });

  it("uses deployment registry over dev fixtures when registry is provided", () => {
    vi.stubEnv("NEXT_PUBLIC_DEPLOYMENT_REGISTRY_JSON", VALID_REGISTRY);
    __resetMultisigStoreForTests();

    const wallets = listWallets();
    // Both wallets from the registry are present
    expect(wallets["MARKET_OPS"].address).toBe(
      "0x0000000000000000000000000000000000000001",
    );
    vi.unstubAllEnvs();
  });
});

// ---------------------------------------------------------------------------
// #1194 – Cryptographic signature verification
// ---------------------------------------------------------------------------

describe("#1194 collectSignature cryptographic verification", () => {
  beforeEach(() => {
    __setMultisigWalletsForTests({ TEST_WALLET: TEST_WALLET });
    vi.stubEnv("NEXT_PUBLIC_MULTISIG_SIMULATE", "true");
  });

  afterEach(() => {
    __resetMultisigStoreForTests();
    vi.unstubAllEnvs();
  });

  it("accepts a valid EIP-191 signature from a registered owner", async () => {
    const txId = await proposeTransaction(
      "TEST_WALLET",
      { target: TEST_WALLET.address, value: "0", data: "0x" },
      KEY_1.address,
    );
    const sig = await signDigest(txId, KEY_1);
    const tx = await collectSignature(txId, KEY_1.address, sig);
    expect(tx.signatures).toHaveLength(1);
    expect(tx.signatures[0].owner).toBe(KEY_1.address);
  });

  it("rejects an arbitrary text string as a signature", async () => {
    const txId = await proposeTransaction(
      "TEST_WALLET",
      { target: TEST_WALLET.address, value: "0", data: "0x" },
      KEY_1.address,
    );
    await expect(
      collectSignature(txId, KEY_1.address, "arbitrary-text-signature"),
    ).rejects.toThrow(/Invalid signature format/);
  });

  it("rejects a malformed hex string that is the wrong length", async () => {
    const txId = await proposeTransaction(
      "TEST_WALLET",
      { target: TEST_WALLET.address, value: "0", data: "0x" },
      KEY_1.address,
    );
    // 64 hex chars (32 bytes) — valid hex but wrong length for a signature
    await expect(
      collectSignature(
        txId,
        KEY_1.address,
        "0x" + "ab".repeat(32),
      ),
    ).rejects.toThrow(/Invalid signature format/);
  });

  it("rejects a signature from a different key (wrong key attack)", async () => {
    const txId = await proposeTransaction(
      "TEST_WALLET",
      { target: TEST_WALLET.address, value: "0", data: "0x" },
      KEY_1.address,
    );
    // KEY_2 signs but we claim it's from KEY_1
    const sigFromKey2 = await signDigest(txId, KEY_2);
    await expect(
      collectSignature(txId, KEY_1.address, sigFromKey2),
    ).rejects.toThrow(/Signature verification failed/);
  });

  it("rejects a valid signature over an altered payload (replay attack)", async () => {
    const txId = await proposeTransaction(
      "TEST_WALLET",
      { target: TEST_WALLET.address, value: "0", data: "0x" },
      KEY_1.address,
    );

    // Sign the original digest
    const sig = await signDigest(txId, KEY_1);

    // Mutate the transaction data after signing to simulate an altered payload.
    // We test verifyOwnerSignature directly here to confirm it uses the digest
    // built at the time of verification (not at sign time).
    const tx = await getTransactionStatus(txId);
    const alteredTx = { ...tx, data: { target: "0x0000000000000000000000000000000000000000", value: "999", data: "0xmalicious" } };
    const alteredDigest = buildTransactionDigest(alteredTx as typeof tx);

    expect(() => verifyOwnerSignature(alteredDigest, sig, KEY_1.address)).toThrow(
      /Signature verification failed/,
    );
  });

  it("rejects duplicate signatures from the same owner", async () => {
    const txId = await proposeTransaction(
      "TEST_WALLET",
      { target: TEST_WALLET.address, value: "0", data: "0x" },
      KEY_1.address,
    );
    const sig = await signDigest(txId, KEY_1);
    await collectSignature(txId, KEY_1.address, sig);
    await expect(collectSignature(txId, KEY_1.address, sig)).rejects.toThrow(
      /already signed/,
    );
  });

  it("advances to Ready once threshold is met with valid signatures", async () => {
    const txId = await proposeTransaction(
      "TEST_WALLET",
      { target: TEST_WALLET.address, value: "0", data: "0x" },
      KEY_1.address,
    );
    const sig1 = await signDigest(txId, KEY_1);
    const sig2 = await signDigest(txId, KEY_2);

    await collectSignature(txId, KEY_1.address, sig1);
    const tx = await collectSignature(txId, KEY_2.address, sig2);
    expect(tx.status).toBe("Ready");
  });
});

// ---------------------------------------------------------------------------
// #1196 – Execution lifecycle
// ---------------------------------------------------------------------------

describe("#1196 processTransaction lifecycle", () => {
  beforeEach(() => {
    __setMultisigWalletsForTests({ TEST_WALLET: TEST_WALLET });
  });

  afterEach(() => {
    __resetMultisigStoreForTests();
    vi.unstubAllEnvs();
  });

  async function setupReadyTx(): Promise<string> {
    const txId = await proposeTransaction(
      "TEST_WALLET",
      { target: TEST_WALLET.address, value: "0", data: "0x" },
      KEY_1.address,
    );
    const sig1 = await signDigest(txId, KEY_1);
    const sig2 = await signDigest(txId, KEY_2);
    await collectSignature(txId, KEY_1.address, sig1);
    await collectSignature(txId, KEY_2.address, sig2);
    return txId;
  }

  // -- Simulation path
  it("simulation: sets status to Executed without a txHash", async () => {
    vi.stubEnv("NEXT_PUBLIC_MULTISIG_SIMULATE", "true");
    const txId = await setupReadyTx();
    const tx = await processTransaction(txId, KEY_1.address);
    expect(tx.status).toBe("Executed");
    expect(tx.txHash).toBeUndefined();
    expect(tx.events).toContainEqual(
      expect.objectContaining({ name: "TransactionExecuted" }),
    );
  });

  // -- Production path: confirmed
  it("production: confirmed receipt produces Confirmed status with txHash", async () => {
    vi.stubEnv("NEXT_PUBLIC_MULTISIG_SIMULATE", "false");
    const txId = await setupReadyTx();
    const receipt: BroadcastReceipt = {
      txHash: VALID_TX_HASH,
      blockNumber: 100,
      status: "confirmed",
    };
    const tx = await processTransaction(txId, KEY_1.address, receipt);
    expect(tx.status).toBe("Confirmed");
    expect(tx.txHash).toBe(VALID_TX_HASH);
    expect(tx.blockNumber).toBe(100);
  });

  // -- Production path: mined
  it("production: mined receipt produces Mined status", async () => {
    vi.stubEnv("NEXT_PUBLIC_MULTISIG_SIMULATE", "false");
    const txId = await setupReadyTx();
    const receipt: BroadcastReceipt = {
      txHash: VALID_TX_HASH,
      status: "mined",
    };
    const tx = await processTransaction(txId, KEY_1.address, receipt);
    expect(tx.status).toBe("Mined");
  });

  // -- Production path: failed
  it("production: failed receipt produces Failed status with TransactionRejected event", async () => {
    vi.stubEnv("NEXT_PUBLIC_MULTISIG_SIMULATE", "false");
    const txId = await setupReadyTx();
    const receipt: BroadcastReceipt = {
      txHash: VALID_TX_HASH,
      status: "failed",
    };
    const tx = await processTransaction(txId, KEY_1.address, receipt);
    expect(tx.status).toBe("Failed");
    expect(tx.events).toContainEqual(
      expect.objectContaining({ name: "TransactionRejected" }),
    );
  });

  // -- Production requires receipt
  it("production: throws when no receipt is provided", async () => {
    vi.stubEnv("NEXT_PUBLIC_MULTISIG_SIMULATE", "false");
    const txId = await setupReadyTx();
    await expect(
      processTransaction(txId, KEY_1.address),
    ).rejects.toThrow(/broadcast receipt is required/);
  });

  // -- Already executed
  it("throws when transaction is already in a terminal state", async () => {
    vi.stubEnv("NEXT_PUBLIC_MULTISIG_SIMULATE", "true");
    const txId = await setupReadyTx();
    await processTransaction(txId, KEY_1.address);
    await expect(processTransaction(txId, KEY_1.address)).rejects.toThrow(
      /already executed/,
    );
  });

  // -- Insufficient signatures
  it("throws when threshold is not met", async () => {
    const txId = await proposeTransaction(
      "TEST_WALLET",
      { target: TEST_WALLET.address, value: "0", data: "0x" },
      KEY_1.address,
    );
    // Only one signature — threshold is 2
    const sig = await signDigest(txId, KEY_1);
    await collectSignature(txId, KEY_1.address, sig);

    vi.stubEnv("NEXT_PUBLIC_MULTISIG_SIMULATE", "true");
    await expect(processTransaction(txId, KEY_1.address)).rejects.toThrow(
      /Insufficient signatures/,
    );
  });

  // -- Non-owner executor
  it("throws when executor is not an owner", async () => {
    vi.stubEnv("NEXT_PUBLIC_MULTISIG_SIMULATE", "true");
    const txId = await setupReadyTx();
    const nonOwner = ethers.Wallet.createRandom();
    await expect(
      processTransaction(txId, nonOwner.address),
    ).rejects.toThrow(/not an owner/);
  });
});
