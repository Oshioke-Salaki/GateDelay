import { describe, expect, it } from "vitest";
import {
  describePayoutEffect,
  marketRevision,
  parseSettlementPreview,
  previewWarnings,
} from "./settlementPreview";

describe("settlementPreview", () => {
  it("labels payout copy as a projection", () => {
    const text = describePayoutEffect({
      outcome: "YES",
      totalYesStake: 20,
      totalNoStake: 30,
    });
    expect(text).toMatch(/YES wins/);
    expect(text).toMatch(/not a finalized settlement/i);
  });

  it("warns when market state is already resolved", () => {
    expect(previewWarnings("resolved", "YES")[0]).toMatch(/already resolved/i);
  });

  it("detects revision changes used for stale previews", () => {
    const first = marketRevision({ status: "open", totalYesStake: 1, totalNoStake: 2 });
    const next = marketRevision({ status: "open", totalYesStake: 4, totalNoStake: 2 });
    expect(first).not.toBe(next);
  });

  it("rejects payloads that look like finalized settlement results", () => {
    expect(parseSettlementPreview({ kind: "final", projectedWinningOutcome: "YES" })).toBeNull();
  });
});
