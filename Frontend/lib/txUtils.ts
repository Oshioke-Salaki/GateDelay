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
