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
 * #1194 – `collectSignature` recovers the signer from the transaction
 *          digest and rejects signatures that do not match the claimed owner.
 *
 * #1196 – `processTransaction` distinguishes simulation (dev only) from a real
 *          broadcast.  Production paths advance through `submitted`, `mined`,
 *          `failed`, and `confirmed` states using a receipt returned by the
 *          caller; simulation is gated behind
 *          `NEXT_PUBLIC_MULTISIG_SIMULATE=true`.
 *
 * #1198 – Signatures are bound to chain ID, wallet address, nonce, target,
 *          value, calldata hash, and expiry via EIP-712 typed data. Changing
 *          any bound field invalidates the approval, and consumed nonces
 *          cannot authorize another transaction.
 * FE-037 – Proposals, signatures, and audit events are persisted through
 *          `FileMultisigRepository` instead of a module-level Map, so they
 *          survive restarts and are shared by workers using the same
 *          `MULTISIG_STORE_DIR`. Mutations run under a per-transaction lock
 *          to prevent concurrent approvals from recording one owner twice.
 */

import { ethers, TypedDataDomain, TypedDataField } from "ethers";
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
// #1198 – EIP-712 typed-data constants
// ---------------------------------------------------------------------------

export const MULTISIG_DOMAIN_NAME = "GateDelay MultiSig";
export const MULTISIG_DOMAIN_VERSION = "1";

/** EIP-712 type definition for a multisig approval. */
export const MULTISIG_APPROVAL_TYPES: Record<string, TypedDataField[]> = {
  MultisigApproval: [
    { name: "chainId", type: "uint256" },
    { name: "walletAddress", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "target", type: "address" },
    { name: "value", type: "uint256" },
    { name: "calldataHash", type: "bytes32" },
    { name: "expiry", type: "uint256" },
  ],
};

/** Default proposal lifetime: 1 hour (in seconds). */
const DEFAULT_EXPIRY_DURATION_SECS = 3600;

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
  /** #1198 – Chain ID this transaction is bound to. */
  chainId: number;
  /** #1198 – Multisig wallet contract address this transaction is bound to. */
  walletAddress?: string;
  /** #1198 – Per-wallet monotonic nonce, consumed on first valid signature. */
  nonce: number;
  /** #1198 – Target contract address for the call. */
  target: string;
  /** #1198 – ETH value to send with the call (wei, as a decimal string). */
  value: string;
  /** #1198 – Keccak-256 hash of the calldata bytes. */
  calldataHash: string;
  /** #1198 – Unix timestamp (seconds) after which this proposal expires. */
  expiry: number;
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
// #1198 – Per-wallet nonce tracking
// ---------------------------------------------------------------------------

/** Next nonce to assign for each wallet. */
const walletNonces = new Map<string, number>();

/** Set of consumed nonces per wallet — prevents replay. */
const consumedNonces = new Map<string, Set<number>>();

