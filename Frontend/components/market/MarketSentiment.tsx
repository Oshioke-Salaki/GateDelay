"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWebSocketContext } from "@/app/components/WebSocketProvider";
import type { PriceUpdate } from "@/hooks/useWebSocket";

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
  const queryClient = useQueryClient();
  const { subscribe, unsubscribe, on, isConnected, status } = useWebSocketContext();

  // Keep sentiment in sync with the app-shell WebSocket: subscribe to the market
  // and invalidate the REST query when price/market payloads arrive for it.
  useEffect(() => {
    if (!marketId) return;

    subscribe([marketId]);

    const matchesMarket = (payload: { marketId?: unknown } | null | undefined) =>
      Boolean(payload && typeof payload.marketId === "string" && payload.marketId === marketId);

    const unsubPrice = on("priceUpdate", (data: PriceUpdate) => {
      if (matchesMarket(data)) {
        void queryClient.invalidateQueries({ queryKey: ["market-sentiment", marketId] });
      }
    });

    const unsubMarket = on("marketData", (data: Record<string, unknown>) => {
      if (matchesMarket(data)) {
        void queryClient.invalidateQueries({ queryKey: ["market-sentiment", marketId] });
      }
    });

    return () => {
      unsubscribe([marketId]);
      unsubPrice();
      unsubMarket();
    };
  }, [marketId, subscribe, unsubscribe, on, queryClient]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<MarketSentiment, Error>({
    queryKey: ["market-sentiment", marketId],
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
        let detail = res.statusText;
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) detail = body.error;
        } catch {
          detail = await res.text().catch(() => res.statusText);
        }
        throw new Error(`Market sentiment failed (${res.status}): ${detail}`);
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
        aria-busy="true"
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
        role="alert"
      >
        <div className="text-sm font-semibold" style={{ color: "#ef4444" }}>
          Sentiment unavailable
        </div>
        <div className="text-xs mt-1" style={{ color: "#ef4444aa" }}>
          {(error as Error)?.message ?? "Unknown error"}
        </div>
        {marketTitle ? (
          <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Market: {marketTitle}
            {marketDescription ? ` — ${marketDescription}` : ""}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="mt-3 text-xs font-semibold underline"
          style={{ color: "#ef4444" }}
        >
          {isFetching ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }

  const cfg = SIGNAL_CONFIG[data.signal.direction];

  return (
    <section
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)", background: "var(--card)" }}
      data-ws-status={status}
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
          <div className="text-xs text-right" style={{ color: "var(--muted)" }}>
            <div>
              {data.generatedAt
                ? new Date(data.generatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </div>
            {isConnected ? (
              <div className="mt-0.5" style={{ color: "#22c55e" }}>
                Live
              </div>
            ) : null}
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
