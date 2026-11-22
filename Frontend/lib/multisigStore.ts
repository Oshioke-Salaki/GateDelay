/**
 * Durable multisig store for Next.js API routes.
 * Mirrors Backend/services/multisigService.js for frontend integration.
 *
 * Contract events are taken from `Contracts/src/MultiSigWallet.sol`:
 *   event TransactionExecuted(uint256 indexed txId, address indexed executor);
 *   event TransactionApproved(uint256 indexed txId, address indexed signer);
 *   event TransactionCreated(uint256 indexed txId, address indexed creator, address indexed target);
 *   event TransactionRejected(uint256 indexed txId);
 *
 * #1193 – Wallets are loaded from `NEXT_PUBLIC_DEPLOYMENT_REGISTRY_JSON` (via
 *          `loadMultisigWalletsFromDeployment`).  The hard-coded example records
 *          are only present in development/test environments
 *          (`process.env.NODE_ENV !== "production"`).
 *
 * #1194 – `collectSignature` recovers the signer from the EIP-191 personal
 *          sign digest of a canonical transaction payload and rejects signatures
 *          that do not match the claimed owner address.
 *
 * #1196 – `processTransaction` distinguishes simulation (dev only) from a real
 *          broadcast.  Production paths advance through `submitted`, `mined`,
 *          `failed`, and `confirmed` states using a receipt returned by the
 *          caller; simulation is gated behind
 *          `NEXT_PUBLIC_MULTISIG_SIMULATE=true`.
 *
 * FE-037 – Proposals, signatures, and audit events are persisted through
 *          `FileMultisigRepository` instead of a module-level Map, so they
 *          survive restarts and are shared by every worker using the same
 *          `MULTISIG_STORE_DIR`.  Each mutation runs under a per-transaction
 *          lock, so concurrent approvals cannot record one owner twice.
 */

import { ethers } from "ethers";
import {
  parseDeploymentRegistry,
  type DeploymentEntry,
} from "./deploymentRegistry";
import {
  FileMultisigRepository,
  resolveMultisigStoreDir,
  type MultisigRepository,
} from "./multisigRepository";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MultisigWallet {
  address: string;
  owners: string[];
  threshold: number;
  scheme: string;
}

export interface MultisigSignature {
  owner: string;
  signature: string;
  timestamp: string;
}

/** On-chain event shapes the UI can render without guessing field names. */
export type MultisigContractEvent =
  | {
      name: "TransactionCreated";
      args: { txId: string; creator: string; target: string };
    }
  | {
      name: "TransactionApproved";
      args: { txId: string; signer: string };
    }
  | {
      name: "TransactionExecuted";
      args: { txId: string; executor: string };
    }
  | {
      name: "TransactionRejected";
      args: { txId: string };
    };

/**
 * #1196 – Extended status enum.
 *
 * - `Pending`   – waiting for enough signatures
 * - `Ready`     – threshold met, not yet broadcast
 * - `Submitted` – broadcast to the network, receipt pending
 * - `Mined`     – receipt received (may still need more confirmations)
 * - `Confirmed` – sufficient on-chain confirmations
 * - `Failed`    – reverted or network error
 * - `Executed`  – simulation only (dev/test); never set in production
 */
export type MultisigTransactionStatus =
  | "Pending"
  | "Ready"
  | "Submitted"
  | "Mined"
  | "Confirmed"
  | "Failed"
  | "Executed";

export interface MultisigTransaction {
  id: string;
  walletId: string;
  data: Record<string, unknown>;
  proposer: string;
  signatures: MultisigSignature[];
  status: MultisigTransactionStatus;
  createdAt: string;
  /** Last committed change; set by the repository. */
  updatedAt: string;
  /** Revision counter incremented on every committed change. */
  version: number;
  executedAt?: string;
  /** Real transaction hash from the chain; undefined until broadcast confirms. */
  txHash?: string;
  /** Block number at which the transaction was mined, if known. */
  blockNumber?: number;
  /** Events emitted during the lifecycle (mapped 1:1 from MultiSigWallet.sol). */
  events: MultisigContractEvent[];
}

// ---------------------------------------------------------------------------
// #1193 – Deployment-backed wallet registry
// ---------------------------------------------------------------------------

/**
 * Shape of one multisig wallet entry in the deployment registry JSON.
 * The registry is produced by `Contracts/script/WriteDeploymentRegistry.s.sol`
 * and delivered via `NEXT_PUBLIC_DEPLOYMENT_REGISTRY_JSON`.
 *
 * We extend `DeploymentEntry` with multisig-specific fields so the registry
 * can carry all required config without a separate env key.
 */
