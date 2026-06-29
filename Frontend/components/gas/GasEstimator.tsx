"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPublicClient, http, formatGwei, formatEther } from "viem";
import { mantle } from "viem/chains";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GasSpeed = "slow" | "standard" | "fast";

export interface GasEstimate {
  /** Gas price in wei */
  gasPrice: bigint;
  /** Estimated fee in ETH (as a formatted string) */
  feeEth: string;
  /** Estimated fee in USD */
  feeUsd: number;
  /** Estimated confirmation time label */
  time: string;
}

export interface GasEstimates {
  slow: GasEstimate;
  standard: GasEstimate;
  fast: GasEstimate;
  /** Block number these estimates were fetched at */
  blockNumber: bigint;
  /** Timestamp of last fetch */
  fetchedAt: number;
}

export interface GasEstimatorProps {
  /**
   * Gas units the transaction will consume.
   * Defaults to 150_000 (typical ERC-20 interaction / market trade).
   */
  gasLimit?: bigint;
  /**
   * Called when the user selects a speed tier.
   * Receives the selected speed and its estimate.
   */
  onSelect?: (speed: GasSpeed, estimate: GasEstimate) => void;
  /** Pre-selected speed tier. Defaults to "standard". */
  defaultSpeed?: GasSpeed;
  /** Refresh interval in ms. Defaults to 12 000 (≈ 1 Mantle block). */
  refreshInterval?: number;
  /** Whether to show the component in compact (single-row) mode */
  compact?: boolean;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_GAS_LIMIT = 150_000n;
const DEFAULT_REFRESH_MS = 12_000;

/** Speed multipliers applied to the base fee to derive tiers */
const SPEED_MULTIPLIERS: Record<GasSpeed, number> = {
  slow: 0.85,
  standard: 1.0,
  fast: 1.25,
};

const SPEED_LABELS: Record<GasSpeed, string> = {
  slow: "Slow",
  standard: "Standard",
  fast: "Fast",
};

const SPEED_TIMES: Record<GasSpeed, string> = {
  slow: "~30s",
  standard: "~12s",
  fast: "~6s",
};

const SPEED_COLORS: Record<GasSpeed, string> = {
  slow: "#f59e0b",
  standard: "#3b82f6",
  fast: "#22c55e",
};

// ─── Viem client (Mantle) ─────────────────────────────────────────────────────

const publicClient = createPublicClient({
  chain: mantle,
  transport: http(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch MNT/USD price from CoinGecko public API.
 * Falls back to 0 on error so the component still renders without USD.
 */
async function fetchMntUsdPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=mantle&vs_currencies=usd",
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return 0;
    const json = await res.json();
    return json?.mantle?.usd ?? 0;
  } catch {
    return 0;
  }
}

function applyMultiplier(base: bigint, multiplier: number): bigint {
  // Use integer arithmetic: multiply by 1000, then divide
  return (base * BigInt(Math.round(multiplier * 1000))) / 1000n;
}

function buildEstimate(
  gasPrice: bigint,
  gasLimit: bigint,
  mntUsd: number,
  speed: GasSpeed
): GasEstimate {
  const feeWei = gasPrice * gasLimit;
  const feeEth = formatEther(feeWei);
  const feeUsd = mntUsd > 0 ? parseFloat(feeEth) * mntUsd : 0;
  return {
    gasPrice,
    feeEth,
    feeUsd,
    time: SPEED_TIMES[speed],
  };
}

async function fetchEstimates(gasLimit: bigint): Promise<GasEstimates> {
  const [feeData, blockNumber, mntUsd] = await Promise.all([
    publicClient.estimateFeesPerGas(),
    publicClient.getBlockNumber(),
    fetchMntUsdPrice(),
  ]);

  // Use maxFeePerGas if EIP-1559, otherwise fall back to gasPrice
  const baseGasPrice =
    feeData.maxFeePerGas ?? feeData.gasPrice ?? 1_000_000n;

  const speeds: GasSpeed[] = ["slow", "standard", "fast"];
  const estimates = Object.fromEntries(
    speeds.map((speed) => {
      const gasPrice = applyMultiplier(baseGasPrice, SPEED_MULTIPLIERS[speed]);
      return [speed, buildEstimate(gasPrice, gasLimit, mntUsd, speed)];
    })
  ) as Record<GasSpeed, GasEstimate>;

  return {
    ...estimates,
    blockNumber,
    fetchedAt: Date.now(),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SpeedIcon({ speed }: { speed: GasSpeed }) {
  const color = SPEED_COLORS[speed];
  if (speed === "slow") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" />
        <path d="M8 5v3l2 1.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (speed === "standard") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 8h10M9 5l4 3-4 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  // fast
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8h8M7 5l4 3-4 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 8h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <motion.svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      animate={spinning ? { rotate: 360 } : { rotate: 0 }}
      transition={spinning ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}
    >
      <path
        d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M12 2v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </motion.svg>
  );
}

function GasSkeletonRow() {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
      style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        <div className="w-3.5 h-3.5 rounded-full animate-pulse" style={{ background: "var(--border)" }} />
        <div className="w-14 h-3 rounded animate-pulse" style={{ background: "var(--border)" }} />
      </div>
      <div className="flex items-center gap-3">
        <div className="w-20 h-3 rounded animate-pulse" style={{ background: "var(--border)" }} />
        <div className="w-12 h-3 rounded animate-pulse" style={{ background: "var(--border)" }} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GasEstimator({
  gasLimit = DEFAULT_GAS_LIMIT,
  onSelect,
  defaultSpeed = "standard",
  refreshInterval = DEFAULT_REFRESH_MS,
  compact = false,
  className = "",
}: GasEstimatorProps) {
  const [estimates, setEstimates] = useState<GasEstimates | null>(null);
  const [selected, setSelected] = useState<GasSpeed>(defaultSpeed);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      setError(null);
      try {
        const data = await fetchEstimates(gasLimit);
        setEstimates(data);
        setSecondsAgo(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch gas estimates");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [gasLimit]
  );

  // Initial load + auto-refresh
  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(), refreshInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load, refreshInterval]);

  // "X seconds ago" ticker
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setSecondsAgo((s) => s + 1);
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  function handleSelect(speed: GasSpeed) {
    setSelected(speed);
    if (estimates && onSelect) {
      onSelect(speed, estimates[speed]);
    }
  }

  // Notify parent when estimates update (keep selected in sync)
  useEffect(() => {
    if (estimates && onSelect) {
      onSelect(selected, estimates[selected]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimates]);

  const speeds: GasSpeed[] = ["slow", "standard", "fast"];

  // ── Compact mode ────────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 flex-wrap ${className}`}
        aria-label="Gas fee estimate"
      >
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          Gas:
        </span>
        {loading ? (
          <div className="w-24 h-3 rounded animate-pulse" style={{ background: "var(--border)" }} />
        ) : error ? (
          <span className="text-xs" style={{ color: "#ef4444" }}>Unavailable</span>
        ) : estimates ? (
          <>
            {speeds.map((speed) => {
              const est = estimates[speed];
              const isSelected = selected === speed;
              return (
                <button
                  key={speed}
                  onClick={() => handleSelect(speed)}
                  className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-all"
                  style={{
                    background: isSelected ? SPEED_COLORS[speed] + "22" : "transparent",
                    border: `1px solid ${isSelected ? SPEED_COLORS[speed] + "66" : "var(--border)"}`,
                    color: isSelected ? SPEED_COLORS[speed] : "var(--muted)",
                  }}
                  aria-pressed={isSelected}
                  aria-label={`${SPEED_LABELS[speed]} gas: ${est.feeEth} MNT`}
                >
                  <SpeedIcon speed={speed} />
                  {est.feeUsd > 0
                    ? `$${est.feeUsd < 0.01 ? "<0.01" : est.feeUsd.toFixed(2)}`
                    : `${parseFloat(est.feeEth).toFixed(6)} MNT`}
                </button>
              );
            })}
          </>
        ) : null}
      </div>
    );
  }

  // ── Full mode ───────────────────────────────────────────────────────────────
  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      aria-label="Gas fee estimator"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          {/* Gas pump icon */}
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2" y="4" width="8" height="10" rx="1.5" stroke="var(--muted)" strokeWidth="1.4" />
            <path d="M6 4V2h2v2" stroke="var(--muted)" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M10 6h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-2" stroke="var(--muted)" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M4 9h4" stroke="var(--muted)" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Gas Estimate
          </span>
          {estimates && (
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              · {secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}
            </span>
          )}
        </div>

        <button
          onClick={() => load(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
          aria-label="Refresh gas estimates"
        >
          <RefreshIcon spinning={refreshing} />
          Refresh
        </button>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {/* Gas limit info */}
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Gas limit
          </span>
          <span className="text-xs font-mono" style={{ color: "var(--foreground)" }}>
            {gasLimit.toLocaleString()} units
          </span>
        </div>

        {/* Speed rows */}
        {loading ? (
          <>
            <GasSkeletonRow />
            <GasSkeletonRow />
            <GasSkeletonRow />
          </>
        ) : error ? (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{ background: "#ef444418", border: "1px solid #ef444444", color: "#ef4444" }}
          >
            <p className="font-medium">Could not fetch gas prices</p>
            <p className="text-xs mt-0.5" style={{ color: "#ef4444aa" }}>{error}</p>
          </div>
        ) : estimates ? (
          <AnimatePresence initial={false}>
            {speeds.map((speed) => {
              const est = estimates[speed];
              const isSelected = selected === speed;
              const color = SPEED_COLORS[speed];

              return (
                <motion.button
                  key={speed}
                  layout
                  onClick={() => handleSelect(speed)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
                  style={{
                    background: isSelected ? color + "14" : "var(--background)",
                    border: `1px solid ${isSelected ? color + "55" : "var(--border)"}`,
                    outline: "none",
                  }}
                  whileTap={{ scale: 0.985 }}
                  aria-pressed={isSelected}
                  aria-label={`${SPEED_LABELS[speed]}: ${est.feeEth} MNT, ${est.time}`}
                >
                  {/* Left: icon + label + time */}
                  <div className="flex items-center gap-2 min-w-0">
                    <SpeedIcon speed={speed} />
                    <div>
                      <p
                        className="text-xs font-semibold leading-none"
                        style={{ color: isSelected ? color : "var(--foreground)" }}
                      >
                        {SPEED_LABELS[speed]}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                        {est.time}
                      </p>
                    </div>
                  </div>

                  {/* Right: fee amounts */}
                  <div className="text-right shrink-0">
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={est.feeEth}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.2 }}
                        className="text-xs font-semibold font-mono leading-none"
                        style={{ color: isSelected ? color : "var(--foreground)" }}
                      >
                        {parseFloat(est.feeEth).toFixed(6)} MNT
                      </motion.p>
                    </AnimatePresence>
                    {est.feeUsd > 0 && (
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={est.feeUsd}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-xs mt-0.5"
                          style={{ color: "var(--muted)" }}
                        >
                          ≈ ${est.feeUsd < 0.01 ? "<$0.01" : `$${est.feeUsd.toFixed(3)}`}
                        </motion.p>
                      </AnimatePresence>
                    )}
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                      {formatGwei(est.gasPrice)} Gwei
                    </p>
                  </div>

                  {/* Selected checkmark */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: color }}
                    >
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                        <path d="M1.5 4l2 2 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        ) : null}

        {/* Footer: block number */}
        {estimates && !error && (
          <div className="flex items-center justify-between pt-1 px-1">
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              Block #{estimates.blockNumber.toString()}
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              Auto-refreshes every {refreshInterval / 1000}s
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
