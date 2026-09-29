/**
 * In-memory multisig store for Next.js API routes.
 * Mirrors Backend/services/multisigService.js for frontend integration.
 *
 * Contract events are taken from `Contracts/src/MultiSigWallet.sol`:
 *   event TransactionExecuted(uint256 indexed txId, address indexed executor);
 *   event TransactionApproved(uint256 indexed txId, address indexed signer);
 *   event TransactionCreated(uint256 indexed txId, address indexed creator, address indexed target);
 *   event TransactionRejected(uint256 indexed txId);
 */

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

export interface MultisigTransaction {
  id: string;
  walletId: string;
  data: Record<string, unknown>;
  proposer: string;
  signatures: MultisigSignature[];
  status: "Pending" | "Ready" | "Executed";
  createdAt: string;
  executedAt?: string;
  txHash?: string;
  /** Events emitted during the mock lifecycle (mapped 1:1 from MultiSigWallet.sol). */
  events: MultisigContractEvent[];
}

const MULTISIG_WALLETS: Record<string, MultisigWallet> = {
  MARKET_OPS: {
    address: "0x1234567890123456789012345678901234567890",
    owners: ["0xOwner1...", "0xOwner2...", "0xOwner3..."],
    threshold: 2,
    scheme: "ECDSA",
  },
  TREASURY: {
    address: "0x0987654321098765432109876543210987654321",
    owners: [
      "0xAdmin1...",
      "0xAdmin2...",
      "0xAdmin3...",
      "0xAdmin4...",
      "0xAdmin5...",
    ],
    threshold: 3,
    scheme: "BLS",
  },
};

const pendingTransactions = new Map<string, MultisigTransaction>();

export function getWallet(walletId: string): MultisigWallet {
  const wallet = MULTISIG_WALLETS[walletId];
  if (!wallet) throw new Error("Multisig wallet not found");
  return wallet;
}

export function listWallets(): Record<string, MultisigWallet> {
  return MULTISIG_WALLETS;
}

export async function proposeTransaction(
  walletId: string,
  txData: Record<string, unknown>,
  proposer: string
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

  pendingTransactions.set(txId, {
    id: txId,
    walletId,
    data: txData,
    proposer,
    signatures: [],
    status: "Pending",
    createdAt: new Date().toISOString(),
    events: [
      {
        name: "TransactionCreated",
        args: { txId, creator: proposer, target },
      },
    ],
  });

  return txId;
}

export async function collectSignature(
  txId: string,
  owner: string,
  signature: string
): Promise<MultisigTransaction> {
  const tx = pendingTransactions.get(txId);
  if (!tx) throw new Error("Transaction not found");

  const wallet = getWallet(tx.walletId);
  if (!wallet.owners.includes(owner)) {
    throw new Error("Signer is not an owner of this multisig");
  }

  if (tx.signatures.find((s) => s.owner === owner)) {
    throw new Error("Owner has already signed this transaction");
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
}

export async function processTransaction(
  txId: string,
  executor?: string
): Promise<MultisigTransaction> {
  const tx = pendingTransactions.get(txId);
  if (!tx) throw new Error("Transaction not found");

  if (tx.status === "Executed") {
    throw new Error("Transaction already executed");
  }

  const wallet = getWallet(tx.walletId);

  if (tx.signatures.length < wallet.threshold) {
    throw new Error(
      `Insufficient signatures. Required: ${wallet.threshold}, Current: ${tx.signatures.length}`
    );
  }

  const resolvedExecutor = executor?.trim() || tx.proposer;
  if (!wallet.owners.includes(resolvedExecutor)) {
    throw new Error("Executor is not an owner of this multisig");
  }

  tx.status = "Executed";
  tx.executedAt = new Date().toISOString();
  // Do not invent a chain transaction hash. This store is an in-memory mock of
  // MultiSigWallet; the UI should rely on `events` (TransactionExecuted) until a
  // real broadcast path supplies txHash.
  delete tx.txHash;
  tx.events.push({
    name: "TransactionExecuted",
    args: { txId, executor: resolvedExecutor },
  });

  return tx;
}

export function getTransactionStatus(txId: string): MultisigTransaction {
  const tx = pendingTransactions.get(txId);
  if (!tx) throw new Error("Transaction not found");
  return tx;
}

/** Test helper — clears in-memory state between Vitest cases. */
export function __resetMultisigStoreForTests(): void {
  pendingTransactions.clear();
}
