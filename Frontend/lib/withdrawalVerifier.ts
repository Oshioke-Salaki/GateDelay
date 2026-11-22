import { Interface, getAddress, type Provider, type TransactionReceipt } from "ethers";

const ERC20_IFACE = new Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);
const TRANSFER_TOPIC = ERC20_IFACE.getEvent("Transfer")!.topicHash;

/** The recorded intent. Adapt field names to your withdrawal model. */
export interface WithdrawalIntent {
  sender: string;
  recipient: string;
  /** ERC-20 contract address, or null / undefined for the native coin */
  token?: string | null;
  /** Exact amount in the token's smallest unit (wei) */
  amount: bigint;
  /** Optional: expected chain */
  chainId?: bigint;
}

export type VerifyResult =
  | { ok: true; transferLogIndex: number | null }
  | { ok: false; reason: VerifyFailure; detail?: string };

export type VerifyFailure =
  | "TX_NOT_FOUND"
  | "RECEIPT_NOT_FOUND"
  | "TX_REVERTED"
  | "CHAIN_MISMATCH"
  | "SENDER_MISMATCH"
  | "RECIPIENT_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "TOKEN_MISMATCH"
  | "TRANSFER_LOG_NOT_FOUND"
  | "INSUFFICIENT_CONFIRMATIONS";

const sameAddr = (a: string, b: string) => getAddress(a) === getAddress(b);

export async function verifyWithdrawal(
  provider: Provider,
  txHash: string,
  intent: WithdrawalIntent,
  opts: { minConfirmations?: number } = {},
): Promise<VerifyResult> {
  const [tx, receipt] = await Promise.all([
    provider.getTransaction(txHash),
    provider.getTransactionReceipt(txHash),
  ]);

  if (!tx) return { ok: false, reason: "TX_NOT_FOUND" };
  if (!receipt) return { ok: false, reason: "RECEIPT_NOT_FOUND" };

  // 1. Execution succeeded
  if (receipt.status !== 1) return { ok: false, reason: "TX_REVERTED" };

  // 2. Right chain
  if (intent.chainId !== undefined && tx.chainId !== intent.chainId) {
    return {
      ok: false,
      reason: "CHAIN_MISMATCH",
      detail: `expected ${intent.chainId}, got ${tx.chainId}`,
    };
  }

  // 3. Enough confirmations
  if (opts.minConfirmations && opts.minConfirmations > 0) {
    const confirmations = await receipt.confirmations();
    if (confirmations < opts.minConfirmations) {
      return {
        ok: false,
        reason: "INSUFFICIENT_CONFIRMATIONS",
        detail: `${confirmations}/${opts.minConfirmations}`,
      };
    }
  }

  return intent.token ? verifyErc20(receipt, intent) : verifyNative(tx, intent);
}

function verifyNative(
  tx: { from: string; to: string | null; value: bigint },
  intent: WithdrawalIntent,
): VerifyResult {
  if (!sameAddr(tx.from, intent.sender)) {
    return { ok: false, reason: "SENDER_MISMATCH", detail: tx.from };
  }
  if (!tx.to || !sameAddr(tx.to, intent.recipient)) {
    return { ok: false, reason: "RECIPIENT_MISMATCH", detail: tx.to ?? "null" };
  }
  if (tx.value !== intent.amount) {
    return {
      ok: false,
      reason: "AMOUNT_MISMATCH",
      detail: `expected ${intent.amount}, got ${tx.value}`,
    };
  }
  return { ok: true, transferLogIndex: null };
}

function verifyErc20(receipt: TransactionReceipt, intent: WithdrawalIntent): VerifyResult {
  const token = intent.token!;

  // Only consider Transfer logs actually emitted BY the expected token contract.
  // (Checking topics alone would accept a fake token that emits a lookalike event.)
  const tokenTransfers = receipt.logs
    .filter((l) => sameAddr(l.address, token) && l.topics[0] === TRANSFER_TOPIC)
    .map((l) => {
      try {
        const parsed = ERC20_IFACE.parseLog({ topics: [...l.topics], data: l.data });
        return parsed
          ? {
              index: l.index,
              from: parsed.args.from as string,
              to: parsed.args.to as string,
              value: parsed.args.value as bigint,
            }
          : null;
      } catch {
        return null;
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (tokenTransfers.length === 0) {
    // Distinguish "wrong token" from "no transfer at all"
    const anyTransfer = receipt.logs.some((l) => l.topics[0] === TRANSFER_TOPIC);
    return {
      ok: false,
      reason: anyTransfer ? "TOKEN_MISMATCH" : "TRANSFER_LOG_NOT_FOUND",
    };
  }

  // Narrow step by step so we can report the most specific failure.
  const fromMatches = tokenTransfers.filter((t) => sameAddr(t.from, intent.sender));
  if (fromMatches.length === 0) return { ok: false, reason: "SENDER_MISMATCH" };

  const toMatches = fromMatches.filter((t) => sameAddr(t.to, intent.recipient));
  if (toMatches.length === 0) return { ok: false, reason: "RECIPIENT_MISMATCH" };

  const exact = toMatches.find((t) => t.value === intent.amount);
  if (!exact) {
    return {
      ok: false,
      reason: "AMOUNT_MISMATCH",
      detail: `expected ${intent.amount}, got ${toMatches.map((t) => t.value).join(",")}`,
    };
  }

  return { ok: true, transferLogIndex: exact.index };
}
