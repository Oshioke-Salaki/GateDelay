"use client";

import { useEffect, useState } from "react";
import { getMarketOutcomeLabel } from "@/lib/labels";

export type MarketStatus =
  | "active"
  | "open"
  | "closed"
  | "resolved"
  | "disputed"
  | "paused"
  | "cancelled"
  | "canceled";

type NormalizedMarketStatus = Exclude<MarketStatus, "open" | "canceled">;

interface StatusBadgeProps {
  status: MarketStatus;
  resolvedAt?: string;
  outcome?: "YES" | "NO";
  className?: string;
  variant?: "badge" | "full";
}

const STATUS_CONFIG: Record<
  NormalizedMarketStatus,
  { label: string; color: string; bgColor: string; icon: string; ariaLabel: string; pulse?: boolean }
> = {
  active: {
    label: "Active",
    color: "#22c55e",
    bgColor: "#22c55e18",
    icon: "*",
    ariaLabel: "Market status: active and accepting trades",
    pulse: true,
  },
  closed: {
    label: "Closed",
    color: "#f59e0b",
    bgColor: "#f59e0b18",
    icon: "-",
    ariaLabel: "Market status: closed to new trades",
  },
  resolved: {
    label: "Resolved",
    color: "#6366f1",
    bgColor: "#6366f118",
    icon: "OK",
    ariaLabel: "Market status: resolved with final outcome available",
  },
  disputed: {
    label: "Disputed",
    color: "#ef4444",
    bgColor: "#ef444418",
    icon: "!",
    ariaLabel: "Market status: disputed and under review",
    pulse: true,
  },
  paused: {
    label: "Paused",
    color: "#64748b",
    bgColor: "#64748b18",
    icon: "II",
    ariaLabel: "Market status: paused and temporarily not accepting trades",
  },
  cancelled: {
    label: "Cancelled",
    color: "#71717a",
    bgColor: "#71717a18",
    icon: "x",
    ariaLabel: "Market status: cancelled and no longer active",
  },
};

export function normalizeMarketStatus(status: MarketStatus): NormalizedMarketStatus {
  if (status === "open") return "active";
  if (status === "canceled") return "cancelled";
  return status;
}

export function getMarketStatusConfig(status: MarketStatus) {
  return STATUS_CONFIG[normalizeMarketStatus(status)];
}

export default function StatusBadge({
  status,
  resolvedAt,
  outcome,
  className = "",
  variant = "badge",
}: StatusBadgeProps) {
  const normalizedStatus = normalizeMarketStatus(status);
  const config = STATUS_CONFIG[normalizedStatus];
  const [isAnimating, setIsAnimating] = useState(Boolean(config.pulse));

  useEffect(() => {
    setIsAnimating(Boolean(config.pulse));
  }, [config.pulse]);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div
        role="status"
        aria-label={config.ariaLabel}
        title={config.ariaLabel}
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

      {normalizedStatus === "resolved" && outcome && variant === "full" && (
        <div
          aria-label={`Resolved outcome: ${getMarketOutcomeLabel(outcome)}`}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-semibold"
          style={{
            background: outcome === "YES" ? "#22c55e18" : "#ef444418",
            color: outcome === "YES" ? "#22c55e" : "#ef4444",
            border: `1px solid ${outcome === "YES" ? "#22c55e44" : "#ef444444"}`,
          }}
        >
          <span aria-hidden="true">{outcome === "YES" ? "OK" : "x"}</span>
          <span>{getMarketOutcomeLabel(outcome)}</span>
        </div>
      )}

      {normalizedStatus === "resolved" && resolvedAt && variant === "full" && (
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {new Date(resolvedAt).toLocaleDateString(undefined, { dateStyle: "short" })}
        </span>
      )}
    </div>
  );
}
