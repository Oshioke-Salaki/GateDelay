import { useEffect, useState } from "react";
import StatusBadge, { MarketStatus as SharedMarketStatus, normalizeMarketStatus } from "./StatusBadge";

export type MarketStatus = SharedMarketStatus;

interface StatusIndicatorProps {
  status: MarketStatus;
  resolvedAt?: string;
  outcome?: "YES" | "NO";
  /** "badge" = pill only, "full" = pill + resolution details */
  variant?: "badge" | "full";
}

export default function StatusIndicator({
  status,
  resolvedAt,
  outcome,
  variant = "badge",
}: StatusIndicatorProps) {
  const normalizedStatus = normalizeMarketStatus(status);

  // Tick every second so live markets feel real-time.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (normalizedStatus !== "active" && normalizedStatus !== "disputed") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [normalizedStatus]);

  const badge = <StatusBadge status={status} resolvedAt={resolvedAt} outcome={outcome} variant={variant} />;

  if (variant === "badge") return badge;

  return (
    <div className="flex flex-col gap-1">
      {badge}
      {normalizedStatus === "resolved" && (outcome || resolvedAt) && (
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
          {outcome && (
            <span
              className="font-semibold"
              style={{ color: outcome === "YES" ? "#22c55e" : "#ef4444" }}
            >
              Outcome: {outcome}
            </span>
          )}
          {resolvedAt && (
            <span>- {new Date(resolvedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
          )}
        </div>
      )}
      {normalizedStatus === "disputed" && (
        <p className="text-xs" style={{ color: "#ef4444" }}>
          Under review - outcome pending
        </p>
      )}
    </div>
  );
}
