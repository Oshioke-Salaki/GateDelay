"use client";
import Link from "next/link";
import DashboardLayout from "../../components/layout/DashboardLayout";
import MarketCard, { Market } from "../../components/market/MarketCard";
import TrendingMarkets from "../../components/dashboard/TrendingMarkets";
import TradingChallenge from "../../components/challenge/TradingChallenge";

// Replace with a real API call (e.g. TanStack Query fetching /api/markets)
// once the backend market-list endpoint is available.
const SAMPLE_MARKETS: Market[] = [];

const STATS = [
  { label: "Active Markets", value: SAMPLE_MARKETS.filter((m) => m.status === "open").length },
  { label: "Total Volume", value: `$${SAMPLE_MARKETS.reduce((s, m) => s + m.volume, 0).toLocaleString()}` },
  { label: "Total Liquidity", value: `$${SAMPLE_MARKETS.reduce((s, m) => s + m.liquidity, 0).toLocaleString()}` },
];

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Page heading */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
              Markets
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
              Browse and trade active flight prediction markets.
            </p>
          </div>
          <Link
            href="/markets/create"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "#3b82f6" }}
          >
            + Create Market
          </Link>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-xl px-5 py-4"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{s.value}</p>
            </div>
          ))}
        </div>

        <TrendingMarkets />

        <TradingChallenge />

        {/* Market grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SAMPLE_MARKETS.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
