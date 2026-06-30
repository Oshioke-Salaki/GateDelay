"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Fuel, Loader2, RefreshCcw, Route, ShieldCheck, Sparkles } from "lucide-react";
import { createPublicClient, formatEther, formatGwei, http } from "viem";
import { mantle } from "viem/chains";

type TradeType = "swap" | "add-liquidity" | "remove-liquidity" | "claim-rewards";
type SpeedTier = "slow" | "standard" | "fast";

interface GasBreakdownItem {
  label: string;
  units: bigint;
}

interface SpeedEstimate {
  gasPrice: bigint;
  totalFeeNative: string;
  totalFeeUsd: number;
  eta: string;
}

export interface TradeGasEstimate {
  tradeType: TradeType;
  gasUnits: bigint;
  blockNumber: bigint;
  speed: SpeedTier;
  estimate: SpeedEstimate;
}

interface TradeGasEstimationProps {
  initialTradeType?: TradeType;
  initialRouteHops?: number;
  initialTradeValueUsd?: number;
  refreshIntervalMs?: number;
  onEstimate?: (estimate: TradeGasEstimate) => void;
}

const publicClient = createPublicClient({
  chain: mantle,
  transport: http(),
});

const SPEED_MULTIPLIERS: Record<SpeedTier, number> = {
  slow: 0.86,
  standard: 1,
  fast: 1.25,
};

const ETA_LABELS: Record<SpeedTier, string> = {
  slow: "~30s",
  standard: "~12s",
  fast: "~6s",
};

const BASE_GAS_UNITS: Record<TradeType, bigint> = {
  swap: 140_000n,
  "add-liquidity": 215_000n,
  "remove-liquidity": 182_000n,
  "claim-rewards": 96_000n,
};

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(value);
}

async function fetchMantleUsdPrice(): Promise<number> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=mantle&vs_currencies=usd",
      { next: { revalidate: 60 } }
    );

    if (!response.ok) {
      return 0;
    }

    const data = (await response.json()) as { mantle?: { usd?: number } };
    return data.mantle?.usd ?? 0;
  } catch {
    return 0;
  }
}

function applyMultiplier(base: bigint, multiplier: number): bigint {
  return (base * BigInt(Math.round(multiplier * 1000))) / 1000n;
}

function buildBreakdown(
  tradeType: TradeType,
  routeHops: number,
  needsApproval: boolean,
  usePermit: boolean,
  crossChainSettlement: boolean
): GasBreakdownItem[] {
  const breakdown: GasBreakdownItem[] = [{ label: "Base execution", units: BASE_GAS_UNITS[tradeType] }];

  if (routeHops > 1) {
    breakdown.push({
      label: `Routing complexity (${routeHops - 1} extra hop${routeHops > 2 ? "s" : ""})`,
      units: BigInt((routeHops - 1) * 34_000),
    });
  }

  if (needsApproval) {
    breakdown.push({
      label: usePermit ? "Permit signature flow" : "ERC-20 approval transaction",
      units: usePermit ? 11_500n : 58_000n,
    });
  }

  if (crossChainSettlement) {
    breakdown.push({
      label: "Cross-chain settlement overhead",
      units: 176_000n,
    });
  }

  breakdown.push({
    label: "Execution buffer",
    units: breakdown.reduce((sum, item) => sum + item.units, 0n) / 10n,
  });

  return breakdown;
}

function buildOptimizationTips(options: {
  routeHops: number;
  needsApproval: boolean;
  usePermit: boolean;
  crossChainSettlement: boolean;
  selectedSpeed: SpeedTier;
  tradeValueUsd: number;
  estimateUsd: number;
}): string[] {
  const tips: string[] = [];

  if (options.needsApproval && !options.usePermit) {
    tips.push("Use permit or existing allowance to avoid paying for a separate approval transaction.");
  }

  if (options.routeHops > 2) {
    tips.push("Reducing route hops can cut routing overhead and reduce execution variance.");
  }

  if (options.crossChainSettlement) {
    tips.push("Bridging ahead of time usually costs less than bundling bridge settlement into the trade path.");
  }

  if (options.selectedSpeed === "fast") {
    tips.push("Fast mode confirms sooner, but standard speed is often the better cost-to-time tradeoff.");
  }

  if (options.tradeValueUsd > 0 && options.estimateUsd > options.tradeValueUsd * 0.02) {
    tips.push("Gas is more than 2% of trade value, so batching or waiting for quieter blocks may help.");
  }

  if (tips.length === 0) {
    tips.push("Current setup is efficient. Keep approvals warm and reuse routes to maintain low gas.");
  }

  return tips;
}

