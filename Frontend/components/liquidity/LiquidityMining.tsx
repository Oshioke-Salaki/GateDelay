"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Coins,
  Gift,
  Loader2,
  ShieldCheck,
  Sparkles,
  TimerReset,
} from "lucide-react";
import type { Abi } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useToast } from "@/hooks/useToast";

type OpportunityStatus = "live" | "ending-soon" | "paused";

interface OpportunityContractConfig {
  address: `0x${string}`;
  abi: Abi;
  functionName?: string;
  buildArgs?: (enabled: boolean) => readonly unknown[];
}

export interface LiquidityMiningOpportunity {
  id: string;
  name: string;
  pair: string;
  description: string;
  rewardToken: string;
  apr: number;
  rewardMultiplier?: number;
  totalStakedUsd: number;
  userStakeUsd: number;
  minLockDays: number;
  status: OpportunityStatus;
  endDate: string;
  contract?: OpportunityContractConfig;
}

interface MiningRewardState {
  participating: boolean;
  pendingRewards: number;
  claimedRewards: number;
  lastAccruedAt: string;
}

interface LiquidityMiningProps {
  opportunities?: LiquidityMiningOpportunity[];
  storageKey?: string;
  onParticipationChange?: (opportunity: LiquidityMiningOpportunity, enabled: boolean) => Promise<void> | void;
}

const DEFAULT_OPPORTUNITIES: LiquidityMiningOpportunity[] = [
  {
    id: "mantle-flight-usdc",
    name: "Flight Index Boost",
    pair: "FLIGHT / USDC",
    description: "Earn boosted rewards for backing the most active flight delay pools.",
    rewardToken: "GATE",
    apr: 21.4,
    rewardMultiplier: 1.15,
    totalStakedUsd: 1_840_000,
    userStakeUsd: 7_250,
    minLockDays: 14,
    status: "live",
    endDate: "2026-08-14T23:59:59Z",
  },
  {
    id: "weather-mnt",
    name: "Weather Hedger Program",
    pair: "WX / MNT",
    description: "Reward emissions target markets with high hedging demand and faster fee turnover.",
    rewardToken: "MNT",
    apr: 14.9,
    rewardMultiplier: 1,
    totalStakedUsd: 960_000,
    userStakeUsd: 3_900,
    minLockDays: 7,
    status: "live",
    endDate: "2026-07-28T23:59:59Z",
  },
  {
    id: "overnight-yield",
    name: "Overnight Liquidity Sprint",
    pair: "oUSD / USDC",
    description: "Short lock, fast reward cadence, and lower dilution for idle overnight capital.",
    rewardToken: "GATE",
    apr: 9.8,
    rewardMultiplier: 0.95,
    totalStakedUsd: 420_000,
    userStakeUsd: 2_150,
    minLockDays: 3,
    status: "ending-soon",
    endDate: "2026-07-05T23:59:59Z",
  },
];

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatRewardAmount(value: number): string {
  if (value >= 1000) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
  }

  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDefaultRewardState(
  opportunities: LiquidityMiningOpportunity[]
): Record<string, MiningRewardState> {
  return opportunities.reduce<Record<string, MiningRewardState>>((acc, opportunity, index) => {
    acc[opportunity.id] = {
      participating: index === 0,
      pendingRewards: index === 0 ? 12.6 : 0,
      claimedRewards: index === 0 ? 38.25 : 0,
      lastAccruedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    };
    return acc;
  }, {});
}

function loadRewardState(
  storageKey: string,
  opportunities: LiquidityMiningOpportunity[]
): Record<string, MiningRewardState> {
  if (typeof window === "undefined") {
    return getDefaultRewardState(opportunities);
  }

  const fallback = getDefaultRewardState(opportunities);

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Record<string, MiningRewardState>;

    return opportunities.reduce<Record<string, MiningRewardState>>((acc, opportunity) => {
      acc[opportunity.id] = parsed[opportunity.id] ?? fallback[opportunity.id];
      return acc;
    }, {});
  } catch {
    return fallback;
  }
}

