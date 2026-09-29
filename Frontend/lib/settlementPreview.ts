export type ResolutionOutcome = "YES" | "NO" | "VOID";

export interface SettlementPreview {
  /** Always a projection — never a finalized settlement result. */
  kind: "projection";
  marketId: string;
  marketStatus: string;
  projectedWinningOutcome: ResolutionOutcome;
  /** Human-readable effect using the market's current stake totals. */
  projectedPayoutEffect: string;
  totalPool: number | null;
  warnings: string[];
  /** Snapshot identity used to detect stale market state before submit. */
  marketRevision: string;
  source: "backend" | "market-snapshot" | "unavailable";
  available: boolean;
}

export function marketRevision(input: {
  status: string;
  totalYesStake: number;
  totalNoStake: number;
}): string {
  return `${input.status}:${input.totalYesStake}:${input.totalNoStake}`;
}

export function describePayoutEffect(args: {
  outcome: ResolutionOutcome;
  totalYesStake: number;
  totalNoStake: number;
}): string {
  const totalPool = args.totalYesStake + args.totalNoStake;
  if (!Number.isFinite(totalPool)) {
    return "Projected payout is unavailable for this market snapshot.";
  }
  if (args.outcome === "VOID") {
    return `Projected effect: void the market and return the ${totalPool} unit pool. This is not a finalized settlement.`;
  }
  const winnerStake =
    args.outcome === "YES" ? args.totalYesStake : args.totalNoStake;
  return `Projected effect: ${args.outcome} wins; the ${totalPool} unit pool is allocated to ${args.outcome} holders (current ${args.outcome} stake ${winnerStake}). This is not a finalized settlement.`;
}

export function previewWarnings(status: string, outcome: ResolutionOutcome): string[] {
  const warnings: string[] = [];
  const normalized = status.toLowerCase();
  if (normalized === "resolved" || normalized === "settled") {
    warnings.push("This market is already resolved. Submitting again may be rejected.");
  }
  if (normalized === "disputed") {
    warnings.push("This market is disputed. Settlement may be blocked until the dispute is reviewed.");
  }
  if (normalized === "closed" && outcome !== "VOID") {
    warnings.push("Market is closed; confirm the selected outcome still matches the latest state.");
  }
  return warnings;
}

export function parseSettlementPreview(payload: unknown): SettlementPreview | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  if (value.kind !== "projection") return null;
  if (typeof value.projectedWinningOutcome !== "string") return null;
  if (typeof value.marketStatus !== "string") return null;
  if (typeof value.projectedPayoutEffect !== "string") return null;
  if (typeof value.marketId !== "string") return null;
  if (typeof value.marketRevision !== "string") return null;
  return {
    kind: "projection",
    marketId: value.marketId,
    marketStatus: value.marketStatus,
    projectedWinningOutcome: value.projectedWinningOutcome as ResolutionOutcome,
    projectedPayoutEffect: value.projectedPayoutEffect,
    totalPool: typeof value.totalPool === "number" ? value.totalPool : null,
    warnings: Array.isArray(value.warnings)
      ? value.warnings.filter((item): item is string => typeof item === "string")
      : [],
    marketRevision: value.marketRevision,
    source:
      value.source === "backend" || value.source === "market-snapshot"
        ? value.source
        : "unavailable",
    available: value.available === true,
  };
}