interface MultisigDeploymentEntry extends DeploymentEntry {
  /** Well-known wallet identifier, e.g. "MARKET_OPS". */
  multisigId?: string;
  /** Current list of owner addresses read from chain state or deployment script. */
  owners?: string[];
  /** Minimum approvals required. */
  threshold?: number;
  /** Signature scheme used by this wallet ("ECDSA" | "BLS"). */
  scheme?: string;
}

/** Validates an Ethereum address with a full 40-hex-char check. */
function isValidAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/**
 * Parse the deployment registry JSON and extract multisig wallet entries.
 * Entries that fail address validation or are missing required multisig fields
 * are skipped with a console warning so that unrelated contracts do not block
 * the wallet registry.
 *
 * NOTE: We parse the JSON directly here (rather than going via
 * `parseDeploymentRegistry`) so that multisig-specific extension fields
 * (`multisigId`, `owners`, `threshold`, `scheme`) are preserved.
 * `parseDeploymentRegistry` only returns the four base fields required by
 * the core DeploymentEntry schema.
 */
export function loadMultisigWalletsFromDeployment(
  registryJson: string,
): Record<string, MultisigWallet> {
  let parsed: { contracts?: MultisigDeploymentEntry[] };
  try {
    parsed = JSON.parse(registryJson) as { contracts?: MultisigDeploymentEntry[] };
  } catch {
    throw new Error("Deployment registry is not valid JSON");
  }

  if (!parsed || !Array.isArray(parsed.contracts)) {
    throw new Error("Deployment registry is missing a contracts array");
  }

  const entries = parsed.contracts as MultisigDeploymentEntry[];
  const wallets: Record<string, MultisigWallet> = {};

  for (const entry of entries) {
    if (!entry.multisigId) continue; // Not a multisig entry; skip silently.

    const { multisigId, address, owners, threshold, scheme } = entry;

    if (!isValidAddress(address)) {
      console.warn(
        `[multisigStore] Skipping "${multisigId}": invalid contract address "${address}"`,
      );
      continue;
    }

    if (!Array.isArray(owners) || owners.length === 0) {
      console.warn(
        `[multisigStore] Skipping "${multisigId}": owners array is missing or empty`,
      );
      continue;
    }

    const invalidOwners = owners.filter((o) => !isValidAddress(o));
    if (invalidOwners.length > 0) {
      console.warn(
        `[multisigStore] Skipping "${multisigId}": invalid owner address(es) ${invalidOwners.join(", ")}`,
      );
      continue;
    }

    if (typeof threshold !== "number" || threshold < 1 || threshold > owners.length) {
      console.warn(
        `[multisigStore] Skipping "${multisigId}": threshold ${threshold} is out of range`,
      );
      continue;
    }

    wallets[multisigId] = {
      address,
      owners,
      threshold,
      scheme: typeof scheme === "string" && scheme.length > 0 ? scheme : "ECDSA",
    };
  }

  return wallets;
}

/**
 * Build the active wallet registry.
 *
 * Priority:
 *   1. `NEXT_PUBLIC_DEPLOYMENT_REGISTRY_JSON` — authoritative for all environments.
 *   2. Hard-coded dev fixtures   — only when `NODE_ENV !== "production"`.
 *   3. Empty map                 — production with no registry: actions are disabled.
 */
function buildWalletRegistry(): Record<string, MultisigWallet> {
  const raw = process.env.NEXT_PUBLIC_DEPLOYMENT_REGISTRY_JSON;
  if (raw && raw.trim().length > 0) {
    try {
      const loaded = loadMultisigWalletsFromDeployment(raw);
      if (Object.keys(loaded).length > 0) return loaded;
      console.warn(
        "[multisigStore] Deployment registry contained no valid multisig entries.",
      );
    } catch (err) {
      console.error("[multisigStore] Failed to parse deployment registry:", err);
    }
  }

  if (process.env.NODE_ENV === "production") {
    // #1193 acceptance criteria: missing deployment data disables actions clearly.
    return {};
  }

  // Development / test fallback — valid full addresses only.
  return {
    MARKET_OPS: {
      address: "0x0000000000000000000000000000000000000001",
      owners: [
        "0x0000000000000000000000000000000000000011",
        "0x0000000000000000000000000000000000000012",
        "0x0000000000000000000000000000000000000013",
      ],
      threshold: 2,
      scheme: "ECDSA",
    },
    TREASURY: {
      address: "0x0000000000000000000000000000000000000002",
      owners: [
        "0x0000000000000000000000000000000000000021",
        "0x0000000000000000000000000000000000000022",
        "0x0000000000000000000000000000000000000023",
        "0x0000000000000000000000000000000000000024",
        "0x0000000000000000000000000000000000000025",
      ],
      threshold: 3,
      scheme: "ECDSA",
    },
  };
}

// Initialised once per process; tests may call __resetMultisigStoreForTests.
let MULTISIG_WALLETS: Record<string, MultisigWallet> = buildWalletRegistry();

