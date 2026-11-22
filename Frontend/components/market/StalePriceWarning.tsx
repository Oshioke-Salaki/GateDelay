"use client";

import { useStalePriceDetection, STALE_PRICE_THRESHOLD_MS } from "@/hooks/useStalePriceDetection";

interface StalePriceWarningProps {
  marketId: string;
  /** Custom staleness threshold in ms. Defaults to STALE_PRICE_THRESHOLD_MS (30 s). */
  thresholdMs?: number;
  /**
   * "banner" (default) — full-width row, suitable above a trading panel.
   * "inline" — compact single-line chip, suitable next to a price figure.
   */
  variant?: "banner" | "inline";
  className?: string;
}

/**
 * Renders a warning when the live price for a market hasn't updated recently.
 * Returns null when the price is fresh or no price has ever arrived
 * (the WebSocket provider handles the disconnected state separately).
 */
export default function StalePriceWarning({
  marketId,
  thresholdMs = STALE_PRICE_THRESHOLD_MS,
  variant = "banner",
  className = "",
}: StalePriceWarningProps) {
  const { isStale, ageSeconds } = useStalePriceDetection(marketId, thresholdMs);

  if (!isStale) return null;

  const ageLabel =
    ageSeconds === null
      ? "price data unavailable"
      : ageSeconds >= 60
      ? `${Math.floor(ageSeconds / 60)}m ${ageSeconds % 60}s out of date`
      : `${ageSeconds}s out of date`;

  if (variant === "inline") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
        style={{
          background: "#f59e0b18",
          border: "1px solid #f59e0b44",
          color: "#f59e0b",
        }}
        role="status"
        title={`Live price is ${ageLabel}. Refresh or wait for an update before trading.`}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M10 2L18.66 17H1.34L10 2z"
            fill="currentColor"
            opacity="0.2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M10 8v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="10" cy="14" r="0.8" fill="currentColor" />
        </svg>
        Stale · {ageLabel}
      </span>
    );
  }

  // banner variant
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${className}`}
      style={{
        background: "#f59e0b14",
        border: "1px solid #f59e0b55",
        color: "#92400e",
      }}
    >
      {/* Warning icon */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }}
      >
        <path
          d="M10 2L18.66 17H1.34L10 2z"
          fill="currentColor"
          opacity="0.2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M10 8v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="10" cy="14.5" r="0.8" fill="currentColor" />
      </svg>

      <div>
        <p className="font-semibold" style={{ color: "#78350f" }}>
          Price data may be outdated
        </p>
        <p className="mt-0.5 text-xs" style={{ color: "#92400e" }}>
          The last known price is <strong>{ageLabel}</strong>. This quote may
          not reflect current market conditions — verify before placing a trade.
        </p>
      </div>
    </div>
  );
}
