"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

// ─── Types (mirror backend MarketAnalysis shape) ──────────────────────────────

type SignalDirection = "bullish" | "bearish" | "neutral";
type RiskLevel = "low" | "medium" | "high";

interface TradingSignal {
  direction: SignalDirection;
  confidence: number;   // 0–100
  rationale: string;
}

interface RiskAssessment {
  level: RiskLevel;
  score: number;        // 0–100
  factors: string[];
}

export interface MarketAnalysis {
  marketId: string;
  marketTitle: string;
  summary: string;
  signal: TradingSignal;
  risk: RiskAssessment;
  keyInsights: string[];
  recommendation: string;
  generatedAt: string;
  model: string;
}

export interface AnalysisPanelProps {
  marketId: string;
  marketTitle: string;
  marketDescription?: string;
  /** JWT access token — required to call the protected backend endpoint */
  accessToken?: string;
  /** Auto-refresh interval in ms. Default: 5 minutes. 0 = disabled. */
  refreshInterval?: number;
  /** Start collapsed. Default: false */
  defaultCollapsed?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
const DEFAULT_REFRESH_MS = 5 * 60 * 1000;

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchAnalysis(
  marketId: string,
  marketTitle: string,
  marketDescription: string | undefined,
  accessToken: string | undefined,
): Promise<MarketAnalysis> {
  const res = await fetch(`${API_BASE}/ai/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ marketId, marketTitle, marketDescription }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`AI analysis failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<MarketAnalysis>;
}

// ─── Visual helpers ───────────────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<
  SignalDirection,
  { label: string; color: string; bg: string; icon: string }
> = {
  bullish: { label: "Bullish", color: "#22c55e", bg: "#22c55e18", icon: "▲" },
  bearish: { label: "Bearish", color: "#ef4444", bg: "#ef444418", icon: "▼" },
  neutral: { label: "Neutral", color: "#f59e0b", bg: "#f59e0b18", icon: "◆" },
};

const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; color: string; bg: string }
> = {
  low:    { label: "Low Risk",    color: "#22c55e", bg: "#22c55e18" },
  medium: { label: "Medium Risk", color: "#f59e0b", bg: "#f59e0b18" },
  high:   { label: "High Risk",   color: "#ef4444", bg: "#ef444418" },
};

function ConfidenceBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-2 rounded-full overflow-hidden"
        style={{ background: "var(--border)" }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Confidence: ${value}%`}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-8 text-right" style={{ color }}>
        {value}%
      </span>
    </div>
  );
}

function RiskScoreRing({ score, level }: { score: number; level: RiskLevel }) {
  const cfg = RISK_CONFIG[level];
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={cfg.color}
          strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 28 28)"
          style={{ transition: "stroke-dasharray 0.7s ease" }}
        />
        <text
          x="28"
          y="33"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fill={cfg.color}
        >
          {score}
        </text>
      </svg>
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{ background: cfg.bg, color: cfg.color }}
      >
        {cfg.label}
      </span>
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded animate-pulse ${className}`}
      style={{ background: "var(--border)" }}
    />
  );
}