// FE-037 – Shared durable storage; tests may swap it via the helpers below.
let transactions: MultisigRepository<MultisigTransaction> =
  new FileMultisigRepository<MultisigTransaction>(resolveMultisigStoreDir());

/** Case-insensitive address comparison (checksummed vs. lower-case input). */
function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

// ---------------------------------------------------------------------------
// Public store API
// ---------------------------------------------------------------------------

export function getWallet(walletId: string): MultisigWallet {
  const wallet = MULTISIG_WALLETS[walletId];
  if (!wallet) {
    if (Object.keys(MULTISIG_WALLETS).length === 0) {
      throw new Error(
        "No multisig wallets are configured. Provide NEXT_PUBLIC_DEPLOYMENT_REGISTRY_JSON.",
      );
    }
    throw new Error("Multisig wallet not found");
  }
  return wallet;
}

export function listWallets(): Record<string, MultisigWallet> {
  return MULTISIG_WALLETS;
}

export async function proposeTransaction(
  walletId: string,
  txData: Record<string, unknown>,
  proposer: string,
): Promise<string> {
  const wallet = getWallet(walletId);

  if (!wallet.owners.includes(proposer)) {
    throw new Error("Proposer is not an owner of this multisig");
  }

  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const target =
    typeof txData.target === "string" && txData.target.length > 0
      ? txData.target
      : wallet.address;

  const createdAt = new Date().toISOString();
  await transactions.create({
    id: txId,
    walletId,
    data: txData,
    proposer,
    signatures: [],
    status: "Pending",
    createdAt,
    updatedAt: createdAt,
    version: 1,
    events: [
      {
        name: "TransactionCreated",
        args: { txId, creator: proposer, target },
      },
    ],
  });

  return txId;
}

// ---------------------------------------------------------------------------
// #1194 – Signature verification
// ---------------------------------------------------------------------------

/**
 * Produce a canonical, deterministic digest for an in-flight multisig transaction.
 *
 * The digest covers:
 *   - walletId     (bound to the specific wallet instance)
 *   - txId         (prevents cross-transaction replay)
 *   - txData       (sorted-key JSON for deterministic serialisation)
 *   - proposer     (prevents proposer substitution)
 *   - createdAt    (prevents replay of expired proposals)
 *
 * The hex string is what signers must pass to `eth_sign` / `personal_sign`.
 */
export function buildTransactionDigest(tx: MultisigTransaction): string {
  const canonical = JSON.stringify({
    walletId: tx.walletId,
    txId: tx.id,
    txData: sortKeys(tx.data),
    proposer: tx.proposer,
    createdAt: tx.createdAt,
  });
  return ethers.id(canonical); // keccak256 of UTF-8 bytes → 0x-prefixed hex
}

/** Recursively sort object keys for deterministic JSON serialisation. */
function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.keys(obj as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((obj as Record<string, unknown>)[k])]),
    );
  }
  return obj;
}

/**
 * Recover the signer address from an EIP-191 personal_sign signature over
 * `digest` and confirm it matches `expectedOwner` (case-insensitive).
 *
 * Throws with a descriptive message for:
 *   - malformed signature (not 65 raw bytes = 130 hex chars)
 *   - recovered address that does not match `expectedOwner`
 */
export function verifyOwnerSignature(
  digest: string,
  signature: string,
  expectedOwner: string,
): void {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    throw new Error(
      "Invalid signature format: expected a 65-byte (130 hex char) EIP-191 personal_sign signature",
    );
  }

  let recovered: string;
  try {
    // ethers.verifyMessage re-applies the EIP-191 prefix before recovering.
    recovered = ethers.verifyMessage(ethers.getBytes(digest), signature);
  } catch {
    throw new Error("Signature recovery failed: malformed or invalid signature");
  }

  if (recovered.toLowerCase() !== expectedOwner.toLowerCase()) {
    throw new Error(
      `Signature verification failed: recovered ${recovered} but expected ${expectedOwner}`,
    );
  }
}

export async function collectSignature(
  txId: string,
  owner: string,
  signature: string,
): Promise<MultisigTransaction> {
  // The duplicate check and the append run under the transaction lock against
  // the latest committed record, so racing approvals cannot both succeed.
  return transactions.update(txId, (tx) => {
    const wallet = getWallet(tx.walletId);
    if (!wallet.owners.includes(owner)) {
      throw new Error("Signer is not an owner of this multisig");
    }

    if (tx.signatures.some((s) => sameAddress(s.owner, owner))) {
      throw new Error("Owner has already signed this transaction");
    }

    if (tx.status !== "Pending" && tx.status !== "Ready") {
      throw new Error("Transaction already executed");
    }

    // #1194 – Cryptographic verification before accepting the signature.
    const digest = buildTransactionDigest(tx);
    verifyOwnerSignature(digest, signature, owner);

    tx.signatures.push({
      owner,
      signature,
      timestamp: new Date().toISOString(),
  });

  tx.events.push({
    name: "TransactionApproved",
    args: { txId, signer: owner },
  });

  if (tx.signatures.length >= wallet.threshold) {
    tx.status = "Ready";
  }

  return tx;
  });
}