function saveRewardState(storageKey: string, state: Record<string, MiningRewardState>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

function calculateRewardRatePerDay(opportunity: LiquidityMiningOpportunity): number {
  const multiplier = opportunity.rewardMultiplier ?? 1;
  return (opportunity.userStakeUsd * (opportunity.apr / 100) * multiplier) / 365;
}

function accrueRewards(
  currentState: MiningRewardState,
  opportunity: LiquidityMiningOpportunity,
  now = Date.now()
): MiningRewardState {
  if (!currentState.participating) {
    return currentState;
  }

  const elapsedMs = Math.max(0, now - new Date(currentState.lastAccruedAt).getTime());
  const rewardsEarned = calculateRewardRatePerDay(opportunity) * (elapsedMs / 86_400_000);

  return {
    ...currentState,
    pendingRewards: currentState.pendingRewards + rewardsEarned,
    lastAccruedAt: new Date(now).toISOString(),
  };
}

function getStatusTone(status: OpportunityStatus): { label: string; color: string; background: string } {
  switch (status) {
    case "ending-soon":
      return {
        label: "Ending Soon",
        color: "#f59e0b",
        background: "rgba(245, 158, 11, 0.14)",
      };
    case "paused":
      return {
        label: "Paused",
        color: "#ef4444",
        background: "rgba(239, 68, 68, 0.14)",
      };
    default:
      return {
        label: "Live",
        color: "#22c55e",
        background: "rgba(34, 197, 94, 0.14)",
      };
  }
}

export default function LiquidityMining({
  opportunities = DEFAULT_OPPORTUNITIES,
  storageKey = "gatedelay-liquidity-mining",
  onParticipationChange,
}: LiquidityMiningProps) {
  const toast = useToast();
  const { isConnected } = useAccount();
  const initialRewardState = useMemo(() => getDefaultRewardState(opportunities), [opportunities]);
  const [rewardState, setRewardState] = useState<Record<string, MiningRewardState>>({});
  const [hasLoaded, setHasLoaded] = useState(false);
  const pendingToggleRef = useRef<{ opportunityId: string; enabled: boolean } | null>(null);

  const { writeContract, data: txHash, isPending: isSigning, error: signError, reset: resetWrite } =
    useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    const loaded = loadRewardState(storageKey, opportunities);
    setRewardState(loaded);
    setHasLoaded(true);
  }, [storageKey, opportunities, initialRewardState]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    const interval = window.setInterval(() => {
      setRewardState((current) => {
        const next = opportunities.reduce<Record<string, MiningRewardState>>((acc, opportunity) => {
          const previous = current[opportunity.id] ?? initialRewardState[opportunity.id];
          acc[opportunity.id] = accrueRewards(previous, opportunity);
          return acc;
        }, {});
        saveRewardState(storageKey, next);
        return next;
      });
    }, 15_000);

    return () => window.clearInterval(interval);
  }, [hasLoaded, initialRewardState, opportunities, storageKey]);

  const applyToggleLocally = useCallback(
    (opportunityId: string, enabled: boolean) => {
      const opportunity = opportunities.find((item) => item.id === opportunityId);
      if (!opportunity) {
        return;
      }

      setRewardState((current) => {
        const previous = current[opportunityId];
        if (!previous) {
          return current;
        }

        const accrued = accrueRewards(previous, opportunity);
        const nextState: MiningRewardState = {
          ...accrued,
          participating: enabled,
          lastAccruedAt: new Date().toISOString(),
        };

        const next = { ...current, [opportunityId]: nextState };
        saveRewardState(storageKey, next);
        return next;
      });
    },
    [opportunities, storageKey]
  );

  useEffect(() => {
    if (!isConfirmed || !pendingToggleRef.current) {
      return;
    }

    const { opportunityId, enabled } = pendingToggleRef.current;
    const opportunity = opportunities.find((item) => item.id === opportunityId);
    applyToggleLocally(opportunityId, enabled);
    toast.success(
      enabled ? "Mining enabled" : "Mining paused",
      opportunity ? `${opportunity.name} participation updated on-chain.` : "Participation updated."
    );
    pendingToggleRef.current = null;
    resetWrite();
  }, [applyToggleLocally, isConfirmed, opportunities, resetWrite, toast]);

  useEffect(() => {
    const txError = signError ?? confirmError;
    if (!txError || !pendingToggleRef.current) {
      return;
    }

    toast.error("Participation update failed", txError.message);
    pendingToggleRef.current = null;
    resetWrite();
  }, [confirmError, resetWrite, signError, toast]);

  const handleToggle = useCallback(
    async (opportunity: LiquidityMiningOpportunity, enabled: boolean) => {
      if (opportunity.status === "paused") {
        toast.warning("Program paused", "This liquidity mining opportunity is not accepting new participants.");
        return;
      }

      if (opportunity.contract) {
        if (!isConnected) {
          toast.error("Wallet not connected", "Connect your wallet to update staking participation.");
          return;
        }

        pendingToggleRef.current = { opportunityId: opportunity.id, enabled };

        try {
          writeContract({
            address: opportunity.contract.address,
            abi: opportunity.contract.abi,
            functionName: opportunity.contract.functionName ?? "setParticipation",
            args: opportunity.contract.buildArgs?.(enabled) ?? [enabled],
          });
          return;
        } catch (error) {
          pendingToggleRef.current = null;
          const message = error instanceof Error ? error.message : "Could not submit wallet action.";
          toast.error("Wallet request failed", message);
          return;
        }
      }

      applyToggleLocally(opportunity.id, enabled);

      try {
        await onParticipationChange?.(opportunity, enabled);
      } catch (error) {
        applyToggleLocally(opportunity.id, !enabled);
        const message = error instanceof Error ? error.message : "Could not update participation.";
        toast.error("Participation update failed", message);
        return;
      }

      toast.success(
        enabled ? "Participation enabled" : "Participation paused",
        `${opportunity.name} is now ${enabled ? "earning rewards" : "inactive"}.`
      );
    },
    [applyToggleLocally, isConnected, onParticipationChange, toast, writeContract]
  );

  const handleClaim = useCallback(
    (opportunity: LiquidityMiningOpportunity) => {
      setRewardState((current) => {
        const previous = current[opportunity.id];
        if (!previous) {
          return current;
        }

        const accrued = accrueRewards(previous, opportunity);
        if (accrued.pendingRewards <= 0) {
          return current;
        }

        const next = {
          ...current,
          [opportunity.id]: {
            ...accrued,
            pendingRewards: 0,
            claimedRewards: accrued.claimedRewards + accrued.pendingRewards,
            lastAccruedAt: new Date().toISOString(),
          },
        };

        saveRewardState(storageKey, next);
        return next;
      });

      toast.success("Rewards claimed", `${opportunity.rewardToken} rewards moved to your balance tracker.`);
    },
    [storageKey, toast]
  );

  const totals = useMemo(() => {
    return opportunities.reduce(
      (acc, opportunity) => {
        const state = rewardState[opportunity.id];
        const accrued = state ? accrueRewards(state, opportunity) : null;
        acc.pendingRewards += accrued?.pendingRewards ?? 0;
        acc.claimedRewards += state?.claimedRewards ?? 0;
        acc.activePrograms += state?.participating ? 1 : 0;
        return acc;
      },
      { pendingRewards: 0, claimedRewards: 0, activePrograms: 0 }
    );
  }, [opportunities, rewardState]);

  if (!hasLoaded) {
    return (
      <div
        className="rounded-2xl p-6 flex items-center justify-center"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--muted)" }} />
      </div>
    );
  }

  return (
    <section
      className="rounded-3xl p-6 space-y-6"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
              Liquidity Mining
            </h2>
          </div>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: "var(--muted)" }}>
            Compare reward programs, verify projected yield, and toggle participation without leaving the pool dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-full lg:min-w-[420px]">
          <div className="rounded-2xl p-4" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
              <Gift className="w-3.5 h-3.5" />
              Pending
            </div>
            <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
              {formatRewardAmount(totals.pendingRewards)}
            </p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
              <ShieldCheck className="w-3.5 h-3.5" />
              Claimed
            </div>
            <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
              {formatRewardAmount(totals.claimedRewards)}
            </p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
              <Coins className="w-3.5 h-3.5" />
              Active Programs
            </div>
            <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
              {totals.activePrograms}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {opportunities.map((opportunity) => {
          const state = rewardState[opportunity.id];
          const accrued = state ? accrueRewards(state, opportunity) : null;
          const rewardRatePerDay = calculateRewardRatePerDay(opportunity);
          const rewardRatePerMonth = rewardRatePerDay * 30;
          const rewardRatePerYear = rewardRatePerDay * 365;
          const shareOfPool =
            opportunity.totalStakedUsd > 0 ? (opportunity.userStakeUsd / opportunity.totalStakedUsd) * 100 : 0;
          const tone = getStatusTone(opportunity.status);
          const isProcessingCurrentToggle =
            !!pendingToggleRef.current && pendingToggleRef.current.opportunityId === opportunity.id;
          const isBusy = isProcessingCurrentToggle && (isSigning || isConfirming);

          return (
            <article
              key={opportunity.id}
              className="rounded-3xl p-5"
              style={{ background: "var(--background)", border: "1px solid var(--border)" }}
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-4 xl:max-w-xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                      {opportunity.name}
                    </h3>
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ color: tone.color, background: tone.background }}
                    >
                      {tone.label}
                    </span>
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ color: "var(--muted)", background: "rgba(148, 163, 184, 0.12)" }}
                    >
                      {opportunity.pair}
                    </span>
                  </div>

                  <p className="text-sm leading-6" style={{ color: "var(--muted)" }}>
                    {opportunity.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
                        Reward APR
                      </p>
                      <p className="mt-1 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                        {opportunity.apr.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
                        Your Stake
                      </p>
                      <p className="mt-1 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                        {formatUsd(opportunity.userStakeUsd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
                        Pool Share
                      </p>
                      <p className="mt-1 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                        {shareOfPool.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
                        Lock
                      </p>
                      <p className="mt-1 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                        {opportunity.minLockDays}d
                      </p>
                    </div>
                  </div>
                </div>

                <div className="w-full xl:max-w-md space-y-4">
                  <div
                    className="rounded-2xl p-4 space-y-3"
                    style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                          Reward Calculation
                        </p>
                        <p className="text-sm mt-1" style={{ color: "var(--foreground)" }}>
                          Based on your staked amount and current APR.
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                          Rewards
                        </p>
                        <p className="font-semibold" style={{ color: "var(--foreground)" }}>
                          {opportunity.rewardToken}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl p-3" style={{ background: "var(--background)" }}>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                          Daily
                        </p>
                        <p className="mt-1 font-semibold" style={{ color: "var(--foreground)" }}>
                          {formatRewardAmount(rewardRatePerDay)}
                        </p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: "var(--background)" }}>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                          Monthly
                        </p>
                        <p className="mt-1 font-semibold" style={{ color: "var(--foreground)" }}>
                          {formatRewardAmount(rewardRatePerMonth)}
                        </p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: "var(--background)" }}>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                          Annual
                        </p>
                        <p className="mt-1 font-semibold" style={{ color: "var(--foreground)" }}>
                          {formatRewardAmount(rewardRatePerYear)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                          Pending rewards
                        </p>
                        <p className="mt-1 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                          {formatRewardAmount(accrued?.pendingRewards ?? 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                          Claimed to date
                        </p>
                        <p className="mt-1 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                          {formatRewardAmount(state?.claimedRewards ?? 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggle(opportunity, !(state?.participating ?? false))}
                      disabled={isBusy}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60"
                      style={{
                        background: state?.participating ? "rgba(239, 68, 68, 0.12)" : "rgba(34, 197, 94, 0.14)",
                        color: state?.participating ? "#ef4444" : "#22c55e",
                        border: `1px solid ${state?.participating ? "#ef444444" : "#22c55e44"}`,
                      }}
                    >
                      {isBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <TimerReset className="w-4 h-4" />
                      )}
                      {state?.participating ? "Pause participation" : "Enable participation"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleClaim(opportunity)}
                      disabled={(accrued?.pendingRewards ?? 0) <= 0}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                      style={{
                        background: "rgba(59, 130, 246, 0.12)",
                        color: "#3b82f6",
                        border: "1px solid rgba(59, 130, 246, 0.25)",
                      }}
                    >
                      <Gift className="w-4 h-4" />
                      Claim tracked rewards
                    </button>

                    <div className="text-sm" style={{ color: "var(--muted)" }}>
                      Ends {formatDate(opportunity.endDate)}
                    </div>
                  </div>

                  <div className="text-xs leading-5" style={{ color: "var(--muted)" }}>
                    Formula: <span style={{ color: "var(--foreground)" }}>
                      stake × APR × multiplier ÷ 365
                    </span>
                    {opportunity.rewardMultiplier ? (
                      <> · Multiplier {opportunity.rewardMultiplier.toFixed(2)}x</>
                    ) : null}
                    {txHash && isProcessingCurrentToggle ? (
                      <> · Pending tx {txHash.slice(0, 10)}…</>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
