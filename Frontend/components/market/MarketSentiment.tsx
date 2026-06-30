"use client";

import { useQuery } from "@tanstack/react-query";

type SignalDirection = "bullish" | "bearish" | "neutral";
type RiskLevel = "low" | "medium" | "high";

interface TradingSignal {
  direction: SignalDirection;
  confidence: number; // 0–100
  rationale: string;
}

interface RiskAssessment {
  level: RiskLevel;
  score: number; // 0–100 (higher = riskier)
  factors: string[];
}

interface MarketSentiment {
  marketId: string;
  signal: TradingSignal;
  risk?: RiskAssessment;
  summary?: string;
  generatedAt?: string;
}

const SIGNAL_CONFIG: Record<
  SignalDirection,
  { label: string; color: string; bg: string; icon: string }
> = {
  bullish: { label: "Bullish", color: "#22c55e", bg: "#22c55e18", icon: "▲" },
  bearish: { label: "Bearish", color: "#ef4444", bg: "#ef444418", icon: "▼" },
  neutral: { label: "Neutral", color: "#f59e0b", bg: "#f59e0b18", icon: "◆" },
};

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  low: { label: "Low Risk", color: "#22c55e", bg: "#22c55e18" },
  medium: { label: "Medium Risk", color: "#f59e0b", bg: "#f59e0b18" },
  high: { label: "High Risk", color: "#ef4444", bg: "#ef444418" },
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

function RiskCompact({ risk }: { risk: RiskAssessment }) {
  const cfg = RISK_CONFIG[risk.level];
  return (
    <div
      className="rounded-xl p-3 flex items-center justify-between gap-3"
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}44` }}
    >
      <div>
        <div className="text-xs font-semibold" style={{ color: cfg.color }}>
          {cfg.label}
        </div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          Risk score:{" "}
          <span style={{ color: "var(--foreground)", fontWeight: 700 }}>{risk.score}</span>
        </div>
      </div>
      <span className="text-2xl" aria-hidden style={{ color: cfg.color }}>
        {risk.level === "low" ? "✓" : risk.level === "medium" ? "!" : "⚠"}
      </span>
    </div>
  );
}

export interface MarketSentimentProps {
  marketId: string;
  marketTitle: string;
  marketDescription?: string;
  accessToken?: string;
  refreshInterval?: number;
  defaultCollapsed?: boolean;
}

export default function MarketSentiment({
  marketId,
  marketTitle,
  marketDescription,
  accessToken,
  refreshInterval,
}: MarketSentimentProps) {
  const queryKey = ["market-sentiment", marketId];

  const { data, isLoading, isError, error } = useQuery<MarketSentiment, Error>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(
        `/api/market-sentiment?marketId=${encodeURIComponent(marketId)}`,
        {
          method: "GET",
          headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`Market sentiment failed (${res.status}): ${text}`);
      }

      return (await res.json()) as MarketSentiment;
    },
    enabled: Boolean(marketId),
    refetchInterval: refreshInterval ?? false,
    staleTime: refreshInterval ? refreshInterval * 0.8 : 5 * 60 * 1000,
    retry: 2,
  });

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-4"
        style={{ border: "1px solid var(--border)", background: "var(--card)" }}
      >
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-1/2" style={{ background: "var(--border)", borderRadius: 8 }} />
          <div className="h-3 w-full" style={{ background: "var(--border)", borderRadius: 8 }} />
          <div className="h-3 w-5/6" style={{ background: "var(--border)", borderRadius: 8 }} />
        </div>
      </div>
    );
  }

  if (isError || !data?.signal) {
    return (
      <div
        className="rounded-xl p-4"
        style={{ border: "1px solid #ef444444", background: "#ef444418" }}
      >
        <div className="text-sm font-semibold" style={{ color: "#ef4444" }}>
          Sentiment unavailable
        </div>
        <div className="text-xs mt-1" style={{ color: "#ef4444aa" }}>
          {(error as Error)?.message ?? "Unknown error"}
        </div>
      </div>
    );
  }

  const cfg = SIGNAL_CONFIG[data.signal.direction];

  return (
    <section
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)", background: "var(--card)" }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
              Market sentiment
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xl" aria-hidden style={{ color: cfg.color }}>
                {cfg.icon}
              </span>
              <span className="text-sm font-semibold" style={{ color: cfg.color }}>
                {cfg.label}
              </span>
            </div>
          </div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            {data.generatedAt
              ? new Date(data.generatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </div>
        </div>

        <ConfidenceBar value={data.signal.confidence} color={cfg.color} />
        <div className="text-xs" style={{ color: "var(--muted)", lineHeight: 1.35 }}>
          {data.signal.rationale}
        </div>

        {data.risk ? <RiskCompact risk={data.risk} /> : null}

        {data.summary ? (
          <div className="text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>
            {data.summary}
          </div>
        ) : null}
      </div>
    </section>
  );
}

