import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettlementResultPreview from "./SettlementResultPreview";

const PREVIEW = {
  kind: "projection" as const,
  marketId: "m-1",
  marketStatus: "open",
  projectedWinningOutcome: "YES",
  projectedPayoutEffect:
    "Projected effect: YES wins; the 30 unit pool is allocated to YES holders (current YES stake 10). This is not a finalized settlement.",
  totalPool: 30,
  warnings: [],
  marketRevision: "open:10:20",
  source: "backend" as const,
  available: true,
};

describe("SettlementResultPreview", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const outcome = new URL(url, "http://localhost").searchParams.get("outcome");
        return {
          ok: true,
          json: async () => ({
            ...PREVIEW,
            projectedWinningOutcome: outcome,
            projectedPayoutEffect: `Projected effect: ${outcome} wins. This is not a finalized settlement.`,
            marketRevision: "open:10:20",
          }),
        };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows projected winner, payout effect, and current market status", async () => {
    render(
      <SettlementResultPreview
        marketId="m-1"
        marketTitle="Will AA123 be delayed?"
        marketStatus="open"
        totalYesStake={10}
        totalNoStake={20}
        selectedOutcome="YES"
        onOutcomeChange={() => {}}
      />,
    );

    expect(await screen.findByTestId("preview-winning-outcome")).toHaveTextContent("YES");
    expect(screen.getByTestId("preview-payout-effect")).toHaveTextContent(/not a finalized settlement/i);
    expect(screen.getByTestId("preview-market-status")).toHaveTextContent("open");
    expect(screen.getByText(/projected settlement — not finalized/i)).toBeInTheDocument();
  });

  it("requests a new preview when the selected resolution changes", async () => {
    const user = userEvent.setup();
    const onOutcomeChange = vi.fn();

    const { rerender } = render(
      <SettlementResultPreview
        marketId="m-1"
        marketTitle="Will AA123 be delayed?"
        marketStatus="open"
        totalYesStake={10}
        totalNoStake={20}
        selectedOutcome="YES"
        onOutcomeChange={onOutcomeChange}
      />,
    );

    expect(await screen.findByTestId("preview-winning-outcome")).toHaveTextContent("YES");
    await user.click(screen.getByLabelText("NO"));
    expect(onOutcomeChange).toHaveBeenCalledWith("NO");

    rerender(
      <SettlementResultPreview
        marketId="m-1"
        marketTitle="Will AA123 be delayed?"
        marketStatus="open"
        totalYesStake={10}
        totalNoStake={20}
        selectedOutcome="NO"
        onOutcomeChange={onOutcomeChange}
      />,
    );

    expect(await screen.findByTestId("preview-winning-outcome")).toHaveTextContent("NO");
    expect(fetch).toHaveBeenCalled();
    const urls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    expect(urls.some((url) => url.includes("outcome=NO"))).toBe(true);
  });

  it("handles unavailable preview payloads safely", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ error: "nope" }),
      })),
    );

    render(
      <SettlementResultPreview
        marketId="m-1"
        marketTitle="Will AA123 be delayed?"
        marketStatus="open"
        totalYesStake={10}
        totalNoStake={20}
        selectedOutcome="YES"
        onOutcomeChange={() => {}}
      />,
    );

    expect(await screen.findByTestId("settlement-preview-error")).toHaveTextContent(
      /unavailable/i,
    );
  });

  it("communicates stale market state when the snapshot revision changes", async () => {
    const { rerender } = render(
      <SettlementResultPreview
        marketId="m-1"
        marketTitle="Will AA123 be delayed?"
        marketStatus="open"
        totalYesStake={10}
        totalNoStake={20}
        selectedOutcome="YES"
        onOutcomeChange={() => {}}
      />,
    );

    await screen.findByTestId("preview-winning-outcome");

    rerender(
      <SettlementResultPreview
        marketId="m-1"
        marketTitle="Will AA123 be delayed?"
        marketStatus="open"
        totalYesStake={99}
        totalNoStake={20}
        selectedOutcome="YES"
        onOutcomeChange={() => {}}
      />,
    );

    expect(await screen.findByTestId("preview-stale")).toHaveTextContent(/market state changed/i);
  });
});
