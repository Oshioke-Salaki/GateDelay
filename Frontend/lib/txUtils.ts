/**
 * Shared helpers for surfacing on-chain transaction references in toasts and UI.
 */

/** Shorten a 0x… hash for display: 0x1234…abcd */
export function truncateTxHash(hash: string): string {
  if (hash.length < 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

/**
 * Build a Mantle explorer URL for a transaction hash.
 * Falls back to the staging explorer when NEXT_PUBLIC_EXPLORER_URL is absent.
 */
export function explorerTxUrl(hash: string): string {
  const base =
    process.env.NEXT_PUBLIC_EXPLORER_URL?.replace(/\/+$/, "") ??
    "https://explorer.mantle.xyz";
  return `${base}/tx/${hash}`;
}

/**
 * Minimal ERC20 ABI covering the methods needed for the collateral approval flow.
 */
export const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

/**
 * Compute the required allowance for a trade.
 * Returns the collateral amount the spender must be approved for.
 * Accepts bigint, string, or number amounts and normalizes to bigint.
 */
export function requiredAllowance(
  amount: bigint | string | number,
): bigint {
  if (typeof amount === "bigint") return amount;
  if (typeof amount === "number") {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Invalid allowance amount");
    }
    return BigInt(Math.trunc(amount));
  }
  const trimmed = amount.trim();
  if (trimmed === "") {
    throw new Error("Invalid allowance amount");
  }
  return BigInt(trimmed);
}

/**
 * Determine whether an approval is needed given the current allowance and the
 * required amount for a trade.
 */
export function needsApproval(
  currentAllowance: bigint,
  required: bigint,
): boolean {
  return currentAllowance < required;
}

export type TxConfirmationKind = "approval" | "trade";

/**
 * Format a confirmation message for an approval or a trade, including an
 * explorer link when a transaction hash is available.
 */
export function formatTxConfirmation(
  kind: TxConfirmationKind,
  hash?: string,
): string {
  const label = kind === "approval" ? "Approval" : "Trade";
  if (!hash) {
    return `${label} submitted`;
  }
  return `${label} confirmed: ${explorerTxUrl(hash)}`;
}