function speedTone(speed: SpeedTier): { color: string; background: string } {
  switch (speed) {
    case "slow":
      return { color: "#f59e0b", background: "rgba(245, 158, 11, 0.12)" };
    case "fast":
      return { color: "#22c55e", background: "rgba(34, 197, 94, 0.12)" };
    default:
      return { color: "#3b82f6", background: "rgba(59, 130, 246, 0.12)" };
  }
}

export default function TradeGasEstimation({
  initialTradeType = "swap",
  initialRouteHops = 2,
  initialTradeValueUsd = 2_500,
  refreshIntervalMs = 12_000,
  onEstimate,
}: TradeGasEstimationProps) {
  const [tradeType, setTradeType] = useState<TradeType>(initialTradeType);
  const [routeHops, setRouteHops] = useState<number>(initialRouteHops);
  const [tradeValueUsd, setTradeValueUsd] = useState<number>(initialTradeValueUsd);
  const [needsApproval, setNeedsApproval] = useState(true);
  const [usePermit, setUsePermit] = useState(false);
  const [crossChainSettlement, setCrossChainSettlement] = useState(false);
  const [selectedSpeed, setSelectedSpeed] = useState<SpeedTier>("standard");
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const [blockNumber, setBlockNumber] = useState<bigint>(0n);
  const [tokenUsd, setTokenUsd] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshEstimates = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const [feeData, latestBlock, mntUsd] = await Promise.all([
        publicClient.estimateFeesPerGas(),
        publicClient.getBlockNumber(),
        fetchMantleUsdPrice(),
      ]);

      const baseGasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 1_000_000n;
      setGasPrice(baseGasPrice);
      setBlockNumber(latestBlock);
      setTokenUsd(mntUsd);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not refresh gas estimates.");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshEstimates();
  }, [refreshEstimates]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshEstimates();
    }, refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [refreshEstimates, refreshIntervalMs]);

  const breakdown = useMemo(() => {
    return buildBreakdown(tradeType, routeHops, needsApproval, usePermit, crossChainSettlement);
  }, [crossChainSettlement, needsApproval, routeHops, tradeType, usePermit]);

  const totalGasUnits = useMemo(() => {
    return breakdown.reduce((sum, item) => sum + item.units, 0n);
  }, [breakdown]);

  const speedEstimates = useMemo(() => {
    if (!gasPrice) {
      return null;
    }

    const entries = (Object.keys(SPEED_MULTIPLIERS) as SpeedTier[]).map((speed) => {
      const adjustedGasPrice = applyMultiplier(gasPrice, SPEED_MULTIPLIERS[speed]);
      const feeWei = adjustedGasPrice * totalGasUnits;
      const feeNative = formatEther(feeWei);
      const feeUsd = tokenUsd > 0 ? Number(feeNative) * tokenUsd : 0;

      return [
        speed,
        {
          gasPrice: adjustedGasPrice,
          totalFeeNative: feeNative,
          totalFeeUsd: feeUsd,
          eta: ETA_LABELS[speed],
        },
      ] as const;
    });

    return Object.fromEntries(entries) as Record<SpeedTier, SpeedEstimate>;
  }, [gasPrice, tokenUsd, totalGasUnits]);

  const selectedEstimate = speedEstimates?.[selectedSpeed] ?? null;

  const optimizationTips = useMemo(() => {
    return buildOptimizationTips({
      routeHops,
      needsApproval,
      usePermit,
      crossChainSettlement,
      selectedSpeed,
      tradeValueUsd,
      estimateUsd: selectedEstimate?.totalFeeUsd ?? 0,
    });
  }, [
    crossChainSettlement,
    needsApproval,
    routeHops,
    selectedEstimate?.totalFeeUsd,
    selectedSpeed,
    tradeValueUsd,
    usePermit,
  ]);

  useEffect(() => {
    if (!selectedEstimate) {
      return;
    }

    onEstimate?.({
      tradeType,
      gasUnits: totalGasUnits,
      blockNumber,
      speed: selectedSpeed,
      estimate: selectedEstimate,
    });
  }, [blockNumber, onEstimate, selectedEstimate, selectedSpeed, totalGasUnits, tradeType]);

  return (
    <section
      className="rounded-3xl p-6 space-y-6"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Fuel className="w-5 h-5 text-orange-500" />
            <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
              Trade Gas Estimation
            </h2>
          </div>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: "var(--muted)" }}>
            Estimate gas by trade path, inspect cost breakdowns, and adjust the order before committing on-chain.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshEstimates()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            color: "#ea580c",
            background: "rgba(234, 88, 12, 0.12)",
            border: "1px solid rgba(234, 88, 12, 0.24)",
          }}
        >
          {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Refresh quotes
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div
            className="rounded-2xl p-4 space-y-4"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            <div>
              <label className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                Trade type
              </label>
              <select
                value={tradeType}
                onChange={(event) => setTradeType(event.target.value as TradeType)}
                className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                <option value="swap">Swap</option>
                <option value="add-liquidity">Add Liquidity</option>
                <option value="remove-liquidity">Remove Liquidity</option>
                <option value="claim-rewards">Claim Rewards</option>
              </select>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                Trade value (USD)
              </label>
              <input
                type="number"
                min={0}
                value={tradeValueUsd}
                onChange={(event) => setTradeValueUsd(Number(event.target.value) || 0)}
                className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                Route hops
              </label>
              <input
                type="range"
                min={1}
                max={4}
                step={1}
                value={routeHops}
                onChange={(event) => setRouteHops(Number(event.target.value))}
                className="mt-3 w-full"
              />
              <div className="mt-2 text-sm" style={{ color: "var(--foreground)" }}>
                {routeHops} hop{routeHops === 1 ? "" : "s"}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {[
                {
                  checked: needsApproval,
                  label: "Token approval required",
                  onChange: setNeedsApproval,
                },
                {
                  checked: usePermit,
                  label: "Use permit flow",
                  onChange: setUsePermit,
                },
                {
                  checked: crossChainSettlement,
                  label: "Cross-chain settlement",
                  onChange: setCrossChainSettlement,
                },
              ].map((item) => (
                <label
                  key={item.label}
                  className="inline-flex items-center justify-between rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  {item.label}
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(event) => item.onChange(event.target.checked)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div
            className="rounded-2xl p-4"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                Optimization Tips
              </p>
            </div>
            <div className="mt-3 space-y-2">
              {optimizationTips.map((tip) => (
                <div key={tip} className="flex gap-2 text-sm" style={{ color: "var(--muted)" }}>
                  <ShieldCheck className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {(Object.keys(SPEED_MULTIPLIERS) as SpeedTier[]).map((speed) => {
              const estimate = speedEstimates?.[speed];
              const tone = speedTone(speed);
              const selected = speed === selectedSpeed;

              return (
                <button
                  key={speed}
                  type="button"
                  onClick={() => setSelectedSpeed(speed)}
                  className="rounded-2xl p-4 text-left"
                  style={{
                    background: selected ? tone.background : "var(--background)",
                    border: `1px solid ${selected ? tone.color : "var(--border)"}`,
                  }}
                >
                  <p className="text-sm font-semibold capitalize" style={{ color: tone.color }}>
                    {speed}
                  </p>
                  <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                    Gas price
                  </p>
                  <p className="mt-1 font-semibold" style={{ color: "var(--foreground)" }}>
                    {estimate ? `${formatGwei(estimate.gasPrice)} gwei` : "--"}
                  </p>
                  <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                    Estimated cost
                  </p>
                  <p className="mt-1 font-semibold" style={{ color: "var(--foreground)" }}>
                    {estimate ? formatUsd(estimate.totalFeeUsd) : "--"}
                  </p>
                  <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                    Confirmation
                  </p>
                  <p className="mt-1 font-semibold" style={{ color: "var(--foreground)" }}>
                    {estimate?.eta ?? "--"}
                  </p>
                </button>
              );
            })}
          </div>

          <div
            className="rounded-2xl p-5 space-y-4"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Route className="w-4 h-4 text-orange-500" />
                  <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                    Gas Breakdown
                  </h3>
                </div>
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                  Every line item rolls up into the total gas units shown below.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                  Total Units
                </p>
                <p className="mt-1 text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
                  {totalGasUnits.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {breakdown.map((item) => {
                const feeForItem =
                  selectedEstimate ? formatUsd(Number(formatEther(item.units * selectedEstimate.gasPrice)) * tokenUsd) : "--";

                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                    style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                  >
                    <div>
                      <p className="font-medium" style={{ color: "var(--foreground)" }}>
                        {item.label}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                        {item.units.toLocaleString()} gas
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        {feeForItem}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div
              className="rounded-2xl p-5"
              style={{ background: "var(--background)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                Selected Estimate
              </p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
                {selectedEstimate ? formatUsd(selectedEstimate.totalFeeUsd) : "--"}
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                {selectedEstimate ? `${selectedEstimate.totalFeeNative} MNT` : "Waiting for network quote"}
              </p>
            </div>
            <div
              className="rounded-2xl p-5"
              style={{ background: "var(--background)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                Network Context
              </p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
                Block {blockNumber > 0n ? blockNumber.toLocaleString() : "--"}
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Base gas {gasPrice ? `${formatGwei(gasPrice)} gwei` : "loading"}
              </p>
            </div>
          </div>

          {error && (
            <div
              className="rounded-2xl p-4 flex gap-3"
              style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.24)" }}
            >
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm" style={{ color: "#ef4444" }}>
                {error}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
