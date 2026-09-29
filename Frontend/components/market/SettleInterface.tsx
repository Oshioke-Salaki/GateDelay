"use client";

import React, { useMemo, useState } from "react";
import { useWalletClient } from "wagmi";
import { BrowserProvider } from "ethers";
import SettlementResultPreview from "./SettlementResultPreview";
import {
  marketRevision,
  type ResolutionOutcome,
} from "../../lib/settlementPreview";

type Market = {
  id: string;
  title: string;
  status: string;
  totalYesStake: number;
  totalNoStake: number;
};

export default function SettleInterface({ market }: { market: Market }) {
  const { data: walletClient } = useWalletClient();

  const [status, setStatus] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<ResolutionOutcome>("YES");
  const [confirming, setConfirming] = useState(false);
  const [previewRevision, setPreviewRevision] = useState<string | null>(null);

  const currentRevision = useMemo(
    () =>
      marketRevision({
        status: market.status,
        totalYesStake: market.totalYesStake,
        totalNoStake: market.totalNoStake,
      }),
    [market.status, market.totalNoStake, market.totalYesStake],
  );

  const stalePreview =
    previewRevision != null && previewRevision !== currentRevision;

  async function handleSettle() {
    if (stalePreview) {
      setStatus("stale");
      return;
    }
    setStatus("settling");
    try {
      if (!walletClient) throw new Error("No signer");
      const provider = new BrowserProvider(walletClient);
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({ to: await signer.getAddress(), value: 0 });
      await tx.wait();
      setStatus("success");
    } catch {
      setStatus("failed");
    }
    setTimeout(() => setStatus(null), 1500);
  }

  return (
    <div style={{ border: "1px solid #e6e6e6", padding: 12, borderRadius: 8 }}>
      <h4 style={{ marginTop: 0 }}>{market.title} — Settlement</h4>
      <div style={{ marginBottom: 8 }}>
        <strong>Status:</strong> {market.status}
      </div>

      <SettlementResultPreview
        marketId={market.id}
        marketTitle={market.title}
        marketStatus={market.status}
        totalYesStake={market.totalYesStake}
        totalNoStake={market.totalNoStake}
        selectedOutcome={selectedOutcome}
        onOutcomeChange={(outcome) => {
          setSelectedOutcome(outcome);
          setConfirming(false);
        }}
      />

      <div style={{ marginBottom: 12 }}>
        {!confirming ? (
          <button
            type="button"
            onClick={() => {
              setPreviewRevision(currentRevision);
              setConfirming(true);
            }}
            style={{ padding: "8px 12px" }}
          >
            Review and settle
          </button>
        ) : (
          <div data-testid="settlement-confirmation">
            <p>
              Submit this projected {selectedOutcome} resolution to the settlement
              backend/chain? This preview is not a finalized result.
            </p>
            <button
              type="button"
              onClick={handleSettle}
              disabled={status === "settling" || stalePreview}
              style={{ padding: "8px 12px", marginRight: 8 }}
            >
              Confirm settlement
            </button>
            <button type="button" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {status && (
        <div>
          <strong>Result:</strong> {status}
        </div>
      )}
    </div>
  );
}
