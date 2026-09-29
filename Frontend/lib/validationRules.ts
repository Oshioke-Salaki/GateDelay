/**
 * VALIDATION RULES
 * Single source of truth for all client-side field validation.
 * Values mirror the backend TRADE_LIMITS constants in
 * Backend/services/tradeValidator.js and the Joi schemas defined there,
 * so changes to backend limits only need to be reflected here.
 */

// ─── Trade Limits (mirrors Backend/services/tradeValidator.js TRADE_LIMITS) ──

export const TRADE_LIMITS = {
  MIN_TRADE_AMOUNT: 0.0001,
  MAX_TRADE_AMOUNT: 1_000_000,
  MIN_TRADE_PRICE: 0.00000001,
  MAX_TRADE_PRICE: 10_000_000,
  /** Maximum allowed slippage for market orders, in percent */
  MAX_SLIPPAGE_PERCENT: 5,
} as const;

// ─── Flight / Market Creation Rules ──────────────────────────────────────────

export const MARKET_RULES = {
  TITLE_MIN_LENGTH: 10,
  DESCRIPTION_MIN_LENGTH: 20,
  /** IATA flight-number pattern: 2 letters followed by 1–4 digits */
  FLIGHT_NUMBER_PATTERN: /^[A-Z]{2}\d{1,4}$/i,
  /** EVM address: 0x followed by exactly 40 hex chars */
  EVM_ADDRESS_PATTERN: /^0x[0-9a-fA-F]{40}$/,
  MIN_LIQUIDITY_USDC: 1,
  /** Suggested minimum liquidity to attract meaningful trading */
  SUGGESTED_LIQUIDITY_USDC: 100,
} as const;

// ─── Shared Validation Helpers ────────────────────────────────────────────────

/**
 * Returns true when the value is a finite number within [min, max].
 * Returns an error string otherwise.
 */
export function validateNumericRange(
  value: number | string,
  min: number,
  max: number,
  fieldLabel = "Value",
): true | string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n) || !isFinite(n)) return `${fieldLabel} must be a valid number`;
  if (n < min) return `${fieldLabel} must be at least ${min}`;
  if (n > max) return `${fieldLabel} must not exceed ${max.toLocaleString()}`;
  return true;
}

/**
 * Validates trade amount against backend TRADE_LIMITS.
 * Returns true on success or an error string.
 */
export function validateTradeAmount(value: number | string): true | string {
  return validateNumericRange(
    value,
    TRADE_LIMITS.MIN_TRADE_AMOUNT,
    TRADE_LIMITS.MAX_TRADE_AMOUNT,
    "Amount",
  );
}

/**
 * Validates limit-order price against backend TRADE_LIMITS.
 * Returns true on success or an error string.
 */
export function validateLimitPrice(value: number | string): true | string {
  return validateNumericRange(
    value,
    TRADE_LIMITS.MIN_TRADE_PRICE,
    TRADE_LIMITS.MAX_TRADE_PRICE,
    "Price",
  );
}

/**
 * Validates that a resolution deadline is strictly in the future
 * and, optionally, after a given flight date.
 */
export function validateResolutionDeadline(
  deadlineStr: string,
  flightDateStr?: string,
): true | string {
  const deadline = new Date(deadlineStr);
  if (isNaN(deadline.getTime())) return "Resolution deadline must be a valid date";
  if (deadline <= new Date()) return "Resolution deadline must be in the future";
  if (flightDateStr) {
    const flight = new Date(flightDateStr);
    if (!isNaN(flight.getTime()) && deadline <= flight) {
      return "Resolution deadline must be after the flight date";
    }
  }
  return true;
}

/**
 * Validates that two outcome labels are non-empty and distinct.
 */
export function validateOutcomesDistinct(
  yes: string,
  no: string,
): true | string {
  if (!yes.trim() || !no.trim()) return "Both outcomes are required";
  if (yes.trim().toLowerCase() === no.trim().toLowerCase())
    return "YES and NO outcomes must be different";
  return true;
}

/**
 * Validates minimum liquidity value.
 * Returns a warning string (not an error) when below the suggested amount.
 */
export function validateMinLiquidity(value: number | string): {
  error: true | string;
  warning?: string;
} {
  const n = typeof value === "string" ? parseFloat(value) : value;
  const error = validateNumericRange(
    n,
    MARKET_RULES.MIN_LIQUIDITY_USDC,
    Number.MAX_SAFE_INTEGER,
    "Minimum liquidity",
  );
  if (error !== true) return { error };
  const warning =
    n < MARKET_RULES.SUGGESTED_LIQUIDITY_USDC
      ? `Markets with less than ${MARKET_RULES.SUGGESTED_LIQUIDITY_USDC} USDC liquidity may see poor trading activity`
      : undefined;
  return { error: true, warning };
}

/**
 * Returns a slippage warning if the order is a market order and the
 * user's configured slippage tolerance is above the backend maximum.
 */
export function getSlippageWarning(
  orderType: "market" | "limit",
  slippagePct: number,
): string | null {
  if (orderType !== "market") return null;
  if (slippagePct > TRADE_LIMITS.MAX_SLIPPAGE_PERCENT) {
    return `Slippage tolerance (${slippagePct}%) exceeds the recommended maximum of ${TRADE_LIMITS.MAX_SLIPPAGE_PERCENT}%. Your order may execute at a significantly different price.`;
  }
  return null;
}
