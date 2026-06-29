import { useEffect, useState } from "react";

export type MarketStatus = "open" | "closed" | "resolved" | "disputed";

interface StatusIndicatorProps {
  status: MarketStatus;
  resolvedAt?: string;   // ISO date string
  outcome?: "YES" | "NO";
  /** "badge" = pill only, "full" = pill + resolution details */
  variant?: "badge" | "full";
}

const CONFIG: Record<MarketStatus, { label: string; color: string; dot: string }> = {
  open:     { label: "Active",   color: "#22c55e", dot: "animate-pulse" },
  closed:   { label: "Closed",   color: "#f59e0b", dot: "" },
  resolved: { label: "Resolved", color: "#6366f1", dot: "" },
  disputed: { label: "Disputed", color: "#ef4444", dot: "animate-pulse" },
};

export default function StatusIndicator({
  status,
  resolvedAt,
  outcome,
  variant = "badge",
}: StatusIndicatorProps) {
  const cfg = CONFIG[status];

  // Tick every second so "live" markets feel real-time
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== "open" && status !== "disputed") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const badge = (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: cfg.color + "22", color: cfg.color }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`}
        style={{ background: cfg.color }}
      />
      {cfg.label}
    </span>
  );

  if (variant === "badge") return badge;

  return (
    <div className="flex flex-col gap-1">
      {badge}
      {status === "resolved" && (outcome || resolvedAt) && (
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
            <span>· {new Date(resolvedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
          )}
        </div>
      )}
      {status === "disputed" && (
        <p className="text-xs" style={{ color: "#ef4444" }}>
          Under review — outcome pending
        </p>
      )}
    </div>
  );
}