function nextNonce(walletAddress: string): number {
  const key = walletAddress.toLowerCase();
  const n = walletNonces.get(key) ?? 0;
  walletNonces.set(key, n + 1);
  return n;
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

/**
 * #1198 – Options for creating a new multisig proposal.
 * All fields that become part of the EIP-712 signed message are required
 * so that the signer can verify exactly what they are approving.
 */
export interface ProposeTransactionOpts {
  /** Chain ID the transaction targets (e.g. 1 for mainnet). */
  chainId?: number;
  /** Multisig wallet contract address override. */
  walletAddress?: string;
  /** Target contract address. */
  target?: string;
  /** Wei value to send (decimal string). */
  value?: string;
  /** Raw calldata hex bytes (e.g. "0x" for a plain transfer). */
  calldata?: string;
  /** Direct calldata keccak256 hash if calldata raw bytes not supplied. */
  calldataHash?: string;
  /** Nonce override (e.g. to test replay of consumed nonces). */
  nonce?: number;
  /** Optional Unix-seconds expiry.  Defaults to now + 1 hour. */
  expiry?: number;
}

export async function proposeTransaction(
  walletId: string,
  txData: Record<string, unknown>,
  proposer: string,
  opts?: ProposeTransactionOpts,
): Promise<string> {
  const wallet = getWallet(walletId);

  if (!wallet.owners.includes(proposer)) {
    throw new Error("Proposer is not an owner of this multisig");
  }

  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // #1198 – Resolve bound fields
  const chainId = opts?.chainId ?? (typeof txData.chainId === "number" ? txData.chainId : 1);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("Chain ID must be a positive safe integer");
  const walletAddress = ethers.getAddress(wallet.address);
  if (opts?.walletAddress && ethers.getAddress(opts.walletAddress) !== walletAddress) {
    throw new Error("Wallet address must match the configured multisig wallet");
  }
  const target =
    opts?.target ??
    (typeof txData.target === "string" && txData.target.length > 0
      ? txData.target
      : wallet.address);
  const normalizedTarget = ethers.getAddress(target);
  const value = opts?.value ?? (typeof txData.value === "string" ? txData.value : "0");
  if (!/^\d+$/.test(value)) throw new Error("Transaction value must be a non-negative integer in wei");
  const calldata = opts?.calldata ?? (typeof txData.data === "string" ? txData.data : "0x");
  if (!ethers.isHexString(calldata)) throw new Error("Transaction calldata must be hex data");
  const calculatedCalldataHash = ethers.keccak256(calldata);
  if (opts?.calldataHash && opts.calldataHash.toLowerCase() !== calculatedCalldataHash.toLowerCase()) {
    throw new Error("calldataHash does not match transaction calldata");
  }
  const calldataHash = calculatedCalldataHash;
  const assignedNonce = nextNonce(walletAddress);
  const nonce = opts?.nonce ?? assignedNonce;
  if (!Number.isSafeInteger(nonce) || nonce < 0) throw new Error("Transaction nonce must be a non-negative safe integer");
  walletNonces.set(walletAddress.toLowerCase(), Math.max(walletNonces.get(walletAddress.toLowerCase()) ?? 0, nonce + 1));
  const expiry =
    opts?.expiry ??
    (typeof txData.expiry === "number"
      ? txData.expiry
      : Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_DURATION_SECS);

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
    chainId,
    walletAddress,
    nonce,
    target: normalizedTarget,
    value,
    calldataHash,
    expiry,
    events: [
      {
        name: "TransactionCreated",
        args: { txId, creator: proposer, target: normalizedTarget },
      },
    ],
  });

  return txId;
}

// ---------------------------------------------------------------------------
// #1198 – EIP-712 typed-data signing & verification
// ---------------------------------------------------------------------------

/**
 * Build the EIP-712 domain separator for a transaction.
 * The `verifyingContract` is the multisig wallet address and `chainId`
 * is taken from the transaction itself, binding the signature to a
 * specific chain + wallet pair.
 */
function buildDomain(tx: MultisigTransaction): TypedDataDomain {
  const wallet = MULTISIG_WALLETS[tx.walletId];
  return {
    name: MULTISIG_DOMAIN_NAME,
    version: MULTISIG_DOMAIN_VERSION,
    chainId: tx.chainId,
    verifyingContract: tx.walletAddress ?? wallet?.address ?? tx.target,
  };
}

/**
 * Build the EIP-712 message values from a MultisigTransaction.
 */
function buildMessage(tx: MultisigTransaction): Record<string, unknown> {
  const wallet = MULTISIG_WALLETS[tx.walletId];
  return {
    chainId: tx.chainId,
    walletAddress: tx.walletAddress ?? wallet?.address ?? tx.target,
    nonce: tx.nonce,
    target: tx.target,
    value: tx.value,
    calldataHash: tx.calldataHash,
    expiry: tx.expiry,
  };
}

/**
 * Return the full EIP-712 typed-data object for a transaction.
 * Callers (e.g. frontend UI) pass this to `wallet._signTypedData(domain, types, message)`.
 *
 * Replaces the previous `buildTransactionDigest` (EIP-191) function.
 */
export function buildTypedData(tx: MultisigTransaction): {
  domain: TypedDataDomain;
  types: Record<string, TypedDataField[]>;
  message: Record<string, unknown>;
} {
  return {
    domain: buildDomain(tx),
    types: MULTISIG_APPROVAL_TYPES,
    message: buildMessage(tx),
  };
}