function LoadingState() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div className="p-4 space-y-3">
      <div
        className="rounded-xl p-4 space-y-2"
        style={{ background: "#ef444418", border: "1px solid #ef444444" }}
      >
        <p className="text-sm font-semibold" style={{ color: "#ef4444" }}>
          Analysis unavailable
        </p>
        <p className="text-xs" style={{ color: "#ef4444aa" }}>
          {error.message}
        </p>
      </div>
      <button
        onClick={onRetry}
        className="w-full rounded-lg py-2 text-sm font-medium transition-opacity hover:opacity-80"
        style={{
          background: "var(--background)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        }}
      >
        Retry
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalysisPanel({
  marketId,
  marketTitle,
  marketDescription,
  accessToken,
  refreshInterval = DEFAULT_REFRESH_MS,
  defaultCollapsed = false,
}: AnalysisPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const queryKey = ["ai-analysis", marketId];

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery<MarketAnalysis, Error>({
    queryKey,
    queryFn: () =>
      fetchAnalysis(marketId, marketTitle, marketDescription, accessToken),
    refetchInterval: refreshInterval || false,
    staleTime: refreshInterval ? refreshInterval * 0.8 : 4 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    // Don't fetch while panel is collapsed — fetch on first open
    enabled: !collapsed,
  });

  const handleToggle = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  const signal = data ? SIGNAL_CONFIG[data.signal.direction] : null;
  const risk = data ? RISK_CONFIG[data.risk.level] : null;

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      {/* ── Header (always visible) ── */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:opacity-80"
        style={{
          background: "var(--card)",
          borderBottom: collapsed ? "none" : "1px solid var(--border)",
        }}
        aria-expanded={!collapsed}
        aria-controls="analysis-panel-body"
      >
        <div className="flex items-center gap-2">
          {/* Brain icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M9.5 2a4.5 4.5 0 0 1 4.5 4.5v.5h.5a3.5 3.5 0 0 1 0 7H14v.5a4.5 4.5 0 0 1-9 0V14h-.5a3.5 3.5 0 0 1 0-7H5v-.5A4.5 4.5 0 0 1 9.5 2Z"
              stroke="var(--muted)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M14.5 2a4.5 4.5 0 0 0-4.5 4.5"
              stroke="var(--muted)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            AI Analysis
          </span>
          {isFetching && !isLoading && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: "#3b82f622", color: "#3b82f6" }}
            >
              updating…
            </span>
          )}
          {data && signal && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: signal.bg, color: signal.color }}
            >
              {signal.icon} {signal.label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs hidden sm:block" style={{ color: "var(--muted)" }}>
              {lastUpdated}
            </span>
          )}
          {/* Refresh button */}
          {!collapsed && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                refetch();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  refetch();
                }
              }}
              className="rounded-md p-1 transition-opacity hover:opacity-70"
              style={{ color: "var(--muted)" }}
              aria-label="Refresh analysis"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                style={{ animation: isFetching ? "spin 0.8s linear infinite" : "none" }}
              >
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <path
                  d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M12 2v3h-3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          )}
          {/* Chevron */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            style={{
              transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
              transition: "transform 0.2s ease",
              color: "var(--muted)",
            }}
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>

      {/* ── Body ── */}
      {!collapsed && (
        <div
          id="analysis-panel-body"
          style={{ background: "var(--background)" }}
        >
          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : data ? (
            <div className="p-4 space-y-4">
              {/* Summary */}
              <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
                {data.summary}
              </p>

              {/* Signal + Risk row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Signal card */}
                <div
                  className="rounded-xl p-3 space-y-2"
                  style={{ background: signal!.bg, border: `1px solid ${signal!.color}44` }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-base" aria-hidden>{signal!.icon}</span>
                    <p className="text-xs font-semibold" style={{ color: signal!.color }}>
                      {signal!.label} Signal
                    </p>
                  </div>
                  <ConfidenceBar value={data.signal.confidence} color={signal!.color} />
                  <p className="text-xs leading-snug" style={{ color: "var(--muted)" }}>
                    {data.signal.rationale}
                  </p>
                </div>

                {/* Risk card */}
                <div
                  className="rounded-xl p-3 flex flex-col items-center justify-center gap-1"
                  style={{ background: risk!.bg, border: `1px solid ${risk!.color}44` }}
                >
                  <RiskScoreRing score={data.risk.score} level={data.risk.level} />
                </div>
              </div>

              {/* Risk factors */}
              {data.risk.factors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                    RISK FACTORS
                  </p>
                  <ul className="space-y-1">
                    {data.risk.factors.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--foreground)" }}>
                        <span style={{ color: risk!.color, marginTop: 1 }} aria-hidden>•</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key insights */}
              {data.keyInsights.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                    KEY INSIGHTS
                  </p>
                  <ul className="space-y-1.5">
                    {data.keyInsights.map((insight, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs rounded-lg px-3 py-2"
                        style={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          color: "var(--foreground)",
                        }}
                      >
                        <span style={{ color: "#3b82f6", marginTop: 1 }} aria-hidden>✦</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendation */}
              {data.recommendation && (
                <div
                  className="rounded-xl px-4 py-3 flex items-start gap-2"
                  style={{ background: "#3b82f618", border: "1px solid #3b82f644" }}
                >
                  <span style={{ color: "#3b82f6", fontSize: 16, lineHeight: 1.4 }} aria-hidden>
                    💡
                  </span>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>
                    <span className="font-semibold" style={{ color: "#3b82f6" }}>
                      Recommendation:{" "}
                    </span>
                    {data.recommendation}
                  </p>
                </div>
              )}

              {/* Footer */}
              <div
                className="flex items-center justify-between pt-1 text-xs"
                style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}
              >
                <span>
                  Model:{" "}
                  <span style={{ color: "var(--foreground)" }}>
                    {data.model === "mock" ? "Demo (no API key)" : data.model}
                  </span>
                </span>
                <span>
                  Generated{" "}
                  {new Date(data.generatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
