"use client";

import { useEffect, useMemo, useState } from "react";
import type { ResolutionOutcome, SettlementPreview } from "../../lib/settlementPreview";
import { marketRevision, parseSettlementPreview } from "../../lib/settlementPreview";

export interface SettlementResultPreviewProps {
  marketId: string;
  marketTitle: string;
  marketStatus: string;
  totalYesStake: number;
  totalNoStake: number;
  selectedOutcome: ResolutionOutcome;
  onOutcomeChange: (outcome: ResolutionOutcome) => void;
}

export default function SettlementResultPreview({
  marketId,
  marketTitle,
  marketStatus,
  totalYesStake,
  totalNoStake,
  selectedOutcome,
  onOutcomeChange,
}: SettlementResultPreviewProps) {
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const currentRevision = useMemo(
    () => marketRevision({ status: marketStatus, totalYesStake, totalNoStake }),
    [marketStatus, totalYesStake, totalNoStake],
  );

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      marketId,
      outcome: selectedOutcome,
      status: marketStatus,
      totalYesStake: String(totalYesStake),
      totalNoStake: String(totalNoStake),
    });

    setLoading(true);
    setError(null);

    fetch(`/api/settlement/preview?${params.toString()}`, {
      method: "GET",
      signal: controller.signal,
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        const parsed = parseSettlementPreview(payload);
        if (!parsed) {
          setPreview(null);
          setError("Settlement preview is unavailable for this market.");
          return;
        }
        setPreview(parsed);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setPreview(null);
        setError(err instanceof Error ? err.message : "Settlement preview failed.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [marketId, marketStatus, selectedOutcome, totalYesStake, totalNoStake]);

  const stale =
    preview?.available === true && preview.marketRevision !== currentRevision;

  return (
    <section
      aria-label="Settlement result preview"
      data-testid="settlement-result-preview"
      style={{
        border: "1px solid #e6e6e6",
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        background: "#fafafa",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#6b7280",
        }}
      >
        Projected settlement — not finalized
      </p>
      <h5 style={{ margin: "6px 0 10px" }}>{marketTitle}</h5>

      <fieldset style={{ border: 0, padding: 0, margin: "0 0 12px" }}>
        <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          Resolution action
        </legend>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["YES", "NO", "VOID"] as const).map((outcome) => (
            <label key={outcome} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="radio"
                name={`resolution-${marketId}`}
                value={outcome}
                checked={selectedOutcome === outcome}
                onChange={() => onOutcomeChange(outcome)}
              />
              {outcome}
            </label>
          ))}
        </div>
      </fieldset>

      {loading && <p>Loading settlement preview…</p>}
      {error && (
        <p role="alert" data-testid="settlement-preview-error">
          {error}
        </p>
      )}

      {preview && !loading && (
        <dl style={{ margin: 0, display: "grid", gap: 8 }}>
          <div>
            <dt style={{ fontSize: 12, color: "#6b7280" }}>Current market status</dt>
            <dd style={{ margin: 0 }} data-testid="preview-market-status">
              {preview.marketStatus}
            </dd>
          </div>
          <div>
            <dt style={{ fontSize: 12, color: "#6b7280" }}>Projected winning outcome</dt>
            <dd style={{ margin: 0 }} data-testid="preview-winning-outcome">
              {preview.projectedWinningOutcome}
            </dd>
          </div>
          <div>
            <dt style={{ fontSize: 12, color: "#6b7280" }}>Projected payout effect</dt>
            <dd style={{ margin: 0 }} data-testid="preview-payout-effect">
              {preview.projectedPayoutEffect}
            </dd>
          </div>
        </dl>
      )}

      {preview?.warnings.map((warning) => (
        <p key={warning} role="status" data-testid="preview-warning">
          {warning}
        </p>
      ))}

      {stale && (
        <p role="alert" data-testid="preview-stale">
          Market state changed since this preview was generated. Refresh before submitting.
        </p>
      )}
    </section>
  );
}