// ---------------------------------------------------------------------------
// #1196 – Execution lifecycle: simulation vs. real broadcast
// ---------------------------------------------------------------------------

/**
 * Receipt-like object returned by the caller's broadcast path.
 * Minimal surface; the caller fills in whatever the provider gives back.
 */
export interface BroadcastReceipt {
  txHash: string;
  blockNumber?: number;
  status: "mined" | "confirmed" | "failed";
}

/**
 * `processTransaction` — production execution path.
 *
 * Advances the transaction through the confirmed chain lifecycle:
 *   Ready → Submitted → Mined|Failed → Confirmed
 *
 * The caller is responsible for actually broadcasting to the chain and
 * supplying the resulting receipt.  This function updates internal state and
 * returns the final transaction record.
 *
 * @param txId        ID of the pending transaction.
 * @param executor    Verified owner address executing the transaction.
 * @param receipt     Receipt from the chain broadcast.  In production this is
 *                    always required; in simulation mode it may be omitted.
 */
export async function processTransaction(
  txId: string,
  executor?: string,
  receipt?: BroadcastReceipt,
): Promise<MultisigTransaction> {
  return transactions.update(txId, (tx) => {
    const terminalStatuses: MultisigTransactionStatus[] = [
      "Executed",
      "Confirmed",
      "Failed",
    ];
    if (terminalStatuses.includes(tx.status)) {
      throw new Error("Transaction already executed");
    }

    const wallet = getWallet(tx.walletId);

    if (tx.signatures.length < wallet.threshold) {
      throw new Error(
        `Insufficient signatures. Required: ${wallet.threshold}, Current: ${tx.signatures.length}`,
      );
    }

    const resolvedExecutor = executor?.trim() || tx.proposer;
    if (!wallet.owners.includes(resolvedExecutor)) {
      throw new Error("Executor is not an owner of this multisig");
    }

    // -------------------------------------------------------------------------
    // Simulation path (dev / test only)
    // -------------------------------------------------------------------------
    const simulate =
      process.env.NEXT_PUBLIC_MULTISIG_SIMULATE === "true" &&
      process.env.NODE_ENV !== "production";

    if (simulate && !receipt) {
      tx.status = "Executed";
      tx.executedAt = new Date().toISOString();
      // No txHash — simulation never invents a chain hash.
      tx.events.push({
        name: "TransactionExecuted",
        args: { txId, executor: resolvedExecutor },
      });
      return tx;
    }

    // -------------------------------------------------------------------------
    // Production path — receipt is required
    // -------------------------------------------------------------------------
    if (!receipt) {
      throw new Error(
        "A broadcast receipt is required to execute a multisig transaction in production. " +
          "Set NEXT_PUBLIC_MULTISIG_SIMULATE=true to enable simulation mode in development.",
      );
    }

    // Mark as submitted first so the caller can observe this state if it persists
    // the transaction before the receipt is applied.
    tx.status = "Submitted";
    tx.txHash = receipt.txHash;

    if (receipt.status === "failed") {
      tx.status = "Failed";
      tx.events.push({
        name: "TransactionRejected",
        args: { txId },
      });
      return tx;
    }

    // mined or confirmed
    tx.status = receipt.status === "confirmed" ? "Confirmed" : "Mined";
    tx.executedAt = new Date().toISOString();
    if (receipt.blockNumber !== undefined) {
      tx.blockNumber = receipt.blockNumber;
    }
    tx.events.push({
      name: "TransactionExecuted",
      args: { txId, executor: resolvedExecutor },
  });

  return tx;
  });
}

export async function getTransactionStatus(
  txId: string,
): Promise<MultisigTransaction> {
  const tx = await transactions.get(txId);
  if (!tx) throw new Error("Transaction not found");
  return tx;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Test helper — clears persisted state between Vitest cases. */
export function __resetMultisigStoreForTests(): void {
  transactions.clear();
  MULTISIG_WALLETS = buildWalletRegistry();
}

/**
 * Test helper — override the wallet registry directly.
 * Useful for testing with specific deployment fixtures without setting env vars.
 */
export function __setMultisigWalletsForTests(
  wallets: Record<string, MultisigWallet>,
): void {
  MULTISIG_WALLETS = wallets;
}

/**
 * Test helper — point this module instance at a specific storage directory.
 * Two module instances sharing one directory model two server workers.
 */
export function __setMultisigStoreDirForTests(dir: string): void {
  transactions = new FileMultisigRepository<MultisigTransaction>(dir);
}
