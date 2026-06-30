/**
 * In-memory multisig store for Next.js API routes.
 * Mirrors Backend/services/multisigService.js for frontend integration.
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

  pendingTransactions.set(txId, {
    id: txId,
    walletId,
    data: txData,
    proposer,
    signatures: [],
    status: "Pending",
    createdAt: new Date().toISOString(),
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

  if (tx.signatures.length >= wallet.threshold) {
    tx.status = "Ready";
  }

  return tx;
}

export async function processTransaction(txId: string): Promise<MultisigTransaction> {
  const tx = pendingTransactions.get(txId);
  if (!tx) throw new Error("Transaction not found");

  const wallet = getWallet(tx.walletId);

  if (tx.signatures.length < wallet.threshold) {
    throw new Error(
      `Insufficient signatures. Required: ${wallet.threshold}, Current: ${tx.signatures.length}`
    );
  }

  tx.status = "Executed";
  tx.executedAt = new Date().toISOString();
  tx.txHash = "0x" + Math.random().toString(16).slice(2, 66);

  return tx;
}

export function getTransactionStatus(txId: string): MultisigTransaction {
  const tx = pendingTransactions.get(txId);
  if (!tx) throw new Error("Transaction not found");
  return tx;
}