/**
 * Compute the EIP-712 hash of the typed data for a transaction.
 * Useful for server-side logging / indexing.
 *
 * Replaces the previous `buildTransactionDigest` (keccak256-of-JSON) function.
 */
export function buildTypedDataHash(tx: MultisigTransaction): string {
  const { domain, types, message } = buildTypedData(tx);
  return ethers.TypedDataEncoder.hash(domain, types, message);
}

/**
 * Backwards compatibility helper for #1194 callers and tests.
 * Returns the EIP-712 typed data hash for the transaction.
 */
export function buildTransactionDigest(tx: MultisigTransaction): string {
  return buildTypedDataHash(tx);
}

/**
 * Verify an EIP-712 typed-data signature, recovering the signer and
 * confirming it matches `expectedOwner` (case-insensitive).
 *
 * Replaces the previous `verifyOwnerSignature` (EIP-191) function.
 *
 * Throws with a descriptive message for:
 *   - malformed signature (not 65 raw bytes = 130 hex chars)
 *   - recovered address that does not match `expectedOwner`
 */
export function verifyTypedDataSignature(
  domain: TypedDataDomain,
  types: Record<string, TypedDataField[]>,
  message: Record<string, unknown>,
  signature: string,
  expectedOwner: string,
): void {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    throw new Error(
      "Invalid signature format: expected a 65-byte (130 hex char) EIP-712 signature",
    );
  }

  let recovered: string;
  try {
    recovered = ethers.verifyTypedData(domain, types, message, signature);
  } catch {
    throw new Error("Signature recovery failed: malformed or invalid signature");
  }

  if (recovered.toLowerCase() !== expectedOwner.toLowerCase()) {
    throw new Error(
      `Signature verification failed: recovered ${recovered} but expected ${expectedOwner}`,
    );
  }
}

/**
 * Backwards compatibility helper for #1194 callers and tests.
 */
export function verifyOwnerSignature(
  digestOrTx: string | MultisigTransaction,
  signature: string,
  expectedOwner: string,
): void {
  if (typeof digestOrTx !== "string") {
    const { domain, types, message } = buildTypedData(digestOrTx);
    return verifyTypedDataSignature(domain, types, message, signature, expectedOwner);
  }
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    throw new Error(
      "Invalid signature format: expected a 65-byte (130 hex char) signature",
    );
  }
  let recovered: string;
  try {
    recovered = ethers.verifyMessage(ethers.getBytes(digestOrTx), signature);
  } catch {
    throw new Error("Signature recovery failed: malformed or invalid signature");
  }
  if (recovered.toLowerCase() !== expectedOwner.toLowerCase()) {
    throw new Error(
      `Signature verification failed: recovered ${recovered} but expected ${expectedOwner}`,
    );
  }
}

/**
 * #1198 – Check whether a nonce has already been consumed for a given wallet.
 */
export function isNonceConsumed(walletId: string, nonce: number): boolean {
  const wallet = MULTISIG_WALLETS[walletId];
  const addressKey = wallet?.address.toLowerCase() ?? walletId.toLowerCase();
  return consumedNonces.get(addressKey)?.has(nonce) ?? false;
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

  // #1198 – Reject expired proposals
  if (Math.floor(Date.now() / 1000) > tx.expiry) {
    throw new Error("Transaction proposal has expired");
  }

  // #1198 – Reject if nonce has already been consumed
  if (tx.signatures.length === 0) {
    const nonceKey = (tx.walletAddress ?? wallet.address).toLowerCase();
    const consumed = consumedNonces.get(nonceKey);
    if (consumed?.has(tx.nonce)) {
      throw new Error("Nonce already consumed: this transaction cannot be authorized");
    }
  }

  // Verify the EIP-712 approval.
  const { domain, types, message } = buildTypedData(tx);
  verifyTypedDataSignature(domain, types, message, signature, owner);

  // Consume the nonce on the first valid signature.
  if (tx.signatures.length === 0) {
    const nonceKey = (tx.walletAddress ?? wallet.address).toLowerCase();
    const consumed = consumedNonces.get(nonceKey) ?? new Set<number>();
    consumed.add(tx.nonce);
    consumedNonces.set(nonceKey, consumed);
  }
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
  pendingTransactions.clear();
  transactions.clear();
  walletNonces.clear();
  consumedNonces.clear();
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
