/**
 * @vitest-environment node
 *
 * multisigPersistence.test.ts
 *
 * FE-037 – Multisig proposals must survive restarts, be visible to every
 * worker sharing the store, and reject duplicate concurrent approvals.
 *
 * Each "worker" is a fresh module instance (via `vi.resetModules`) pointed at
 * the same storage directory, so no in-process state is shared between them.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ethers } from "ethers";
import type { MultisigWallet } from "./multisigStore";

type Store = typeof import("./multisigStore");

const KEY_1 = ethers.Wallet.createRandom();
const KEY_2 = ethers.Wallet.createRandom();
const KEY_3 = ethers.Wallet.createRandom();

const TEST_WALLET: MultisigWallet = {
  address: "0x0000000000000000000000000000000000000099",
  owners: [KEY_1.address, KEY_2.address, KEY_3.address],
  threshold: 2,
  scheme: "ECDSA",
};

const TX_DATA = { target: TEST_WALLET.address, value: "0", data: "0x" };

let storeDir: string;

/** Boot an isolated module instance — the equivalent of a server worker. */
async function startWorker(): Promise<Store> {
  vi.resetModules();
  const store: Store = await import("./multisigStore");
  store.__setMultisigStoreDirForTests(storeDir);
  store.__setMultisigWalletsForTests({ TEST_WALLET });
  return store;
}

async function sign(
  store: Store,
  txId: string,
  key: ethers.HDNodeWallet,
): Promise<string> {
  const tx = await store.getTransactionStatus(txId);
  return key.signMessage(ethers.getBytes(store.buildTransactionDigest(tx)));
}

beforeEach(() => {
  storeDir = fs.mkdtempSync(path.join(os.tmpdir(), "fe037-"));
});

afterEach(() => {
  fs.rmSync(storeDir, { recursive: true, force: true });
});

describe("FE-037 durable multisig store", () => {
  it("shares proposals across workers and survives a restart of both", async () => {
    const workerA = await startWorker();
    const workerB = await startWorker();

    const txId = await workerA.proposeTransaction(
      "TEST_WALLET",
      TX_DATA,
      KEY_1.address,
    );

    // Worker B can find and approve a proposal created on worker A.
    await workerB.collectSignature(
      txId,
      KEY_2.address,
      await sign(workerB, txId, KEY_2),
    );

    // Worker A sees B's signature without any in-memory hand-off.
    const seenByA = await workerA.getTransactionStatus(txId);
    expect(seenByA.signatures.map((s) => s.owner)).toEqual([KEY_2.address]);

    // Restart both workers.
    const restartedA = await startWorker();
    const restartedB = await startWorker();

    const afterA = await restartedA.getTransactionStatus(txId);
    const afterB = await restartedB.getTransactionStatus(txId);

    expect(afterA).toEqual(afterB);
    expect(afterA.status).toBe("Pending");
    expect(afterA.signatures).toHaveLength(1);
    expect(afterA.events.map((e) => e.name)).toEqual([
      "TransactionCreated",
      "TransactionApproved",
    ]);
    expect(afterA.version).toBe(2);

    // The restarted worker can keep advancing the same proposal.
    const ready = await restartedA.collectSignature(
      txId,
      KEY_3.address,
      await sign(restartedA, txId, KEY_3),
    );
    expect(ready.status).toBe("Ready");
    expect((await restartedB.getTransactionStatus(txId)).status).toBe("Ready");
  });

  it("records one owner only once when approvals race on two workers", async () => {
    const workerA = await startWorker();
    const workerB = await startWorker();

    const txId = await workerA.proposeTransaction(
      "TEST_WALLET",
      TX_DATA,
      KEY_1.address,
    );
    const signature = await sign(workerA, txId, KEY_2);

    const results = await Promise.allSettled([
      workerA.collectSignature(txId, KEY_2.address, signature),
      workerB.collectSignature(txId, KEY_2.address, signature),
      workerA.collectSignature(txId, KEY_2.address.toLowerCase(), signature),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) {
      if (r.status === "rejected") {
        expect(String(r.reason)).toMatch(/already signed|not an owner/);
      }
    }

    const tx = await workerB.getTransactionStatus(txId);
    expect(tx.signatures).toHaveLength(1);
    expect(
      tx.events.filter((e) => e.name === "TransactionApproved"),
    ).toHaveLength(1);
  });

  it("keeps every distinct owner's approval when they race", async () => {
    const workerA = await startWorker();
    const workerB = await startWorker();

    const txId = await workerA.proposeTransaction(
      "TEST_WALLET",
      TX_DATA,
      KEY_1.address,
    );

    await Promise.all([
      workerA.collectSignature(txId, KEY_1.address, await sign(workerA, txId, KEY_1)),
      workerB.collectSignature(txId, KEY_2.address, await sign(workerB, txId, KEY_2)),
      workerB.collectSignature(txId, KEY_3.address, await sign(workerB, txId, KEY_3)),
    ]);

    const tx = await workerA.getTransactionStatus(txId);
    expect(new Set(tx.signatures.map((s) => s.owner))).toEqual(
      new Set([KEY_1.address, KEY_2.address, KEY_3.address]),
    );
    expect(tx.status).toBe("Ready");
    expect(tx.version).toBe(4);
  });

  it("does not persist a rejected approval", async () => {
    const worker = await startWorker();
    const txId = await worker.proposeTransaction(
      "TEST_WALLET",
      TX_DATA,
      KEY_1.address,
    );
    const wrongKeySig = await sign(worker, txId, KEY_3);

    await expect(
      worker.collectSignature(txId, KEY_2.address, wrongKeySig),
    ).rejects.toThrow(/Signature verification failed/);

    const tx = await (await startWorker()).getTransactionStatus(txId);
    expect(tx.signatures).toHaveLength(0);
    expect(tx.version).toBe(1);
  });

  it("treats unknown or path-like ids as not found", async () => {
    const worker = await startWorker();
    await expect(worker.getTransactionStatus("tx_missing")).rejects.toThrow(
      "Transaction not found",
    );
    await expect(worker.getTransactionStatus("../../etc/passwd")).rejects.toThrow(
      "Transaction not found",
    );
    await expect(
      worker.collectSignature("../escape", KEY_1.address, "0x"),
    ).rejects.toThrow("Transaction not found");
  });
});
