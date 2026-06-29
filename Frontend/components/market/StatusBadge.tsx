"use client";

import { useEffect, useState } from "react";

export type MarketStatus = "active" | "closed" | "resolved" | "disputed" | "paused";

interface StatusBadgeProps {
  status: MarketStatus;
  resolvedAt?: string;
  outcome?: "YES" | "NO";
  className?: string;
}

const STATUS_CONFIG: Record<MarketStatus, { label: string; color: string; bgColor: string; icon: string }> = {
  active: {
    label: "Active",
    color: "#22c55e",
    bgColor: "#22c55e18",
    icon: "●",
  },
  closed: {
    label: "Closed",
    color: "#f59e0b",
    bgColor: "#f59e0b18",
    icon: "◆",
  },
  resolved: {
    label: "Resolved",
    color: "#6366f1",
    bgColor: "#6366f118",
    icon: "✓",
  },
  disputed: {
    label: "Disputed",
    color: "#ef4444",
    bgColor: "#ef444418",
    icon: "⚠",
  },
  paused: {
    label: "Paused",
    color: "#8b5cf6",
    bgColor: "#8b5cf618",
    icon: "⏸",
  },
};

export default function StatusBadge({
  status,
  resolvedAt,
  outcome,
  className = "",
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const [isAnimating, setIsAnimating] = useState(status === "active" || status === "disputed");

  useEffect(() => {
    setIsAnimating(status === "active" || status === "disputed");
  }, [status]);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-sm ${
          isAnimating ? "animate-pulse" : ""
        }`}
        style={{
          background: config.bgColor,
          color: config.color,
          border: `1px solid ${config.color}44`,
        }}
      >
        <span className="text-base" aria-hidden="true">
          {config.icon}
        </span>
        <span>{config.label}</span>
      </div>

      {status === "resolved" && outcome && (
        <div
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-semibold"
          style={{
            background: outcome === "YES" ? "#22c55e18" : "#ef444418",
            color: outcome === "YES" ? "#22c55e" : "#ef4444",
            border: `1px solid ${outcome === "YES" ? "#22c55e44" : "#ef444444"}`,
          }}
        >
          <span>{outcome === "YES" ? "✓" : "✗"}</span>
          <span>{outcome}</span>
        </div>
      )}

      {status === "resolved" && resolvedAt && (
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {new Date(resolvedAt).toLocaleDateString(undefined, { dateStyle: "short" })}
        </span>
      )}
    </div>
  );
}
