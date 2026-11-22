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

/** Order side for slippage bounds. */
export type OrderSide = "buy" | "sell";

/** Slippage-adjusted execution bounds derived from a quote price. */
export interface SlippageBounds {
  /** The original quote price. */
  quotePrice: number;
  /** The applied tolerance in percent (clamped to a sane range). */
  slippagePercent: number;
  /** Minimum acceptable price (sells) — quote reduced by tolerance. */
  minPrice: number;
  /** Maximum acceptable price (buys) — quote increased by tolerance. */
  maxPrice: number;
  /**
   * The bound that protects the trader for the given side:
   * `maxPrice` for buys, `minPrice` for sells.
   */
  limitPrice: number;
}

/**
 * Convert a selected slippage tolerance into executable price bounds.
 *
 * Buys must not pay more than the quote plus tolerance; sells must not
 * receive less than the quote minus tolerance. The tolerance is clamped to
 * [0, 100] so a malformed preference can never produce negative prices.
 */
export function applySlippage(
  quotePrice: number,
  side: OrderSide,
  slippagePercent: number,
): SlippageBounds {
  const safeQuote = Number.isFinite(quotePrice) && quotePrice > 0 ? quotePrice : 0;
  const safeSlippage = Number.isFinite(slippagePercent)
    ? Math.min(Math.max(slippagePercent, 0), 100)
    : 0;

  const delta = safeQuote * (safeSlippage / 100);
  const minPrice = Math.max(safeQuote - delta, 0);
  const maxPrice = safeQuote + delta;

  return {
    quotePrice: safeQuote,
    slippagePercent: safeSlippage,
    minPrice,
    maxPrice,
    limitPrice: side === "buy" ? maxPrice : minPrice,
  };
}

/** Minimal provider surface needed for gas estimation. */
export interface GasEstimationProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

/** Gas price preference used to scale the base gas price. */
export type GasPreference = "low" | "standard" | "fast";

/** Result of estimating the cost of a transaction. */
export interface GasEstimate {
  /** Estimated gas units (eth_estimateGas result). */
  gasUnits: bigint;
  /** Total estimated cost in wei (gasUnits * gasPrice). */
  gasCostWei: bigint;
  /** Estimated cost in USD, or null when no price feed is available. */
  gasCostUsd: number | null;
  /** The gas price (in wei) used for the estimate. */
  gasPriceWei: bigint;
  /** Populated when estimation failed; other fields are zeroed. */
  error?: string;
}

const GAS_PREFERENCE_MULTIPLIER: Record<GasPreference, number> = {
  low: 0.9,
  standard: 1,
  fast: 1.25,
};

function toBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && value.length > 0) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Estimate the gas cost of a transaction request.
 *
 * Calls `eth_estimateGas` for the units and `eth_gasPrice` for the current
 * price, applying a multiplier based on the user's gas preference. Errors are
 * caught and surfaced via the returned `error` field so callers can render a
 * fallback without throwing.
 *
 * @param provider  An EIP-1193 style provider.
 * @param txRequest The transaction to estimate (to, data, value, from, …).
 * @param gasPreference Speed preference used to scale the gas price.
 * @param nativeUsdPrice Optional native-token USD price for `gasCostUsd`.
 */
export async function estimateGasCost(
  provider: GasEstimationProvider,
  txRequest: Record<string, unknown>,
  gasPreference: GasPreference = "standard",
  nativeUsdPrice?: number,
): Promise<GasEstimate> {
  const empty: GasEstimate = {
    gasUnits: 0n,
    gasCostWei: 0n,
    gasCostUsd: null,
    gasPriceWei: 0n,
  };

  try {
    const [unitsRaw, priceRaw] = await Promise.all([
      provider.request({ method: "eth_estimateGas", params: [txRequest] }),
      provider.request({ method: "eth_gasPrice" }),
    ]);

    const gasUnits = toBigInt(unitsRaw);
    const basePrice = toBigInt(priceRaw);

    if (gasUnits === null || basePrice === null) {
      return { ...empty, error: "Invalid gas estimation response" };
    }

    const multiplier = GAS_PREFERENCE_MULTIPLIER[gasPreference] ?? 1;
    const gasPriceWei = BigInt(Math.round(Number(basePrice) * multiplier));
    const gasCostWei = gasUnits * gasPriceWei;

    let gasCostUsd: number | null = null;
    if (
      typeof nativeUsdPrice === "number" &&
      Number.isFinite(nativeUsdPrice) &&
      nativeUsdPrice > 0
    ) {
      const nativeAmount = Number(gasCostWei) / 1e18;
      gasCostUsd = nativeAmount * nativeUsdPrice;
    }

    return { gasUnits, gasCostWei, gasCostUsd, gasPriceWei };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to estimate gas";
    return { ...empty, error: message };
  }
}

/**
 * Compute the trading fee for a notional amount given a fee in basis points.
 * 1 bps = 0.01%. Returns the fee amount in the same units as `notional`.
 */
export function computeTradingFee(notional: number, feeBps: number): number {
  const safeNotional = Number.isFinite(notional) && notional > 0 ? notional : 0;
  const safeBps = Number.isFinite(feeBps) && feeBps > 0 ? feeBps : 0;
  return safeNotional * (safeBps / 10_000);
}